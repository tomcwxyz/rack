import {
  materializeSharedPractice,
  resolvePracticeProject,
  type PracticeProjectResolution,
  type RackProject,
  type SharedPracticeMaterialization,
} from "@rack/core";

export type SharedPracticeFile = {
  path: string;
  content: string;
};

export type AttachedSharedPractice = {
  file: SharedPracticeFile;
  materialization: SharedPracticeMaterialization;
};

export const attachSharedPracticeContent = (
  file: SharedPracticeFile,
): AttachedSharedPractice => ({
  file,
  materialization: materializeSharedPractice(file.content, {
    sourceId: "attached-shared-practice",
    relationship: "other",
    precedence: 10,
    filePath: file.path,
  }),
});

export const resolveAttachedSharedPractice = (
  project: RackProject,
  attachment: AttachedSharedPractice | null,
): PracticeProjectResolution | null => {
  if (!attachment || attachment.materialization.blocked) return null;
  return resolvePracticeProject(
    project,
    attachment.materialization.candidates,
    {
      localSourceId: "local-rack",
      localLabel: project.manifest?.title ?? "This Rack",
    },
  );
};
