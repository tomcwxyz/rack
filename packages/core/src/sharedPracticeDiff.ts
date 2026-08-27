import type { RackModule } from "@rack/schemas";

export type SharedPracticeChangeKind = "added" | "removed" | "changed";

export type SharedPracticeTighteningReason =
  | "new-binding"
  | "became-binding"
  | "new-required"
  | "criticality-increased"
  | "binding-review-removed"
  | "binding-review-deferred";

export type SharedPracticeChange = {
  moduleId: string;
  kind: SharedPracticeChangeKind;
  tightening: boolean;
  tighteningReasons: SharedPracticeTighteningReason[];
};

export type SharedPracticeDiff = {
  changed: boolean;
  tightening: boolean;
  tighteningModuleIds: string[];
  changes: SharedPracticeChange[];
};

const criticalityRank = {
  optional: 0,
  recommended: 1,
  required: 2,
} as const;

const authorityMode = (module: RackModule): "adaptable" | "binding" =>
  module.harness.authority?.mode ?? "adaptable";

const reviewAfter = (module: RackModule): string | null =>
  module.harness.authority?.review_after ?? null;

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableValue(child)]),
  );
};

const comparableModule = (module: RackModule): unknown => {
  const { path: _path, ...rest } = module;
  return stableValue(rest);
};

const modulesEqual = (left: RackModule, right: RackModule): boolean =>
  JSON.stringify(comparableModule(left)) === JSON.stringify(comparableModule(right));

const addedTightening = (
  module: RackModule,
): SharedPracticeTighteningReason[] => {
  const reasons: SharedPracticeTighteningReason[] = [];
  if (authorityMode(module) === "binding") reasons.push("new-binding");
  if (module.harness.criticality === "required") reasons.push("new-required");
  return reasons;
};

const changedTightening = (
  current: RackModule,
  incoming: RackModule,
): SharedPracticeTighteningReason[] => {
  const reasons: SharedPracticeTighteningReason[] = [];
  const currentMode = authorityMode(current);
  const incomingMode = authorityMode(incoming);

  if (currentMode !== "binding" && incomingMode === "binding") {
    reasons.push("became-binding");
  }

  if (
    criticalityRank[incoming.harness.criticality] >
    criticalityRank[current.harness.criticality]
  ) {
    reasons.push("criticality-increased");
  }

  if (incomingMode === "binding") {
    const currentReview = reviewAfter(current);
    const incomingReview = reviewAfter(incoming);

    if (currentReview && !incomingReview) {
      reasons.push("binding-review-removed");
    } else if (
      currentReview &&
      incomingReview &&
      incomingReview > currentReview
    ) {
      reasons.push("binding-review-deferred");
    }
  }

  return reasons;
};

export const compareSharedPracticeModules = (
  current: readonly RackModule[],
  incoming: readonly RackModule[],
): SharedPracticeDiff => {
  const currentById = new Map(
    current.map((module) => [module.harness.id, module]),
  );
  const incomingById = new Map(
    incoming.map((module) => [module.harness.id, module]),
  );
  const moduleIds = [...new Set([
    ...currentById.keys(),
    ...incomingById.keys(),
  ])].sort((left, right) => left.localeCompare(right));

  const changes: SharedPracticeChange[] = [];

  for (const moduleId of moduleIds) {
    const before = currentById.get(moduleId);
    const after = incomingById.get(moduleId);

    if (!before && after) {
      const tighteningReasons = addedTightening(after);
      changes.push({
        moduleId,
        kind: "added",
        tightening: tighteningReasons.length > 0,
        tighteningReasons,
      });
      continue;
    }

    if (before && !after) {
      changes.push({
        moduleId,
        kind: "removed",
        tightening: false,
        tighteningReasons: [],
      });
      continue;
    }

    if (!before || !after || modulesEqual(before, after)) continue;

    const tighteningReasons = changedTightening(before, after);
    changes.push({
      moduleId,
      kind: "changed",
      tightening: tighteningReasons.length > 0,
      tighteningReasons,
    });
  }

  const tighteningModuleIds = changes
    .filter((change) => change.tightening)
    .map((change) => change.moduleId);

  return {
    changed: changes.length > 0,
    tightening: tighteningModuleIds.length > 0,
    tighteningModuleIds,
    changes,
  };
};
