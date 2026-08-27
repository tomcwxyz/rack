import {
  practiceAuthoritySchema,
  practiceSourceSchema,
  type PracticeAuthority,
  type PracticeSource,
  type RackModule,
} from "@rack/schemas";

export type PracticeCandidate = {
  module: RackModule;
  source: PracticeSource;
  authority?: PracticeAuthority;
};

export type ResolvedPracticeInstruction = {
  module: RackModule;
  authority: PracticeAuthority;
  provenance: PracticeSource;
  resolution: {
    bindingApplied: boolean;
    adaptationBlocked: boolean;
    supersededSourceIds: string[];
    discardedLocalOnlySourceIds: string[];
  };
};

export type PracticeResolutionDiagnostic = {
  code: string;
  severity: "error" | "warning" | "info";
  title: string;
  message: string;
  moduleIds?: string[];
  sourceIds?: string[];
};

export type PracticeResolutionResult = {
  instructions: ResolvedPracticeInstruction[];
  diagnostics: PracticeResolutionDiagnostic[];
};

type NormalisedCandidate = {
  module: RackModule;
  source: PracticeSource;
  authority: PracticeAuthority;
};

const normaliseCandidate = (
  candidate: PracticeCandidate,
): NormalisedCandidate => ({
  module: candidate.module,
  source: practiceSourceSchema.parse(candidate.source),
  authority: practiceAuthoritySchema.parse(
    candidate.authority ?? candidate.module.harness.authority ?? {},
  ),
});

const candidateOrder = (
  left: NormalisedCandidate,
  right: NormalisedCandidate,
): number =>
  left.source.precedence - right.source.precedence ||
  left.source.id.localeCompare(right.source.id) ||
  left.module.path.localeCompare(right.module.path);

const uniqueSorted = (values: string[]): string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

export const resolvePracticeCandidates = (
  candidates: readonly PracticeCandidate[],
): PracticeResolutionResult => {
  const diagnostics: PracticeResolutionDiagnostic[] = [];
  const byModuleId = new Map<string, NormalisedCandidate[]>();

  for (const rawCandidate of candidates) {
    const candidate = normaliseCandidate(rawCandidate);
    const moduleId = candidate.module.harness.id;
    const current = byModuleId.get(moduleId) ?? [];
    current.push(candidate);
    byModuleId.set(moduleId, current);
  }

  const instructions: ResolvedPracticeInstruction[] = [];

  for (const moduleId of [...byModuleId.keys()].sort((left, right) =>
    left.localeCompare(right),
  )) {
    const grouped = [...(byModuleId.get(moduleId) ?? [])].sort(candidateOrder);
    const discardedLocalOnly = grouped.filter(
      (candidate) =>
        candidate.source.kind !== "local" &&
        candidate.authority.propagation === "local-only",
    );
    const active = grouped.filter(
      (candidate) =>
        candidate.source.kind === "local" ||
        candidate.authority.propagation !== "local-only",
    );

    if (discardedLocalOnly.length > 0) {
      diagnostics.push({
        code: "RACK-PRACTICE-001",
        severity: "info",
        title: "Local-only shared instruction was not propagated",
        message: `${moduleId} included local-only practice from a non-local source. Rack ignored that candidate during resolution.`,
        moduleIds: [moduleId],
        sourceIds: uniqueSorted(
          discardedLocalOnly.map((candidate) => candidate.source.id),
        ),
      });
    }

    if (active.length === 0) continue;

    const byPrecedence = new Map<number, NormalisedCandidate[]>();
    for (const candidate of active) {
      const current = byPrecedence.get(candidate.source.precedence) ?? [];
      current.push(candidate);
      byPrecedence.set(candidate.source.precedence, current);
    }

    const ambiguous = [...byPrecedence.entries()].find(
      ([, samePrecedence]) => samePrecedence.length > 1,
    );

    if (ambiguous) {
      const [precedence, samePrecedence] = ambiguous;
      diagnostics.push({
        code: "RACK-PRACTICE-002",
        severity: "error",
        title: "Practice source precedence is ambiguous",
        message: `${moduleId} is provided by more than one source at precedence ${precedence}. Give those sources distinct precedence values before resolving the Rack.`,
        moduleIds: [moduleId],
        sourceIds: uniqueSorted(
          samePrecedence.map((candidate) => candidate.source.id),
        ),
      });
      continue;
    }

    const binding = active.filter(
      (candidate) => candidate.authority.mode === "binding",
    );

    const winner = binding.length > 0
      ? [...binding].sort(candidateOrder)[0]
      : [...active].sort(candidateOrder).at(-1);

    if (!winner) continue;

    const superseded = active.filter((candidate) => candidate !== winner);
    const adaptationBlocked =
      winner.authority.mode === "binding" &&
      active.some(
        (candidate) =>
          candidate.source.precedence > winner.source.precedence,
      );

    instructions.push({
      module: winner.module,
      authority: winner.authority,
      provenance: winner.source,
      resolution: {
        bindingApplied: winner.authority.mode === "binding",
        adaptationBlocked,
        supersededSourceIds: uniqueSorted(
          superseded.map((candidate) => candidate.source.id),
        ),
        discardedLocalOnlySourceIds: uniqueSorted(
          discardedLocalOnly.map((candidate) => candidate.source.id),
        ),
      },
    });
  }

  return { instructions, diagnostics };
};
