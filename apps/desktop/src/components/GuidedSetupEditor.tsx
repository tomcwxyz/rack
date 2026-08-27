import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  patchSetupSource,
  readSetupDraft,
  type ProjectSnapshot,
  type RackProject,
  type SetupDraft,
} from "@rack/core";
import {
  setupInstructionSelection,
  updateSetupInstructionSelection,
  type SetupInstructionSelection,
} from "../sharedSetupSelection.js";
import { SourceDiffReview } from "./SourceDiffReview.js";

type RackProfile = RackProject["profiles"][number];

type GuidedSetupEditorProps = {
  projectRoot: string;
  profile: RackProfile;
  modules: RackProject["modules"];
  sharedBindingIds?: string[];
  sharedAdaptableDefaultIds?: string[];
  onClose: () => void;
  onAdvanced: () => void;
  onSaved: (snapshot: ProjectSnapshot) => void;
};

const errorMessage = (reason: unknown): string =>
  reason instanceof Error
    ? reason.message
    : typeof reason === "string"
      ? reason
      : "Rack could not prepare this Set-up for guided editing.";

export function GuidedSetupEditor({
  projectRoot,
  profile,
  modules,
  sharedBindingIds = [],
  sharedAdaptableDefaultIds = [],
  onClose,
  onAdvanced,
  onSaved,
}: GuidedSetupEditorProps) {
  const [original, setOriginal] = useState("");
  const [draft, setDraft] = useState<SetupDraft | null>(null);
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
      relativePath: profile.path,
    })
      .then((content) => {
        if (!active) return;
        setOriginal(content);
        setDraft(readSetupDraft(content));
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [profile.path, projectRoot]);

  const proposal = useMemo(() => {
    if (!draft || !original) return null;
    try {
      return patchSetupSource(original, draft);
    } catch (reason) {
      return reason instanceof Error ? reason : new Error("The change is invalid.");
    }
  }, [draft, original]);

  const proposalError = proposal instanceof Error ? proposal.message : null;
  const canReview =
    proposal !== null &&
    !(proposal instanceof Error) &&
    proposal.content !== original;

  const update = <Key extends keyof SetupDraft>(
    key: Key,
    value: SetupDraft[Key],
  ) => setDraft((current) => (current ? { ...current, [key]: value } : current));

  const save = async () => {
    if (!proposal || proposal instanceof Error) return;
    setSaving(true);
    setError(null);
    try {
      const snapshot = await invoke<ProjectSnapshot>("write_project_file", {
        root: projectRoot,
        relativePath: profile.path,
        content: proposal.content,
        expectedContent: original,
      });
      onSaved(snapshot);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="editor-backdrop" role="presentation">
      <section
        className="guided-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-setup-title"
      >
        <header className="source-editor-header">
          <div>
            <p className="eyebrow">Guided Set-up editor</p>
            <h2 id="guided-setup-title">
              {step === "edit" ? profile.title : "Review the source change"}
            </h2>
            <code>{profile.path}</code>
          </div>
          <button className="quiet-action" type="button" onClick={onClose}>
            Close
          </button>
        </header>

        <p className="editor-explanation">
          Choose the work domains, root instructions and token budgets for this Set-up. Dependencies and destination capability checks are still resolved by Rack.
        </p>

        {error ? (
          <div className="notice notice--error" role="alert">
            <strong>The Set-up was not saved.</strong>
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
              <div className="form-grid">
                <label className="field">
                  <span>Set-up title</span>
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
                  <span>Work domains</span>
                  <textarea
                    rows={3}
                    value={draft.domains.join("\n")}
                    onChange={(event) =>
                      update("domains", event.target.value.split("\n"))
                    }
                    placeholder="One lowercase domain per line"
                  />
                  <small>Domains determine which instructions are eligible for this Set-up.</small>
                </label>
              </div>

              <InstructionSelection
                modules={modules}
                include={draft.include}
                exclude={draft.exclude}
                sharedBindingIds={sharedBindingIds}
                sharedAdaptableDefaultIds={sharedAdaptableDefaultIds}
                onChange={(include, exclude) => {
                  update("include", include);
                  update("exclude", exclude);
                }}
              />

              <BudgetEditor draft={draft} update={update} />
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
            <strong>Guided editing is not available for this Set-up.</strong>
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

type InstructionSelectionProps = {
  modules: RackProject["modules"];
  include: string[];
  exclude: string[];
  sharedBindingIds: string[];
  sharedAdaptableDefaultIds: string[];
  onChange: (include: string[], exclude: string[]) => void;
};

function InstructionSelection({
  modules,
  include,
  exclude,
  sharedBindingIds,
  sharedAdaptableDefaultIds,
  onChange,
}: InstructionSelectionProps) {
  return (
    <section className="repeatable-editor" aria-labelledby="setup-instructions-heading">
      <div className="repeatable-editor-heading">
        <div>
          <p className="eyebrow">Assemble the Set-up</p>
          <h3 id="setup-instructions-heading">Instructions</h3>
        </div>
        <span className="muted-copy">
          {include.length} included · {exclude.length} excluded
        </span>
      </div>
      <div className="setup-instruction-list">
        {modules.map((module) => {
          const id = module.harness.id;
          const isBindingShared = sharedBindingIds.includes(id);
          const isAdaptableShared = sharedAdaptableDefaultIds.includes(id);
          const state = setupInstructionSelection({
            moduleId: id,
            include,
            exclude,
            sharedBindingIds,
            sharedAdaptableDefaultIds,
          });
          return (
            <label className="setup-instruction-row" key={module.harness.id}>
              <span>
                <strong>{module.title}</strong>
                <code>{module.harness.id}</code>
                {isBindingShared ? (
                  <small>Required by shared practice.</small>
                ) : isAdaptableShared ? (
                  <small>
                    Shared default · keep it, adapt it locally or leave it out.
                  </small>
                ) : null}
              </span>
              <select
                aria-label={`${module.title} selection`}
                value={state}
                disabled={isBindingShared}
                onChange={(event) => {
                  const next = event.target.value as SetupInstructionSelection;
                  const changed = updateSetupInstructionSelection(
                    id,
                    next,
                    include,
                    exclude,
                  );
                  onChange(changed.include, changed.exclude);
                }}
              >
                {isBindingShared ? (
                  <option value="binding">Required by shared practice</option>
                ) : (
                  <>
                    <option value="unused">Not selected</option>
                    {isAdaptableShared ? (
                      <option value="default">Included by shared practice</option>
                    ) : null}
                    <option value="include">Include locally</option>
                    <option value="exclude">
                      {isAdaptableShared ? "Leave out" : "Exclude"}
                    </option>
                  </>
                )}
              </select>
            </label>
          );
        })}
      </div>
    </section>
  );
}

type BudgetEditorProps = {
  draft: SetupDraft;
  update: <Key extends keyof SetupDraft>(
    key: Key,
    value: SetupDraft[Key],
  ) => void;
};

function BudgetEditor({ draft, update }: BudgetEditorProps) {
  return (
    <section className="repeatable-editor" aria-labelledby="setup-budgets-heading">
      <div className="repeatable-editor-heading">
        <div>
          <p className="eyebrow">Keep packages proportionate</p>
          <h3 id="setup-budgets-heading">Token budgets</h3>
        </div>
        <button
          className="quiet-action"
          type="button"
          onClick={() =>
            update("budgets", [
              ...draft.budgets,
              { target: "prompt", recommendedTokens: 1200, maximumTokens: 2200 },
            ])
          }
        >
          Add a budget
        </button>
      </div>
      {draft.budgets.length === 0 ? (
        <p className="empty-editor-state">No destination-specific budgets are set.</p>
      ) : (
        <div className="repeatable-rows">
          {draft.budgets.map((budget, index) => (
            <div className="repeatable-row repeatable-row--budget" key={`${budget.target}-${index}`}>
              <label className="field">
                <span>Destination</span>
                <input
                  required
                  value={budget.target}
                  onChange={(event) =>
                    update(
                      "budgets",
                      draft.budgets.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, target: event.target.value } : item,
                      ),
                    )
                  }
                />
              </label>
              <label className="field">
                <span>Recommended</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={budget.recommendedTokens}
                  onChange={(event) =>
                    update(
                      "budgets",
                      draft.budgets.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, recommendedTokens: Number(event.target.value) }
                          : item,
                      ),
                    )
                  }
                />
              </label>
              <label className="field">
                <span>Maximum</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={budget.maximumTokens}
                  onChange={(event) =>
                    update(
                      "budgets",
                      draft.budgets.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, maximumTokens: Number(event.target.value) }
                          : item,
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
                    "budgets",
                    draft.budgets.filter((_candidate, itemIndex) => itemIndex !== index),
                  )
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
