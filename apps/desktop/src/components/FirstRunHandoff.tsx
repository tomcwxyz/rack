import { useState } from "react";
import type { HostIntegrationId } from "@rack/core";

export type FirstRunHost = Extract<
  HostIntegrationId,
  "claude-code" | "codex" | "opencode"
>;
type Props = {
  coding: boolean;
  instructions: string;
  title: string;
  busy: boolean;
  onCopy: () => void;
  onExport: () => void;
  onSave: (title: string, host: FirstRunHost | null) => void;
};

export function FirstRunHandoff({
  coding,
  instructions,
  title,
  busy,
  onCopy,
  onExport,
  onSave,
}: Props) {
  const [destination, setDestination] = useState<"chat" | FirstRunHost>("chat");
  const [name, setName] = useState(title);
  const [showInstructions, setShowInstructions] = useState(false);
  return (
    <section className="first-run-card" aria-label="Use your approach">
      {coding ? (
        <label className="field">
          <span>Your AI tool</span>
          <select
            value={destination}
            disabled={busy}
            onChange={(event) =>
              setDestination(event.target.value as typeof destination)
            }
          >
            <option value="chat">An AI chat or another tool</option>
            <option value="claude-code">Claude Code</option>
            <option value="codex">Codex</option>
            <option value="opencode">OpenCode</option>
          </select>
        </label>
      ) : null}
      <h2>
        {destination === "chat"
          ? "Take your approach with you"
          : "Add it to your coding tool"}
      </h2>
      <p>
        {destination === "chat"
          ? "Copy these instructions into your AI conversation, then add the material you want to work on. You can also download them as a text file."
          : "Save your approach first. Then choose your work project and review the files rack will add. Nothing is installed until you approve it."}
      </p>
      <p className="first-run-note">
        These instructions guide the AI. They do not guarantee it will follow
        them, and copying them does not run any checks.
      </p>
      <details
        open={showInstructions}
        onToggle={(event) => setShowInstructions(event.currentTarget.open)}
      >
        <summary>Read the exact instructions</summary>
        <label className="field first-run-output">
          <span>Instructions to copy</span>
          <textarea
            readOnly
            rows={12}
            value={instructions}
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
      </details>
      <div className="button-row">
        <button
          className="primary-action"
          type="button"
          disabled={busy}
          onClick={() => {
            setShowInstructions(true);
            onCopy();
          }}
        >
          Copy instructions
        </button>
        <button
          className="quiet-action"
          type="button"
          disabled={busy}
          onClick={onExport}
        >
          Download instructions
        </button>
      </div>
      <details
        className="first-run-save"
        open={destination !== "chat" ? true : undefined}
      >
        <summary>
          {destination === "chat"
            ? "Save this approach for next time (optional)"
            : "Save and continue to tool setup"}
        </summary>
        <p>
          Choose a folder when you save. Your approach and task stay on this
          computer, ready to edit or reuse.
        </p>
        <label className="field">
          <span>Name</span>
          <input
            value={name}
            maxLength={100}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button
          className="secondary-action"
          type="button"
          disabled={busy || !name.trim()}
          onClick={() =>
            onSave(name.trim(), destination === "chat" ? null : destination)
          }
        >
          {busy
            ? "Please wait…"
            : destination === "chat"
              ? "Save and open my approach"
              : "Save and review tool setup"}
        </button>
      </details>
      <p className="first-run-note">
        After trying it, notice what helped and what you would change. You can
        refine the approach whenever you need to.
      </p>
    </section>
  );
}
