import {
  getStarterEntry,
  starterSourcesEqual,
  type StarterEntry,
} from "@rack/starter";
import type { ProjectSnapshot, ProjectSourceFile, RackProject } from "./index.js";
import {
  patchSetupSource,
  readSetupDraft,
  type SetupDraft,
} from "./profilePatching.js";
import type { SourceDiffLine } from "./sourcePatching.js";

export type StarterImportItemStatus = "ready" | "identical" | "changed" | "conflict";

export type StarterImportItem = {
  entry: StarterEntry;
  status: StarterImportItemStatus;
  destinationPath: string | null;
  existingPath: string | null;
  message: string;
};

export type StarterProfileChange = {
  path: string;
  before: string;
  after: string;
  diff: SourceDiffLine[];
};

export type StarterImportPlan = {
  items: StarterImportItem[];
  files: ProjectSourceFile[];
  profileId: string | null;
  profileChange: StarterProfileChange | null;
  blockedReasons: string[];
  blocked: boolean;
};

const moduleDestination = (entry: StarterEntry): string =>
  `modules/starter/${entry.fileName}`;

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

export const planStarterImport = (
  project: RackProject,
  snapshot: ProjectSnapshot,
  entryIds: readonly string[],
  profileId?: string | null,
): StarterImportPlan => {
  const ids = unique(entryIds.map((value) => value.trim()).filter(Boolean));
  if (ids.length === 0) throw new Error("Choose at least one Starter instruction.");

  const entries = ids.map((id) => {
    const entry = getStarterEntry(id);
    if (!entry) throw new Error(`Unknown Starter instruction: ${id}`);
    return entry;
  });

  const sourceByPath = new Map(snapshot.modules.map((file) => [file.path, file.content]));
  const moduleById = new Map(project.modules.map((module) => [module.harness.id, module]));
  const items: StarterImportItem[] = [];
  const files: ProjectSourceFile[] = [];
  const blockedReasons: string[] = [];

  for (const entry of entries) {
    const destinationPath = moduleDestination(entry);
    const existing = moduleById.get(entry.id);
    if (existing) {
      const existingSource = sourceByPath.get(existing.path);
      if (existingSource && starterSourcesEqual(existingSource, entry.source)) {
        items.push({
          entry,
          status: "identical",
          destinationPath: null,
          existingPath: existing.path,
          message: "Already present with identical source.",
        });
      } else {
        const reason = `${entry.title} already uses ${entry.id} with different local source.`;
        items.push({
          entry,
          status: "changed",
          destinationPath: null,
          existingPath: existing.path,
          message: reason,
        });
        blockedReasons.push(reason);
      }
      continue;
    }

    const occupiedPath = sourceByPath.get(destinationPath);
    if (occupiedPath !== undefined) {
      const reason = `${destinationPath} already exists with different Rack content.`;
      items.push({
        entry,
        status: "conflict",
        destinationPath,
        existingPath: destinationPath,
        message: reason,
      });
      blockedReasons.push(reason);
      continue;
    }

    items.push({
      entry,
      status: "ready",
      destinationPath,
      existingPath: null,
      message: `Will copy to ${destinationPath}.`,
    });
    files.push({ path: destinationPath, content: entry.source });
  }

  let profileChange: StarterProfileChange | null = null;
  const selectedProfileId = profileId?.trim() || null;
  if (selectedProfileId) {
    const profile = project.profiles.find((candidate) => candidate.id === selectedProfileId);
    if (!profile) throw new Error(`Unknown Set-up: ${selectedProfileId}`);
    const profileSource = snapshot.profiles.find((file) => file.path === profile.path);
    if (!profileSource) {
      throw new Error(`Could not read source for Set-up ${selectedProfileId}.`);
    }

    const draft = readSetupDraft(profileSource.content);
    const excluded = new Set(draft.exclude);
    const selectedIds = entries.map((entry) => entry.id);
    const excludedSelections = selectedIds.filter((id) => excluded.has(id));
    if (excludedSelections.length > 0) {
      blockedReasons.push(
        `The ${profile.title} Set-up explicitly excludes: ${excludedSelections.join(", ")}. Remove that exclusion before adding these Starter instructions.`,
      );
    } else {
      const nextDraft: SetupDraft = {
        ...draft,
        include: unique([...draft.include, ...selectedIds]),
      };
      const patched = patchSetupSource(profileSource.content, nextDraft);
      if (patched.content !== profileSource.content) {
        profileChange = {
          path: profile.path,
          before: profileSource.content,
          after: patched.content,
          diff: patched.diff,
        };
      }
    }
  }

  return {
    items,
    files,
    profileId: selectedProfileId,
    profileChange,
    blockedReasons: unique(blockedReasons),
    blocked: blockedReasons.length > 0,
  };
};
