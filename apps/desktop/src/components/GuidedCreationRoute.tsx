import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { ProjectSnapshot } from "@rack/core";
import type { RackProposal } from "../projectFiles.js";

type StringFieldKey<Draft> = {
  [Key in keyof Draft]: Draft[Key] extends string ? Key : never;
}[keyof Draft] & string;

export type CreationField<Draft extends object> = {
  key: StringFieldKey<Draft>;
  label: string;
  kind?: "input" | "textarea";
  rows?: number;
  placeholder?: string;
  help?: string;
  optional?: boolean;
  wide?: boolean;
};

export type ReviewCard = {
  eyebrow: string;
  title: string;
  paragraphs: string[];
};

export type GuidedCreationConfig<Draft extends object> = {
  routeId: string;
  routeName: string;
  questionTitle: string;
  questionIntro: string;
  reviewIntro: string;
  setUpName: string;
  titleKey: StringFieldKey<Draft>;
  initialDraft: Draft;
  fields: CreationField<Draft>[];
  requiredKeys: StringFieldKey<Draft>[];
  buildProposal: (draft: Draft) => RackProposal;
  reviewCards: (draft: Draft) => ReviewCard[];
  proposalSummary: (proposal: RackProposal) => string;
};

type GuidedCreationRouteProps<Draft extends object> = {
  config: GuidedCreationConfig<Draft>;
  onCancel: () => void;
  onCreated: (snapshot: ProjectSnapshot) => void;
};

const readField = <Draft extends object>(
  draft: Draft,
  key: StringFieldKey<Draft>,
): string => draft[key] as string;

export function GuidedCreationRoute<Draft extends object>({
  config,
  onCancel,
  onCreated,
}: GuidedCreationRouteProps<Draft>) {
  const [draft, setDraft] = useState<Draft>(config.initialDraft);
  const [step, setStep] = useState<"questions" | "review">("questions");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const proposal = useMemo(
    () => config.buildProposal(draft),
    [config, draft],
  );
  const requiredComplete = config.requiredKeys.every(
    (key) => readField(draft, key).trim().length > 0,
  );

  const update = (key: StringFieldKey<Draft>, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const createRack = async () => {
    setError(null);
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Choose where to create this Rack",
    });

    const parentPath = Array.isArray(selected) ? selected[0] : selected;
    if (!parentPath) return;

    setSaving(true);
    try {
      const snapshot = await invoke<ProjectSnapshot>("create_rack_project", {
        parentPath,
        folderName: proposal.folderName,
        files: proposal.files,
      });
      onCreated(snapshot);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Rack could not create the project.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="route-shell" aria-labelledby={`${config.routeId}-title`}>
      <header className="route-header">
        <div>
          <p className="eyebrow">{config.routeName}</p>
          <h1 id={`${config.routeId}-title`}>
            {step === "questions"
              ? config.questionTitle
              : "Review the proposed Rack"}
          </h1>
          <p className="lede">
            {step === "questions" ? config.questionIntro : config.reviewIntro}
          </p>
        </div>
        <button className="quiet-action" type="button" onClick={onCancel}>
          Choose another route
        </button>
      </header>

      {error ? (
        <div className="notice notice--error" role="alert">
          <strong>Rack was not created.</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {step === "questions" ? (
        <form
          className="route-form"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (requiredComplete) setStep("review");
          }}
        >
          <div className="form-grid">
            {config.fields.map((field) => {
              const value = readField(draft, field.key);
              const className = `field ${field.wide !== false ? "field--wide" : ""}`;

              return (
                <label className={className} key={field.key}>
                  <span>{field.label}</span>
                  {field.kind === "input" ? (
                    <input
                      value={value}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        update(field.key, event.target.value)
                      }
                      placeholder={field.placeholder}
                      required={!field.optional}
                    />
                  ) : (
                    <textarea
                      rows={field.rows ?? 4}
                      value={value}
                      onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                        update(field.key, event.target.value)
                      }
                      placeholder={field.placeholder}
                      required={!field.optional}
                    />
                  )}
                  {field.help ? <small>{field.help}</small> : null}
                </label>
              );
            })}
          </div>

          <div className="route-actions">
            <span>{config.proposalSummary(proposal)}</span>
            <button
              className="primary-action"
              type="submit"
              disabled={!requiredComplete}
            >
              Review the proposal
            </button>
          </div>
        </form>
      ) : (
        <div className="proposal-review">
          <div className="proposal-summary">
            <div>
              <span>Rack</span>
              <strong>{readField(draft, config.titleKey)}</strong>
            </div>
            <div>
              <span>Folder</span>
              <code>{proposal.folderName}</code>
            </div>
            <div>
              <span>Set-up</span>
              <strong>{config.setUpName}</strong>
            </div>
          </div>

          <div className="proposal-grid">
            {config.reviewCards(draft).map((card) => (
              <article
                className="proposal-card"
                key={`${card.eyebrow}-${card.title}`}
              >
                <p className="eyebrow">{card.eyebrow}</p>
                <h2>{card.title}</h2>
                {card.paragraphs.filter(Boolean).map((paragraph, index) => (
                  <p key={`${card.title}-${index}`}>{paragraph}</p>
                ))}
              </article>
            ))}
          </div>

          <details className="file-plan">
            <summary>Show the files Rack will create</summary>
            <ul>
              {proposal.files.map((file) => (
                <li key={file.path}>
                  <code>{file.path}</code>
                </li>
              ))}
            </ul>
          </details>

          <div className="route-actions">
            <button
              className="quiet-action"
              type="button"
              onClick={() => setStep("questions")}
            >
              Edit the answers
            </button>
            <button
              className="primary-action"
              type="button"
              onClick={createRack}
              disabled={saving}
            >
              {saving ? "Creating…" : "Choose a folder and create Rack"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
