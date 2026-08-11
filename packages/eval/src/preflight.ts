import {
  evaluationPreflightLimitsSchema,
  evaluationPreflightRequestSchema,
  evaluationPreflightResponseSchema,
  type EvaluationPreflightLimits,
  type EvaluationPreflightRequest,
  type EvaluationPreflightResponse,
} from "@rack/managed";
import {
  resolveModelAlias,
  sameResolvedModel,
  type ModelRegistry,
  type ModelRegistryEntry,
} from "@rack/registry";

const million = 1_000_000n;
const maxSafeInteger = BigInt(Number.MAX_SAFE_INTEGER);

const safeNumber = (value: bigint, label: string): number => {
  if (value > maxSafeInteger) throw new Error(`${label} exceeds Rack's safe numeric range.`);
  return Number(value);
};

const tokenCostMicrousd = (tokens: number, rate: number): number => {
  const numerator = BigInt(tokens) * BigInt(rate);
  return safeNumber((numerator + million - 1n) / million, "Evaluation cost");
};

const modelCost = (
  model: ModelRegistryEntry,
  inputTokens: number,
  outputTokens: number,
): number =>
  tokenCostMicrousd(inputTokens, model.pricing.inputMicrousdPerMillionTokens) +
  tokenCostMicrousd(outputTokens, model.pricing.outputMicrousdPerMillionTokens);

const add = (left: number, right: number, label: string): number =>
  safeNumber(BigInt(left) + BigInt(right), label);

const multiply = (value: number, multiplier: number, label: string): number =>
  safeNumber(BigInt(value) * BigInt(multiplier), label);

const identity = (model: ModelRegistryEntry) => ({
  alias: model.alias,
  providerId: model.providerId,
  modelId: model.modelId,
});

export const buildEvaluationPreflight = (
  input: EvaluationPreflightRequest,
  registry: ModelRegistry,
  inputLimits: EvaluationPreflightLimits,
): EvaluationPreflightResponse => {
  const request = evaluationPreflightRequestSchema.parse(input);
  const limits = evaluationPreflightLimitsSchema.parse(inputLimits);
  const generator = resolveModelAlias(registry, request.generatorAlias, "generate");
  const reliable = request.mode === "reliable";
  const judge = reliable
    ? resolveModelAlias(registry, request.judgeAlias!, "judge")
    : generator;
  if (!reliable && request.judgeCallsPerOutput > 0 && !generator.capabilities.includes("judge")) {
    throw new Error(
      `Quick evaluation model alias ${generator.alias} must support judge when rubric calls are configured.`,
    );
  }

  const repetitions = reliable ? 5 : 1;
  const candidateGeneratorCalls = request.caseCount * repetitions;
  const baselineGeneratorCalls = reliable ? request.caseCount * repetitions : 0;
  const generatedOutputs = candidateGeneratorCalls + baselineGeneratorCalls;
  const judgeCalls = generatedOutputs * request.judgeCallsPerOutput;
  const totalCalls = generatedOutputs + judgeCalls;

  const generatorInputTokens = add(
    multiply(
      request.candidateInputTokensPerCase,
      candidateGeneratorCalls,
      "Candidate input-token volume",
    ),
    multiply(
      request.baselineInputTokensPerCase ?? 0,
      baselineGeneratorCalls,
      "Baseline input-token volume",
    ),
    "Generator input-token volume",
  );
  const generatorOutputTokens = multiply(
    request.generatorOutputTokensPerCall,
    generatedOutputs,
    "Generator output-token volume",
  );
  const judgeInputTokens = multiply(
    request.judgePromptTokensPerCase + request.generatorOutputTokensPerCall,
    judgeCalls,
    "Judge input-token volume",
  );
  const judgeOutputTokens = multiply(
    request.judgeOutputTokensPerCall,
    judgeCalls,
    "Judge output-token volume",
  );
  const totalTokens = [
    generatorInputTokens,
    generatorOutputTokens,
    judgeInputTokens,
    judgeOutputTokens,
  ].reduce((total, value) => add(total, value, "Total token volume"), 0);

  const generatorCost = modelCost(generator, generatorInputTokens, generatorOutputTokens);
  const judgeCost = judgeCalls === 0 ? 0 : modelCost(judge, judgeInputTokens, judgeOutputTokens);
  const estimatedCost = add(generatorCost, judgeCost, "Estimated evaluation cost");
  const maximumRetryCost = multiply(
    estimatedCost,
    limits.maxProviderAttemptsPerCall,
    "Maximum retry cost",
  );

  const warnings: EvaluationPreflightResponse["warnings"] = [];
  const judgeIndependent = reliable ? !sameResolvedModel(generator, judge) : null;
  if (reliable && !judgeIndependent) {
    warnings.push({
      code: "judge-not-independent",
      message: "Reliable evaluation resolves generator and judge to the same provider/model; record this run as non-independent judging.",
    });
  }

  const blockers: EvaluationPreflightResponse["blockers"] = [];
  if (request.generatorOutputTokensPerCall > generator.limits.maxOutputTokens) {
    blockers.push({
      code: "generator-output-limit",
      message: `Requested generator output exceeds the ${generator.alias} model limit.`,
    });
  }
  if (judgeCalls > 0 && request.judgeOutputTokensPerCall > judge.limits.maxOutputTokens) {
    blockers.push({
      code: "judge-output-limit",
      message: `Requested judge output exceeds the ${judge.alias} model limit.`,
    });
  }
  if (maximumRetryCost > limits.perRunCapMicrousd) {
    blockers.push({
      code: "per-run-cap",
      message: "Maximum retry exposure exceeds the hard per-run cost cap.",
    });
  }
  if (maximumRetryCost > limits.workspaceRemainingMicrousd) {
    blockers.push({
      code: "workspace-budget",
      message: "Maximum retry exposure exceeds the workspace's remaining managed-AI budget.",
    });
  }
  if (limits.activePaidRuns >= limits.concurrencyLimit) {
    blockers.push({
      code: "concurrency",
      message: "The workspace is already at its paid-run concurrency limit.",
    });
  }

  return evaluationPreflightResponseSchema.parse({
    schemaVersion: "0.1",
    mode: request.mode,
    indicative: !reliable,
    requiresExplicitConfirmation: true,
    eligibleForConfirmation: blockers.length === 0,
    generatorAlias: generator.alias,
    judgeAlias: judge.alias,
    generator: identity(generator),
    judge: identity(judge),
    judgeIndependent,
    repetitions,
    baselineEnabled: reliable,
    comparePreviousAcceptedRun: reliable,
    regressionGate: reliable,
    calls: {
      candidateGenerator: candidateGeneratorCalls,
      baselineGenerator: baselineGeneratorCalls,
      judge: judgeCalls,
      total: totalCalls,
    },
    tokens: {
      generatorInput: generatorInputTokens,
      generatorOutput: generatorOutputTokens,
      judgeInput: judgeInputTokens,
      judgeOutput: judgeOutputTokens,
      total: totalTokens,
    },
    costMicrousd: {
      generator: generatorCost,
      judge: judgeCost,
      estimated: estimatedCost,
      maximumRetry: maximumRetryCost,
    },
    limits,
    warnings,
    blockers,
  });
};
