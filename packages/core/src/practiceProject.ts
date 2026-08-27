import {
  practiceSourceSchema,
  type PracticeSource,
  type RackModule,
} from "@rack/schemas";
import type {
  Diagnostic,
  RackProject,
  RackProjectProfile,
} from "./index.js";
import {
  resolvePracticeCandidates,
  type PracticeCandidate,
  type PracticeResolutionResult,
} from "./practiceResolution.js";

export type PracticeProjectResolutionOptions = {
  localSourceId?: string;
  localLabel?: string;
};

export type PracticeProfileChange = {
  profileId: string;
  addedBindingIds: string[];
  overriddenExclusionIds: string[];
};

export type PracticeProjectResolution = {
  project: RackProject;
  localSource: PracticeSource;
  resolution: PracticeResolutionResult;
  profileChanges: PracticeProfileChange[];
};

const appliesToProfile = (
  module: RackModule,
  profile: RackProjectProfile,
): boolean => {
  const appliesTo = module.harness.applies_to;
  return (
    appliesTo === "all" ||
    appliesTo.some((domain) => profile.domains.includes(domain))
  );
};

const sourceCarriesSharedAuthority = (source: PracticeSource): boolean =>
  source.kind !== "local" && source.kind !== "starter";

const uniqueSorted = (values: readonly string[]): string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

export const resolvePracticeProject = (
  project: RackProject,
  externalCandidates: readonly PracticeCandidate[],
  options: PracticeProjectResolutionOptions = {},
): PracticeProjectResolution => {
  const highestExternalPrecedence = externalCandidates.reduce(
    (highest, candidate) =>
      Math.max(highest, candidate.source.precedence),
    -1,
  );
  const localSource = practiceSourceSchema.parse({
    id: options.localSourceId?.trim() || "local-rack",
    label: options.localLabel?.trim() || "This Rack",
    kind: "local",
    precedence: highestExternalPrecedence + 1,
    path: project.root,
  });

  const localCandidates: PracticeCandidate[] = project.modules.map((module) => ({
    module,
    source: localSource,
  }));
  const resolution = resolvePracticeCandidates([
    ...externalCandidates,
    ...localCandidates,
  ]);

  const diagnostics: Diagnostic[] = [
    ...project.diagnostics,
    ...resolution.diagnostics,
  ];
  const profileChanges: PracticeProfileChange[] = [];

  const bindingInstructions = resolution.instructions.filter(
    (instruction) =>
      instruction.authority.mode === "binding" &&
      sourceCarriesSharedAuthority(instruction.provenance),
  );

  const profiles = project.profiles.map((profile) => {
    const applicable = bindingInstructions
      .filter((instruction) => appliesToProfile(instruction.module, profile))
      .sort((left, right) =>
        left.module.harness.id.localeCompare(right.module.harness.id),
      );
    const applicableIds = uniqueSorted(
      applicable.map((instruction) => instruction.module.harness.id),
    );
    const applicableIdSet = new Set(applicableIds);
    const included = new Set(profile.include);
    const excluded = new Set(profile.exclude);

    const addedBindingIds = applicableIds.filter((id) => !included.has(id));
    const overriddenExclusionIds = applicableIds.filter((id) => excluded.has(id));
    const ordinaryAdditions = addedBindingIds.filter(
      (id) => !excluded.has(id),
    );

    if (ordinaryAdditions.length > 0) {
      diagnostics.push({
        code: "RACK-PRACTICE-101",
        severity: "info",
        title: "Shared binding practice applies to this Set-up",
        message: `${profile.title} adds binding shared practice: ${ordinaryAdditions.join(", ")}.`,
        moduleIds: ordinaryAdditions,
        sourceIds: uniqueSorted(
          applicable
            .filter((instruction) =>
              ordinaryAdditions.includes(instruction.module.harness.id),
            )
            .map((instruction) => instruction.provenance.id),
        ),
      });
    }

    if (overriddenExclusionIds.length > 0) {
      diagnostics.push({
        code: "RACK-PRACTICE-102",
        severity: "warning",
        title: "A local exclusion cannot remove binding shared practice",
        message: `${profile.title} locally excludes ${overriddenExclusionIds.join(", ")}, but the resolved Rack includes ${overriddenExclusionIds.length === 1 ? "it" : "them"} because the shared source marks ${overriddenExclusionIds.length === 1 ? "this instruction" : "these instructions"} as binding. The local Set-up file is unchanged.`,
        moduleIds: overriddenExclusionIds,
        sourceIds: uniqueSorted(
          applicable
            .filter((instruction) =>
              overriddenExclusionIds.includes(instruction.module.harness.id),
            )
            .map((instruction) => instruction.provenance.id),
        ),
      });
    }

    profileChanges.push({
      profileId: profile.id,
      addedBindingIds,
      overriddenExclusionIds,
    });

    return {
      ...profile,
      include: [
        ...profile.include,
        ...addedBindingIds.filter((id) => !profile.include.includes(id)),
      ],
      exclude: profile.exclude.filter((id) => !applicableIdSet.has(id)),
    };
  });

  return {
    project: {
      ...project,
      modules: resolution.instructions.map((instruction) => instruction.module),
      profiles,
      diagnostics,
    },
    localSource,
    resolution,
    profileChanges,
  };
};
