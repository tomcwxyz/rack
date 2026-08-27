import type {
  ReliableEvaluationWorkflowStore,
  ReliableProviderSettlementInput,
} from "@rack/database";
import {
  RELIABLE_BASELINE_INSTRUCTIONS,
  RELIABLE_REPETITIONS,
  type QuickRubricJudgement,
  type ReliableEvaluationStatusResponse,
  type ResolvedModelIdentity,
} from "@rack/managed";
import type { ModelRunner, ModelRunnerResult } from "@rack/model-runner";
import {
  resolveModelAlias,
  type ModelRegistry,
  type ModelRegistryEntry,
} from "@rack/registry";
import {
  QUICK_RUBRIC_JUDGE_SYSTEM,
  buildQuickRubricPrompt,
  parseQuickRubricJudgement,
} from "./quickRubric.js";

const million = 1_000_000n;
const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);

const safeNumber = (value: bigint, label: string): number => {
  if (value > maxSafe) throw new Error(`${label} exceeds Rack's safe numeric range.`);
  return Number(value);
};

const tokenCostMicrousd = (tokens: number, rate: number): number => {
  const numerator = BigInt(tokens) * BigInt(rate);
  return safeNumber((numerator + million - 1n) / million, "Reliable provider cost");
};

const plannedCost = (
  model: ModelRegistryEntry,
  inputTokens: number,
  outputTokens: number,
): number =>
  tokenCostMicrousd(inputTokens, model.pricing.inputMicrousdPerMillionTokens) +
  tokenCostMicrousd(outputTokens, model.pricing.outputMicrousdPerMillionTokens);

const usageCost = (
  model: ModelRegistryEntry,
  result: ModelRunnerResult,
  fallback: number,
): { costMicrousd: number; basis: "provider-usage" | "planned-allowance" } => {
  const inputTokens = result.usage?.inputTokens;
  const outputTokens = result.usage?.outputTokens;
  if (inputTokens === null || inputTokens === undefined || outputTokens === null || outputTokens === undefined) {
    return { costMicrousd: fallback, basis: "planned-allowance" };
  }
  return {
    costMicrousd: plannedCost(model, inputTokens, outputTokens),
    basis: "provider-usage",
  };
};

const identity = (model: ModelRegistryEntry): ResolvedModelIdentity => ({
  alias: model.alias,
  providerId: model.providerId,
  modelId: model.modelId,
});

const sameIdentity = (model: ModelRegistryEntry, accepted: ResolvedModelIdentity): boolean =>
  model.alias === accepted.alias &&
  model.providerId === accepted.providerId &&
  model.modelId === accepted.modelId;

const mean = (values: number[]): number => {
  if (!values.length) throw new Error("Reliable evaluation requires scored judgements.");
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
};

const passRate = (judgements: QuickRubricJudgement[]): number => {
  if (!judgements.length) return 0;
  const passes = judgements.filter((judgement) => judgement.verdict === "pass").length;
  return Math.round((passes / judgements.length) * 100);
};

class ReliableExecutionIncomplete extends Error {}

