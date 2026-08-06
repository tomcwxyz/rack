import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  patchGuardrailModuleSource,
  patchTaskModuleSource,
  readGuardrailModuleDraft,
  readTaskModuleDraft,
  type GuardrailModuleDraft,
  type ProjectSnapshot,
  type RackProject,
  type TaskModuleDraft,
} from "@rack/core";
import { SourceDiffReview } from "./SourceDiffReview.js";

type StructuredModule = Extract<
  RackProject["modules"][number],
  { type: "guardrail" | "task" }
>;

type EditorDraft =
  | { kind: "guardrail"; value: GuardrailModuleDraft }
  | { kind: "task"; value: TaskModuleDraft };

type GuidedStructuredEditorProps = {
  projectRoot: string;
  module: StructuredModule;
  onClose: () => void;
  onAdvanced: () => void;
  onSaved: (snapshot: ProjectSnapshot) => void;
};

const messageFor = (reason: unknown): string =>
  reason instanceof Error
    ? reason.message
    : typeof reason === "string"
      ? reason
      : "Rack could not prepare this instruction for guided editing.";

export function GuidedStructuredEditor({
  projectRoot,
  module,
  onClose,
  onAdvanced,
  onSaved,
}: GuidedStructuredEditorProps) {
  const [original, setOriginal] = useState("");
  const [draft, setDraft] = useState<EditorDraft | null>(null);
  const [step, setStep] = useState<"edit" | "review">("edit");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void invoke<string>("read_project_file", {
      root: projectRoot,
      relativePath: module.path,
    })
      .then((content) => {
        if (!active) return;
        setOriginal(content);
        setDraft(
          module.type === "guardrail"
            ? { kind: "guardrail", value: readGuardrailModuleDraft(content) }
            : { kind: "task", value: readTaskModuleDraft(content) },
        );
      })
      .catch((reason) => {
        if (active) setError(messageFor(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [module.path, module.type, projectRoot]);

  const proposal = useMemo(() => {
    if (!draft || !original) return null;
    try {
      return draft.kind === "guardrail"
        ? patchGuardrailModuleSource(original, draft.value)
        : patchTaskModuleSource(original, draft.value);
    } catch (reason) {
      return reason instanceof Error ? reason : new Error("The change is invalid.");
    }
  }, [draft, original]);

  const proposalError = proposal instanceof Error ? proposal.message : null;
  const canReview =
    proposal !== null &&
    !(proposal instanceof Error) &&
    proposal.content !== original;

  const save = async () => {
    if (!proposal || proposal instanceof Error) return;
    setSaving(true);
    setError(null);
    try {
      const snapshot = await invoke<ProjectSnapshot>("write_project_file", {
        root: projectRoot,
        relativePath: module.path,
        content: proposal.content,
        expectedContent: original,
      });
      onSaved(snapshot);
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setSaving(false);
    }
  };

  const updateGuardrail = <Key extends keyof GuardrailModuleDraft>(
    key: Key,
    value: GuardrailModuleDraft[Key],
  ) =>
    setDraft((current) =>
      current?.kind === "guardrail"
        ? { ...current, value: { ...current.value, [key]: value } }
        : current,
    );

  const updateTask = <Key extends keyof TaskModuleDraft>(
    key: Key,
    value: TaskModuleDraft[Key],
  ) =>
    setDraft((current) =>
      current?.kind === "task"
        ? { ...current, value: { ...current.value, [key]: value } }
        : current,
    );

  return (
    <div className="editor-backdrop" role="presentation">
      <section
        className="guided-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-structured-title"
      >
        <header className="source-editor-header">
          <div>
            <p className="eyebrow">
              {module.type === "guardrail"
                ? "Guided boundary editor"
                : "Guided task designer"}
            </p>
            <h2 id="guided-structured-title">
              {step === "edit" ? module.title : "Review the source change"}
            </h2>
            <code>{module.path}</code>
          </div>
          <button className="quiet-action" type="button" onClick={onClose}>
            Close
          </button>
        </header>

        <p className="editor-explanation">
          {module.type === "guardrail"
            ? "Maintain clear rules and refusal guidance without rewriting unrelated source settings."
            : "Maintain the task purpose, command, inputs and stages while keeping acceptance settings and other advanced fields intact."}
        </p>

        {error ? (
          <div className="notice notice--error" role="alert">
            <strong>The instruction was not saved.</strong>
            <span>{error}</span>
          </div>
        ) : null}

        {loading ? (
          <div className="editor-loading">Reading local source…</div>
        ) : draft && step === "edit" ? (
          <form
            className="guided-editor-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (canReview) setStep("review");
            }}
          >
            <div className="guided-form-scroll">
              {draft.kind === "guardrail" ? (
                <GuardrailFields draft={draft.value} update={updateGuardrail} />
              ) : (
                <TaskFields draft={draft.value} update={updateTask} />
              )}
            </div>

            {proposalError ? (
              <div className="notice notice--error" role="alert">
                <span>{proposalError}</span>
              </div>
            ) : null}

            <footer className="source-editor-actions">
              <button className="quiet-action" type="button" onClick={onAdvanced}>
                Edit advanced source instead
              </button>
              <button className="primary-action" type="submit" disabled={!canReview}>
                Review source change
              </button>
            </footer>
          </form>
        ) : draft && proposal && !(proposal instanceof Error) ? (
          <SourceDiffReview
            diff={proposal.diff}
            saving={saving}
            onBack={() => setStep("edit")}
            onSave={save}
          />
        ) : (
          <div className="notice notice--error" role="alert">
            <strong>Guided editing is not available for this source.</strong>
            <span>{proposalError ?? "Open the advanced editor to inspect it."}</span>
            <button className="quiet-action" type="button" onClick={onAdvanced}>
              Open advanced source editor
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

type GuardrailFieldsProps = {
  draft: GuardrailModuleDraft;
  update: <Key extends keyof GuardrailModuleDraft>(
    key: Key,
    value: GuardrailModuleDraft[Key],
  ) => void;
};

function GuardrailFields({ draft, update }: GuardrailFieldsProps) {
  const updateRule = (
    index: number,
    key: "id" | "statement" | "refusal",
    value: string,
  ) =>
    update(
      "rules",
      draft.rules.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, [key]: value } : rule,
      ),
    );

  return (
    <>
      <div className="form-grid">
        <label className="field">
          <span>Instruction title</span>
          <input
            autoFocus
            required
            value={draft.title}
            onChange={(event) => update("title", event.target.value)}
          />
        </label>
        <label className="field field--wide">
          <span>Short description</span>
          <textarea
            rows={3}
            value={draft.description}
            onChange={(event) => update("description", event.target.value)}
          />
        </label>
        <label className="field field--wide">
          <span>Overall boundary guidance</span>
          <textarea
            rows={5}
            required
            value={draft.body}
            onChange={(event) => update("body", event.target.value)}
          />
        </label>
      </div>

      <section className="repeatable-editor" aria-labelledby="boundary-rules-heading">
        <div className="repeatable-editor-heading">
          <div>
            <p className="eyebrow">Enforceable guidance</p>
            <h3 id="boundary-rules-heading">Boundary rules</h3>
          </div>
          <button
            className="quiet-action"
            type="button"
            onClick={() =>
              update("rules", [
                ...draft.rules,
                { id: "new-rule", statement: "", refusal: "" },
              ])
            }
          >
            Add a rule
          </button>
        </div>
        <div className="repeatable-rows">
          {draft.rules.map((rule, index) => (
            <div className="repeatable-row repeatable-row--stacked" key={`${rule.id}-${index}`}>
              <label className="field">
                <span>Rule ID</span>
                <input
                  required
                  value={rule.id}
                  onChange={(event) => updateRule(index, "id", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Rule statement</span>
                <textarea
                  rows={2}
                  required
                  value={rule.statement}
                  onChange={(event) =>
                    updateRule(index, "statement", event.target.value)
                  }
                />
              </label>
              <label className="field">
                <span>What to do when it cannot be followed</span>
                <textarea
                  rows={2}
                  value={rule.refusal}
                  onChange={(event) =>
                    updateRule(index, "refusal", event.target.value)
                  }
                />
              </label>
              <button
                className="remove-row-action"
                type="button"
                onClick={() =>
                  update(
                    "rules",
                    draft.rules.filter((_candidate, ruleIndex) => ruleIndex !== index),
                  )
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

type TaskFieldsProps = {
  draft: TaskModuleDraft;
  update: <Key extends keyof TaskModuleDraft>(
    key: Key,
    value: TaskModuleDraft[Key],
  ) => void;
};

function TaskFields({ draft, update }: TaskFieldsProps) {
  return (
    <>
      <div className="form-grid">
        <label className="field">
          <span>Task title</span>
          <input
            autoFocus
            required
            value={draft.title}
            onChange={(event) => update("title", event.target.value)}
          />
        </label>
        <label className="field">
          <span>Command</span>
          <input
            value={draft.command}
            onChange={(event) => update("command", event.target.value)}
            placeholder="draft-briefing"
          />
          <small>Optional. Used by destinations that support commands or skills.</small>
        </label>
        <label className="field field--wide">
          <span>Visible task label</span>
          <input
            required
            value={draft.label}
            onChange={(event) => update("label", event.target.value)}
          />
        </label>
        <label className="field field--wide">
          <span>Short description</span>
          <textarea
            rows={3}
            value={draft.description}
            onChange={(event) => update("description", event.target.value)}
          />
        </label>
        <label className="field field--wide">
          <span>Task instructions</span>
          <textarea
            rows={6}
            required
            value={draft.body}
            onChange={(event) => update("body", event.target.value)}
          />
        </label>
      </div>

      <TaskInputs draft={draft} update={update} />
      <TaskStages draft={draft} update={update} />
    </>
  );
}

function TaskInputs({ draft, update }: TaskFieldsProps) {
  return (
    <section className="repeatable-editor" aria-labelledby="task-inputs-heading">
      <div className="repeatable-editor-heading">
        <div>
          <p className="eyebrow">What the task needs</p>
          <h3 id="task-inputs-heading">Inputs</h3>
        </div>
        <button
          className="quiet-action"
          type="button"
          onClick={() =>
            update("inputs", [
              ...draft.inputs,
              { name: "new-input", label: "", type: "string", required: false },
            ])
          }
        >
          Add an input
        </button>
      </div>
      <div className="repeatable-rows">
        {draft.inputs.map((input, index) => (
          <div className="repeatable-row repeatable-row--input" key={`${input.name}-${index}`}>
            <label className="field">
              <span>Name</span>
              <input
                required
                value={input.name}
                onChange={(event) =>
                  update(
                    "inputs",
                    draft.inputs.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, name: event.target.value } : item,
                    ),
                  )
                }
              />
            </label>
            <label className="field">
              <span>Label</span>
              <input
                required
                value={input.label}
                onChange={(event) =>
                  update(
                    "inputs",
                    draft.inputs.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, label: event.target.value } : item,
                    ),
                  )
                }
              />
            </label>
            <label className="field">
              <span>Type</span>
              <select
                value={input.type}
                onChange={(event) =>
                  update(
                    "inputs",
                    draft.inputs.map((item, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            type: event.target.value as TaskModuleDraft["inputs"][number]["type"],
                          }
                        : item,
                    ),
                  )
                }
              >
                <option value="string">Short text</option>
                <option value="markdown">Long text or Markdown</option>
                <option value="number">Number</option>
                <option value="boolean">Yes or no</option>
              </select>
            </label>
            <label className="field field--checkbox">
              <input
                type="checkbox"
                checked={input.required}
                onChange={(event) =>
                  update(
                    "inputs",
                    draft.inputs.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, required: event.target.checked }
                        : item,
                    ),
                  )
                }
              />
              <span>Required</span>
            </label>
            <button
              className="remove-row-action"
              type="button"
              onClick={() =>
                update(
                  "inputs",
                  draft.inputs.filter((_candidate, itemIndex) => itemIndex !== index),
                )
              }
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function TaskStages({ draft, update }: TaskFieldsProps) {
  return (
    <section className="repeatable-editor" aria-labelledby="task-stages-heading">
      <div className="repeatable-editor-heading">
        <div>
          <p className="eyebrow">How the task proceeds</p>
          <h3 id="task-stages-heading">Stages</h3>
        </div>
        <button
          className="quiet-action"
          type="button"
          onClick={() =>
            update("stages", [
              ...draft.stages,
              { id: "new-stage", label: "" },
            ])
          }
        >
          Add a stage
        </button>
      </div>
      <div className="repeatable-rows">
        {draft.stages.map((stage, index) => (
          <div className="repeatable-row" key={`${stage.id}-${index}`}>
            <label className="field">
              <span>Stage ID</span>
              <input
                required
                value={stage.id}
                onChange={(event) =>
                  update(
                    "stages",
                    draft.stages.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, id: event.target.value } : item,
                    ),
                  )
                }
              />
            </label>
            <label className="field">
              <span>Stage label</span>
              <input
                required
                value={stage.label}
                onChange={(event) =>
                  update(
                    "stages",
                    draft.stages.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, label: event.target.value } : item,
                    ),
                  )
                }
              />
            </label>
            <button
              className="remove-row-action"
              type="button"
              onClick={() =>
                update(
                  "stages",
                  draft.stages.filter((_candidate, itemIndex) => itemIndex !== index),
                )
              }
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
