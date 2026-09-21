import { invoke } from "@tauri-apps/api/core";
import {
  parseProjectSnapshot,
  type ProjectSnapshot,
} from "@rack/core";
import { planStarterImport } from "@rack/core/starter";
import { getStarterTemplate } from "@rack/starter";

export type StarterPackIntent = "use" | "tune";

export async function applyStarterPackToCreatedRack(
  snapshot: ProjectSnapshot,
  templateId: string | null,
  moduleIds: string[] | null = null,
): Promise<ProjectSnapshot> {
  if (!templateId) return snapshot;

  const template = getStarterTemplate(templateId);
  if (!template) {
    throw new Error(`Rack could not find the selected starting point: ${templateId}.`);
  }

  const project = parseProjectSnapshot(snapshot);
  const profileId =
    project.manifest?.default_profile ?? project.profiles[0]?.id ?? null;
  const plan = planStarterImport(
    project,
    snapshot,
    moduleIds ?? [...template.moduleIds],
    profileId,
  );

  if (plan.blocked) {
    throw new Error(
      `Rack created the project but could not add “${template.title}”: ${plan.blockedReasons.join(
        " ",
      )}`,
    );
  }

  const hasReadyFiles = plan.items.some((item) => item.status === "ready");
  if (!hasReadyFiles && !plan.profileChange) return snapshot;

  return invoke<ProjectSnapshot>("apply_starter_import", {
    root: project.root,
    files: plan.files,
    profileChange: plan.profileChange
      ? {
          path: plan.profileChange.path,
          before: plan.profileChange.before,
          after: plan.profileChange.after,
        }
      : null,
  });
}