const executeCall = async (input: {
  store: ReliableEvaluationWorkflowStore;
  runner: ModelRunner;
  callKey: string;
  model: ModelRegistryEntry;
  instructions: string;
  prompt: string;
  maxOutputTokens: number;
  plannedCostMicrousd: number;
}): Promise<string> => {
  const existing = await input.store.getCall(input.callKey);
  if (existing) {
    if (existing.status === "completed" && existing.output !== null) return existing.output;
    if (existing.status === "claimed") {
      throw new ReliableExecutionIncomplete(
        `Provider call ${input.callKey} is in an ambiguous claimed state; Rack will not repeat paid work automatically.`,
      );
    }
    throw new ReliableExecutionIncomplete(`Provider call ${input.callKey} already failed.`);
  }

  const claimed = await input.store.claimCall(input.callKey, identity(input.model));
  if (!claimed) {
    throw new ReliableExecutionIncomplete(`Provider call ${input.callKey} could not be claimed safely.`);
  }

  let result: ModelRunnerResult;
  try {
    result = await input.runner.generate({
      model: input.model,
      instructions: input.instructions,
      prompt: input.prompt,
      maxOutputTokens: input.maxOutputTokens,
    });
  } catch {
    await input.store.settleCall({
      callKey: input.callKey,
      status: "failed",
      responseId: null,
      inputTokens: null,
      outputTokens: null,
      costMicrousd: input.plannedCostMicrousd,
      costBasis: "failed-conservative",
      output: null,
      judgement: null,
    });
    throw new ReliableExecutionIncomplete(`Provider call ${input.callKey} failed.`);
  }

  const accounted = usageCost(input.model, result, input.plannedCostMicrousd);
  const settlement: ReliableProviderSettlementInput = {
    callKey: input.callKey,
    status: "completed",
    responseId: result.responseId,
    inputTokens: result.usage?.inputTokens ?? null,
    outputTokens: result.usage?.outputTokens ?? null,
    costMicrousd: accounted.costMicrousd,
    costBasis: accounted.basis,
    output: result.text,
    judgement: null,
  };
  await input.store.settleCall(settlement);
  return result.text;
};

const executeJudge = async (input: {
  store: ReliableEvaluationWorkflowStore;
  runner: ModelRunner;
  callKey: string;
  model: ModelRegistryEntry;
  casePrompt: string;
  rubric: string;
  candidateOutput: string;
  maxOutputTokens: number;
  plannedCostMicrousd: number;
}): Promise<QuickRubricJudgement> => {
  const existing = await input.store.getCall(input.callKey);
  if (existing) {
    if (existing.status === "completed" && existing.judgement) return existing.judgement;
    if (existing.status === "claimed") {
      throw new ReliableExecutionIncomplete(
        `Judge call ${input.callKey} is in an ambiguous claimed state; Rack will not repeat paid work automatically.`,
      );
    }
    throw new ReliableExecutionIncomplete(`Judge call ${input.callKey} is incomplete.`);
  }

  const claimed = await input.store.claimCall(input.callKey, identity(input.model));
  if (!claimed) throw new ReliableExecutionIncomplete(`Judge call ${input.callKey} could not be claimed safely.`);

  let result: ModelRunnerResult;
  try {
    result = await input.runner.generate({
      model: input.model,
      instructions: QUICK_RUBRIC_JUDGE_SYSTEM,
      prompt: buildQuickRubricPrompt({
        casePrompt: input.casePrompt,
        rubric: input.rubric,
        candidateOutput: input.candidateOutput,
      }),
      maxOutputTokens: input.maxOutputTokens,
    });
  } catch {
    await input.store.settleCall({
      callKey: input.callKey,
      status: "failed",
      responseId: null,
      inputTokens: null,
      outputTokens: null,
      costMicrousd: input.plannedCostMicrousd,
      costBasis: "failed-conservative",
      output: null,
      judgement: null,
    });
    throw new ReliableExecutionIncomplete(`Judge call ${input.callKey} failed.`);
  }

  const accounted = usageCost(input.model, result, input.plannedCostMicrousd);
  let judgement: QuickRubricJudgement | null = null;
  try {
    judgement = parseQuickRubricJudgement(result.text);
  } catch {
    // Preserve the provider output transiently, but do not infer a verdict from prose.
  }
  await input.store.settleCall({
    callKey: input.callKey,
    status: "completed",
    responseId: result.responseId,
    inputTokens: result.usage?.inputTokens ?? null,
    outputTokens: result.usage?.outputTokens ?? null,
    costMicrousd: accounted.costMicrousd,
    costBasis: accounted.basis,
    output: result.text,
    judgement,
  });
  if (!judgement) {
    throw new ReliableExecutionIncomplete(`Judge call ${input.callKey} did not return valid structured judgement.`);
  }
  return judgement;
};

