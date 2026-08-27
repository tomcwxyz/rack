import {
  compareSharedPracticeModules,
  materializeSharedPractice,
  resolvePracticeProject,
  type PracticeProjectResolution,
  type RackProject,
  type SharedPracticeDiff,
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

export type PersistedSharedPracticeState = {
  sourcePath: string;
  acceptedContent: string;
  declinedContent: string | null;
};

export type SharedPracticeLifecycleView = {
  accepted: AttachedSharedPractice | null;
  incoming: AttachedSharedPractice | null;
  diff: SharedPracticeDiff | null;
  declinedCurrent: boolean;
  sourceError: string | null;
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

export const acceptedStateFromFile = (
  file: SharedPracticeFile,
): PersistedSharedPracticeState => ({
  sourcePath: file.path,
  acceptedContent: file.content,
  declinedContent: null,
});

export const acceptSharedPracticeUpdate = (
  state: PersistedSharedPracticeState,
  incoming: SharedPracticeFile,
): PersistedSharedPracticeState => ({
  ...state,
  sourcePath: incoming.path,
  acceptedContent: incoming.content,
  declinedContent: null,
});

export const declineSharedPracticeUpdate = (
  state: PersistedSharedPracticeState,
  incoming: SharedPracticeFile,
): PersistedSharedPracticeState => ({
  ...state,
  declinedContent: incoming.content,
});

export const deriveSharedPracticeLifecycle = (
  state: PersistedSharedPracticeState | null,
  currentFile: SharedPracticeFile | null,
  sourceError: string | null = null,
): SharedPracticeLifecycleView => {
  if (!state) {
    return {
      accepted: null,
      incoming: null,
      diff: null,
      declinedCurrent: false,
      sourceError,
    };
  }

  const accepted = attachSharedPracticeContent({
    path: state.sourcePath,
    content: state.acceptedContent,
  });

  if (!currentFile || currentFile.content === state.acceptedContent) {
    return {
      accepted,
      incoming: null,
      diff: null,
      declinedCurrent: false,
      sourceError,
    };
  }

  if (
    state.declinedContent !== null &&
    currentFile.content === state.declinedContent
  ) {
    return {
      accepted,
      incoming: null,
      diff: null,
      declinedCurrent: true,
      sourceError,
    };
  }

  const incoming = attachSharedPracticeContent(currentFile);
  const diff =
    !accepted.materialization.blocked && !incoming.materialization.blocked
      ? compareSharedPracticeModules(
          accepted.materialization.modules,
          incoming.materialization.modules,
        )
      : null;

  return {
    accepted,
    incoming,
    diff,
    declinedCurrent: false,
    sourceError,
  };
};

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
