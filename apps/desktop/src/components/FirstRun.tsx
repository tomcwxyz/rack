import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { ProjectSnapshot } from "@rack/core";
import {
  firstRunApproaches,
  firstRunInstructions,
  firstRunProposal,
  type FirstRunApproach as Approach,
} from "../firstRun.js";
import type { CreationRouteId } from "./RouteChooser.js";
import { FirstRunApproach } from "./FirstRunApproach.js";
import { FirstRunHandoff, type FirstRunHost } from "./FirstRunHandoff.js";
import "../first-run.css";

type Props = {
  onOpen: () => void;
  opening: boolean;
  openError: string | null;
  onAdvanced: () => void;
  onCreated: (snapshot: ProjectSnapshot, host: FirstRunHost | null) => void;
};
type Step = "work" | "approach" | "handoff";
const workChoices: {
  id: CreationRouteId;
  title: string;
  description: string;
}[] = [
  {
    id: "writing",
    title: "Write something",
    description: "A report, an email, a clearer explanation.",
  },
  {
    id: "research",
    title: "Research something",
    description: "Explore a question, weigh evidence, compare options.",
  },
  {
    id: "coding",
    title: "Build something",
    description: "Make, improve or review software.",
  },
];
const errorMessage = (reason: unknown) =>
  reason instanceof Error
    ? reason.message
    : typeof reason === "string"
      ? reason
      : "Something went wrong. Please try again.";

export function FirstRun({
  onOpen,
  opening,
  openError,
  onAdvanced,
  onCreated,
}: Props) {
  const [step, setStep] = useState<Step>("work");
  const [route, setRoute] = useState<CreationRouteId>("writing");
  const [task, setTask] = useState("");
  const [approaches, setApproaches] = useState<
    Record<CreationRouteId, Approach>
  >(() => ({ ...firstRunApproaches }));
  const [adjusting, setAdjusting] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const approach = approaches[route];

  useEffect(() => {
    heading.current?.focus();
  }, [step]);

  const goTo = (next: Step) => {
    setError(null);
    setStatus(null);
    setStep(next);
  };
  const useApproach = () => {
    try {
      setInstructions(
        firstRunInstructions(firstRunProposal(route, task, approach), route),
      );
      goTo("handoff");
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };
  const perform = async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await action();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const copy = () =>
    void perform(async () => {
      try {
        await navigator.clipboard.writeText(instructions);
      } catch {
        throw new Error(
          "Copying was unavailable. Select the instructions above and copy them manually, or download the file.",
        );
      }
      setStatus(
        "Copied. Paste into your AI conversation, add your material and start working.",
      );
    });
  const download = () =>
    void perform(async () => {
      const path = await save({
        title: "Download your instructions",
        defaultPath: "my-ai-approach.md",
        filters: [{ name: "Markdown text", extensions: ["md"] }],
      });
      if (!path) return;
      await invoke("write_generated_file", { path, content: instructions });
      setStatus("Your instructions have been saved.");
    });
  const saveApproach = (title: string, host: FirstRunHost | null) =>
    void perform(async () => {
      const proposal = firstRunProposal(route, task, { ...approach, title });
      // Validate the exact source being saved, including the chosen name.
      firstRunInstructions(proposal, route);
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Choose where to save your approach",
      });
      const parentPath = Array.isArray(selected) ? selected[0] : selected;
      if (!parentPath) return;
      const snapshot = await invoke<ProjectSnapshot>("create_rack_project", {
        parentPath,
        folderName: proposal.folderName,
        files: proposal.files,
      });
      onCreated(snapshot, host);
    });

  return (
    <main className="first-run">
      <header className="first-run-header">
        <span className="wordmark">rack</span>
        <span>Build your AI working practices.</span>
        <button
          className="quiet-action"
          type="button"
          onClick={onOpen}
          disabled={busy || opening}
        >
          {opening ? "Opening…" : "Open a saved approach"}
        </button>
      </header>
      <div className="first-run-content">
        <p className="eyebrow">
          {step === "work"
            ? "A useful start, in a few minutes"
            : step === "approach"
              ? "Your approach · 2 of 3"
              : "Ready to use · 3 of 3"}
        </p>
        <h1 ref={heading} tabIndex={-1}>
          {step === "work"
            ? "What would you like help with?"
            : step === "approach"
              ? "Start with a good approach."
              : "Where will you use it?"}
        </h1>
        {step === "work" ? (
          <p className="lede">
            Choose your work. We’ll suggest a way for AI to help, ready for you
            to use or adjust.
          </p>
        ) : null}
        {error || openError ? (
          <div className="notice notice--error" role="alert">
            {error || openError}
          </div>
        ) : null}
        {status ? (
          <div className="notice notice--success" role="status">
            {status}
          </div>
        ) : null}
        {step === "work" ? (
          <>
            <label className="field first-run-task-input">
              <span>
                What are you working on? <small>(optional)</small>
              </span>
              <textarea
                rows={2}
                maxLength={4000}
                value={task}
                onChange={(event) => setTask(event.target.value)}
                placeholder="For example, a report for our trustees"
              />
            </label>
            <div className="first-run-choices">
              {workChoices.map((choice) => (
                <button
                  key={choice.id}
                  className="first-run-choice"
                  type="button"
                  onClick={() => {
                    setRoute(choice.id);
                    setAdjusting(false);
                    goTo("approach");
                  }}
                >
                  <strong>{choice.title}</strong>
                  <span>{choice.description}</span>
                  <span aria-hidden="true">→</span>
                </button>
              ))}
            </div>
            <p className="first-run-note">
              No account needed. Your draft stays here until you choose to copy,
              download or save it.
            </p>
            <button className="quiet-action" type="button" onClick={onAdvanced}>
              Explore packs and detailed setup
            </button>
          </>
        ) : null}
        {step === "approach" ? (
          <FirstRunApproach
            approach={approach}
            task={task}
            adjusting={adjusting}
            onAdjust={() => setAdjusting(true)}
            onChange={(next) =>
              setApproaches((current) => ({ ...current, [route]: next }))
            }
            onContinue={useApproach}
          />
        ) : null}
        {step === "handoff" ? (
          <FirstRunHandoff
            coding={route === "coding"}
            instructions={instructions}
            title={approach.title}
            busy={busy}
            onCopy={copy}
            onExport={download}
            onSave={saveApproach}
          />
        ) : null}
        {step !== "work" ? (
          <button
            className="quiet-action first-run-back"
            type="button"
            disabled={busy}
            onClick={() => goTo(step === "handoff" ? "approach" : "work")}
          >
            {step === "handoff" ? "Back to my approach" : "Back to my work"}
          </button>
        ) : null}
      </div>
    </main>
  );
}