export const executeReliableModelEvaluation = async (input: {
  store: ReliableEvaluationWorkflowStore;
  registry: ModelRegistry;
  runner: ModelRunner;
}): Promise<ReliableEvaluationStatusResponse> => {
  const current = await input.store.getStatus();
  if (!current) throw new Error("Reliable evaluation does not exist.");
  if (current.status === "completed" || current.status === "incomplete") return current;

  try {
    const confirmation = await input.store.loadConfirmation();
    const generator = resolveModelAlias(input.registry, confirmation.preflight.generatorAlias, "generate");
    const judge = resolveModelAlias(input.registry, confirmation.preflight.judgeAlias!, "judge");
    if (!sameIdentity(generator, confirmation.acceptedGenerator) || !sameIdentity(judge, confirmation.acceptedJudge)) {
      throw new ReliableExecutionIncomplete(
        "The resolved Reliable generator or judge changed after confirmation; a fresh preflight is required.",
      );
    }
    if (generator.connection !== "managed" || judge.connection !== "managed") {
      throw new ReliableExecutionIncomplete("Managed Reliable execution requires managed generator and judge connections.");
    }

    await input.store.markRunning();
    const plan = confirmation.preflight;
    const candidatePlannedCost = plannedCost(
      generator,
      plan.candidateInputTokensPerCase,
      plan.generatorOutputTokensPerCall,
    );
    const baselinePlannedCost = plannedCost(
      generator,
      plan.baselineInputTokensPerCase!,
      plan.generatorOutputTokensPerCall,
    );
    const judgePlannedCost = plannedCost(
      judge,
      plan.judgePromptTokensPerCase + plan.generatorOutputTokensPerCall,
      plan.judgeOutputTokensPerCall,
    );

    const candidates: string[] = [];
    const baselines: string[] = [];
    for (let repetition = 0; repetition < RELIABLE_REPETITIONS; repetition += 1) {
      candidates.push(
        await executeCall({
          store: input.store,
          runner: input.runner,
          callKey: `candidate-${repetition}`,
          model: generator,
          instructions: confirmation.instructions,
          prompt: confirmation.casePrompt,
          maxOutputTokens: plan.generatorOutputTokensPerCall,
          plannedCostMicrousd: candidatePlannedCost,
        }),
      );
    }
    for (let repetition = 0; repetition < RELIABLE_REPETITIONS; repetition += 1) {
      baselines.push(
        await executeCall({
          store: input.store,
          runner: input.runner,
          callKey: `baseline-${repetition}`,
          model: generator,
          instructions: RELIABLE_BASELINE_INSTRUCTIONS,
          prompt: confirmation.casePrompt,
          maxOutputTokens: plan.generatorOutputTokensPerCall,
          plannedCostMicrousd: baselinePlannedCost,
        }),
      );
    }

    const candidateJudgements: QuickRubricJudgement[] = [];
    const baselineJudgements: QuickRubricJudgement[] = [];
    for (let repetition = 0; repetition < RELIABLE_REPETITIONS; repetition += 1) {
      candidateJudgements.push(
        await executeJudge({
          store: input.store,
          runner: input.runner,
          callKey: `judge-candidate-${repetition}`,
          model: judge,
          casePrompt: confirmation.casePrompt,
          rubric: confirmation.rubric,
          candidateOutput: candidates[repetition]!,
          maxOutputTokens: plan.judgeOutputTokensPerCall,
          plannedCostMicrousd: judgePlannedCost,
        }),
      );
      baselineJudgements.push(
        await executeJudge({
          store: input.store,
          runner: input.runner,
          callKey: `judge-baseline-${repetition}`,
          model: judge,
          casePrompt: confirmation.casePrompt,
          rubric: confirmation.rubric,
          candidateOutput: baselines[repetition]!,
          maxOutputTokens: plan.judgeOutputTokensPerCall,
          plannedCostMicrousd: judgePlannedCost,
        }),
      );
    }

    return input.store.complete({
      candidateScore: mean(candidateJudgements.map((judgement) => judgement.score)),
      baselineScore: mean(baselineJudgements.map((judgement) => judgement.score)),
      candidatePassRate: passRate(candidateJudgements),
      baselinePassRate: passRate(baselineJudgements),
    });
  } catch (error) {
    try {
      return await input.store.incomplete();
    } catch {
      throw error;
    }
  }
};
