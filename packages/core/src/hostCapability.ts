import {
  getHostIntegration,
  type HostIntegrationId,
  type HostSurfaceSupport,
} from "./hostIntegration.js";
import { buildHostRuntimePlan } from "./hostRuntime.js";
import type { CompiledProfile } from "./compiler.js";
import type { VerificationPlan } from "./verificationPlan.js";

export type HostCapabilityId =
  | "practice.standing-guidance"
  | "practice.on-demand-skill"
  | "context.transient-task"
  | "verification.pre-completion"
  | "verification.human-review";

export type HostCapabilityResolution =
  | "native"
  | "rack-provided"
  | "human"
  | "degraded"
  | "unavailable";

export type HostCapabilityNeed = {
  id: HostCapabilityId;
  count?: number;
  detail?: string;
};

export type HostCapabilityOutcome = HostCapabilityNeed & {
  title: string;
  resolution: HostCapabilityResolution;
  summary: string;
  consequence: string;
  preserved: boolean;
};

export type HostCapabilityPlan = {
  hostId: HostIntegrationId;
  displayName: string;
  outcomes: HostCapabilityOutcome[];
  hasDegradation: boolean;
  hasUnavailable: boolean;
  assurance: string;
};

type ResolutionFields = Omit<
  HostCapabilityOutcome,
  keyof HostCapabilityNeed | "title"
>;

const supportResolution = (
  support: HostSurfaceSupport,
  supported: ResolutionFields,
  planned: ResolutionFields,
  unavailable: ResolutionFields,
): ResolutionFields => {
  if (support === "supported") return supported;
  if (support === "planned") return planned;
  return unavailable;
};

export const deriveHostCapabilityNeeds = (
  compiled: CompiledProfile | null,
  verification: VerificationPlan | null,
): HostCapabilityNeed[] => {
  const needs: HostCapabilityNeed[] = [];

  if (compiled?.modules.length) {
    needs.push({
      id: "practice.standing-guidance",
      count: compiled.modules.length,
      detail:
        compiled.modules.length +
        (compiled.modules.length === 1
          ? " practice contributes to the standing Set-up."
          : " practices contribute to the standing Set-up."),
    });
  }

  const reusableTasks =
    compiled?.modules.filter(
      (module) =>
        module.type === "task" && Boolean(module.harness.trigger.command),
    ).length ?? 0;

  if (reusableTasks > 0) {
    needs.push({
      id: "practice.on-demand-skill",
      count: reusableTasks,
      detail:
        reusableTasks +
        (reusableTasks === 1
          ? " reusable task has a named command."
          : " reusable tasks have named commands."),
    });
  }

  needs.push({
    id: "context.transient-task",
    detail:
      "Task instructions and any reviewed TOPO context should stay temporary rather than becoming standing practice.",
  });

  if (verification) {
    const configuredChecks =
      verification.counts.automatic +
      verification.counts.judgement +
      verification.counts.taskSuites;
    const nonHumanUnconfigured = verification.unconfigured.filter(
      (item) => item.mode !== "human_review",
    ).length;

    if (configuredChecks > 0 || nonHumanUnconfigured > 0) {
      needs.push({
        id: "verification.pre-completion",
        count: configuredChecks + nonHumanUnconfigured,
        detail:
          configuredChecks +
          " configured verification step" +
          (configuredChecks === 1 ? "" : "s") +
          (nonHumanUnconfigured
            ? " and " +
              nonHumanUnconfigured +
              " declared check" +
              (nonHumanUnconfigured === 1 ? "" : "s") +
              " still needing configuration."
            : "."),
      });
    }

    const humanReviewCount =
      verification.counts.human +
      verification.unconfigured.filter((item) => item.mode === "human_review")
        .length;

    if (humanReviewCount > 0) {
      needs.push({
        id: "verification.human-review",
        count: humanReviewCount,
        detail:
          humanReviewCount +
          (humanReviewCount === 1
            ? " part of this Set-up requires human review."
            : " parts of this Set-up require human review."),
      });
    }
  }

  return needs;
};

