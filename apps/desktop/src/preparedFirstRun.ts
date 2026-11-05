import { parseProjectSnapshot, type ProjectSourceFile } from "@rack/core";
import { planStarterImport } from "@rack/core/starter";
import { getStarterTemplate, type StarterTemplate } from "@rack/starter";
import { firstRunProposal, firstRunSnapshot, firstRunInstructions, type FirstRunApproach } from "./firstRun.js";
import type { CreationRouteId } from "./components/RouteChooser.js";

export function preparedFirstRun(route: CreationRouteId, task: string, approach: FirstRunApproach, templateId: string | null) {
  const base = firstRunProposal(route, task, approach);
  if (!templateId) return { proposal: base, instructions: firstRunInstructions(base, route) };
  const template: StarterTemplate | undefined = getStarterTemplate(templateId);
  if (!template || template.route !== route) throw new Error("Choose a starting point for this type of work.");
  const snapshot = firstRunSnapshot(base);
  const project = parseProjectSnapshot(snapshot);
  const profileId = project.manifest?.default_profile ?? project.profiles[0]?.id ?? null;
  const plan = planStarterImport(project, snapshot, template.moduleIds, profileId);
  if (plan.blocked) throw new Error(plan.blockedReasons.join(" "));
  const files: ProjectSourceFile[] = base.files.map(file =>
    file.path === plan.profileChange?.path ? { ...file, content: plan.profileChange.after } : file
  );
  const proposal = { ...base, files: [...files, ...plan.files] };
  return { proposal, instructions: firstRunInstructions(proposal, route) };
}
