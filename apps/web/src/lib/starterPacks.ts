import {
  firstRunProposal, firstRunSnapshot, firstRunInstructions,
  type CreationRouteId, type FirstRunApproach,
} from "@rack/creation";
import { parseProjectSnapshot, type ProjectSourceFile } from "@rack/core";
import { planStarterImport } from "@rack/core/starter";
import { getStarterEntry, getStarterTemplate, starterTemplates } from "@rack/starter";

export { starterTemplates };

export function buildStarterPractice(route: CreationRouteId, task: string, approach: FirstRunApproach, starterPackId: string | null) {
  const base = firstRunProposal(route, task, approach);
  if (!starterPackId) return { proposal: base, instructions: firstRunInstructions(base, route) };
  const template = getStarterTemplate(starterPackId);
  if (!template || template.route !== route) throw new Error("Choose a starting point for this kind of work.");
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

export function getStarterPackSummary(starterPackId: string | null) {
  if (!starterPackId) return null;
  const template = getStarterTemplate(starterPackId);
  if (!template) return null;
  const practices = template.moduleIds.map(id => {
    const entry = getStarterEntry(id);
    if (!entry) throw new Error(`Missing starter practice: ${id}`);
    return { id: entry.id, title: entry.title, description: entry.description, type: entry.type };
  });
  return {
    title: template.title,
    promise: template.promise || template.description,
    bestFor: template.bestFor || [],
    practices,
  };
}
