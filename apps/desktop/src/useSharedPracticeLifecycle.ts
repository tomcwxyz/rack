import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  acceptedStateFromFile,
  acceptSharedPracticeUpdate,
  attachSharedPracticeContent,
  declineSharedPracticeUpdate,
  deriveSharedPracticeLifecycle,
  type AttachedSharedPractice,
  type PersistedSharedPracticeState,
  type SharedPracticeFile,
} from "./sharedPractice.js";

export type SharedPracticeLifecycleController = ReturnType<
  typeof deriveSharedPracticeLifecycle
> & {
  loading: boolean;
  attachFile: (file: SharedPracticeFile) => Promise<AttachedSharedPractice>;
  refresh: () => Promise<void>;
  acceptIncoming: () => Promise<void>;
  declineIncoming: () => Promise<void>;
  detach: () => Promise<void>;
};

const messageFor = (reason: unknown): string =>
  reason instanceof Error
    ? reason.message
    : typeof reason === "string"
      ? reason
      : "Rack could not read the shared-practice source.";

export const useSharedPracticeLifecycle = (
  projectRoot: string,
): SharedPracticeLifecycleController => {
  const [persisted, setPersisted] =
    useState<PersistedSharedPracticeState | null>(null);
  const [currentFile, setCurrentFile] =
    useState<SharedPracticeFile | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const view = useMemo(
    () => deriveSharedPracticeLifecycle(persisted, currentFile, sourceError),
    [persisted, currentFile, sourceError],
  );

  const save = useCallback(
    async (state: PersistedSharedPracticeState | null) => {
      await invoke("write_shared_practice_state", {
        projectRoot,
        state,
      });
      setPersisted(state);
    },
    [projectRoot],
  );

  const readCurrent = useCallback(
    async (state: PersistedSharedPracticeState) => {
      try {
        const file = await invoke<SharedPracticeFile>(
          "read_shared_practice_file",
          { path: state.sourcePath },
        );
        setCurrentFile(file);
        setSourceError(null);
      } catch (reason) {
        setCurrentFile(null);
        setSourceError(messageFor(reason));
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const state = await invoke<PersistedSharedPracticeState | null>(
          "read_shared_practice_state",
          { projectRoot },
        );
        if (cancelled) return;
        setPersisted(state);

        if (state) {
          try {
            const file = await invoke<SharedPracticeFile>(
              "read_shared_practice_file",
              { path: state.sourcePath },
            );
            if (cancelled) return;
            setCurrentFile(file);
            setSourceError(null);
          } catch (reason) {
            if (cancelled) return;
            setCurrentFile(null);
            setSourceError(messageFor(reason));
          }
        } else {
          setCurrentFile(null);
          setSourceError(null);
        }
      } catch (reason) {
        if (!cancelled) {
          setPersisted(null);
          setCurrentFile(null);
          setSourceError(messageFor(reason));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [projectRoot]);

  const attachFile = useCallback(
    async (file: SharedPracticeFile): Promise<AttachedSharedPractice> => {
      const attachment = attachSharedPracticeContent(file);
      if (attachment.materialization.blocked) return attachment;

      const state = acceptedStateFromFile(file);
      await save(state);
      setCurrentFile(file);
      setSourceError(null);
      return attachment;
    },
    [save],
  );

  const refresh = useCallback(async () => {
    if (!persisted) return;
    setLoading(true);
    await readCurrent(persisted);
    setLoading(false);
  }, [persisted, readCurrent]);

  const acceptIncoming = useCallback(async () => {
    if (!persisted || !view.incoming || view.incoming.materialization.blocked) {
      return;
    }
    const next = acceptSharedPracticeUpdate(persisted, view.incoming.file);
    await save(next);
    setCurrentFile(view.incoming.file);
    setSourceError(null);
  }, [persisted, save, view.incoming]);

  const declineIncoming = useCallback(async () => {
    if (!persisted || !view.incoming) return;
    const next = declineSharedPracticeUpdate(persisted, view.incoming.file);
    await save(next);
  }, [persisted, save, view.incoming]);

  const detach = useCallback(async () => {
    await save(null);
    setCurrentFile(null);
    setSourceError(null);
  }, [save]);

  return {
    ...view,
    loading,
    attachFile,
    refresh,
    acceptIncoming,
    declineIncoming,
    detach,
  };
};