export const resolveHostCapability = (
  hostId: HostIntegrationId,
  need: HostCapabilityNeed,
): HostCapabilityOutcome | null => {
  const host = getHostIntegration(hostId);
  if (!host) return null;

  if (need.id === "practice.standing-guidance") {
    return {
      ...need,
      title: "Standing practice",
      ...supportResolution(
        host.delivery.standingPractice,
        {
          resolution: "native",
          summary:
            "Installed as " + host.displayName + " project guidance.",
          consequence:
            "The enduring instructions in this Set-up are present whenever the AI works in the selected project.",
          preserved: true,
        },
        {
          resolution: "degraded",
          summary:
            "RACK can prepare the practice, but native " +
            host.displayName +
            " delivery is still being proved.",
          consequence:
            "The practice remains in your Rack. Review the generated hand-off rather than assuming the host will load it automatically.",
          preserved: true,
        },
        {
          resolution: "unavailable",
          summary:
            host.displayName +
            " has no proved standing-practice route in RACK yet.",
          consequence:
            "The practice remains in your Rack but is not applied to this host automatically.",
          preserved: false,
        },
      ),
    };
  }

  if (need.id === "practice.on-demand-skill") {
    if (host.delivery.onDemandPractice === "supported") {
      return {
        ...need,
        title: "Reusable tasks",
        resolution: "native",
        summary:
          "Available through " +
          host.displayName +
          "'s on-demand task surface.",
        consequence:
          "Named Rack tasks stay separate from standing guidance and can be invoked when they are useful.",
        preserved: true,
      };
    }

    if (hostId === "codex") {
      return {
        ...need,
        title: "Reusable tasks",
        resolution: "degraded",
        summary:
          "Codex receives these tasks as documented procedures rather than native commands.",
        consequence:
          "The task practice is still present in AGENTS.md, but it will not appear as a separate Rack command or skill.",
        preserved: true,
      };
    }

    return {
      ...need,
      title: "Reusable tasks",
      ...(host.delivery.onDemandPractice === "planned"
        ? {
            resolution: "degraded" as const,
            summary:
              "Native on-demand practice for " +
              host.displayName +
              " is still being proved.",
            consequence:
              "The task remains in your Rack and must be invoked manually until RACK has a reviewed native mapping.",
            preserved: true,
          }
        : {
            resolution: "unavailable" as const,
            summary:
              host.displayName + " has no on-demand Rack task surface.",
            consequence:
              "The task remains in your Rack but RACK cannot apply it as a host command or skill.",
            preserved: false,
          }),
    };
  }

  if (need.id === "context.transient-task") {
    const runtime = buildHostRuntimePlan(hostId);
    if (runtime?.status === "available") {
      return {
        ...need,
        title: "Task context",
        resolution: "rack-provided",
        summary: "RACK passes the task and reviewed context transiently.",
        consequence:
          "Task-specific material is sent for this run without being written into standing project instructions or canonical Rack source.",
        preserved: true,
      };
    }

    return {
      ...need,
      title: "Task context",
      resolution: "unavailable",
      summary:
        "A safe transient-context channel for " +
        host.displayName +
        " has not been proved yet.",
      consequence:
        "RACK will not silently persist task context as a workaround. Use a reviewed manual hand-off instead.",
      preserved: false,
    };
  }

  if (need.id === "verification.pre-completion") {
    if (host.delivery.verificationGate === "supported") {
      return {
        ...need,
        title: "Completion checks",
        resolution: "native",
        summary:
          host.displayName +
          " can carry the configured completion gate natively.",
        consequence:
          "Required verification can stop completion inside the host when its evidence is missing or fails.",
        preserved: true,
      };
    }

    return {
      ...need,
      title: "Completion checks",
      resolution: "rack-provided",
      summary: "RACK keeps verification outside the AI host.",
      consequence:
        "Configured checks and judgements still run through RACK. The host itself is not trusted to claim that those checks passed.",
      preserved: true,
    };
  }

  return {
    ...need,
    title: "Human review",
    resolution: "human",
    summary: "This part deliberately remains a human decision.",
    consequence:
      "RACK can collect and present the evidence, but it will not let the AI tool substitute its own judgement for the required human review.",
    preserved: true,
  };
};

export const buildHostCapabilityPlan = (
  hostId: HostIntegrationId,
  needs: readonly HostCapabilityNeed[],
): HostCapabilityPlan | null => {
  const host = getHostIntegration(hostId);
  if (!host) return null;

  const seen = new Set<HostCapabilityId>();
  const outcomes = needs.flatMap((need) => {
    if (seen.has(need.id)) return [];
    seen.add(need.id);
    const outcome = resolveHostCapability(hostId, need);
    return outcome ? [outcome] : [];
  });

  const hasUnavailable = outcomes.some(
    (outcome) => outcome.resolution === "unavailable",
  );
  const hasDegradation = outcomes.some(
    (outcome) => outcome.resolution === "degraded",
  );

  const assurance = hasUnavailable
    ? "Some parts of this practice cannot be applied to this AI tool yet. RACK keeps them visible instead of silently dropping them."
    : hasDegradation
      ? "The whole practice remains visible, but some parts change form on this AI tool. RACK calls those differences out explicitly."
      : "This practice can be carried across without silent loss. RACK-owned checks and human review stay outside the AI tool where that is the safer boundary.";

  return {
    hostId,
    displayName: host.displayName,
    outcomes,
    hasDegradation,
    hasUnavailable,
    assurance,
  };
};
