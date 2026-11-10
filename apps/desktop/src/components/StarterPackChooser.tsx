import { useState } from "react";
import "../proposition-creation.css";
import {
  getStarterEntry,
  getStarterTemplate,
  type StarterTemplate,
} from "@rack/starter";
import type { StarterPackIntent } from "../creationStarterPack.js";
import type { CreationRouteId } from "./RouteChooser.js";

type StarterPackChooserProps = {
  route: CreationRouteId;
  onBack: () => void;
  onOpenExisting: () => void;
  onSelect: (
    templateId: string | null,
    intent: StarterPackIntent,
    moduleIds: string[] | null,
  ) => void;
};

const starterPackIds: Record<CreationRouteId, string[]> = {
  writing: ["clear-writing", "client-communication"],
  research: ["evidence-review", "decision-research"],
  coding: [
    "careful-code-change",
    "repository-review",
    "agent-code-handoff",
    "honey-lean-coding",
  ],
};

const routeCopy: Record<
  CreationRouteId,
  { eyebrow: string; title: string; intro: string }
> = {
  writing: {
    eyebrow: "Writing",
    title: "How would you like to start?",
    intro:
      "These are complete starting practices, not empty templates. Pick the closest fit and Rack will carry it into the Rack you create.",
  },
  research: {
    eyebrow: "Research and sense-making",
    title: "What kind of research practice fits best?",
    intro:
      "Start with a coherent approach to evidence and uncertainty. You can tune it now or learn what needs changing through use.",
  },
  coding: {
    eyebrow: "Software",
    title: "Choose a good way to work",
    intro:
      "Different coding work benefits from different discipline. Pick a starting practice and Rack will keep its ingredients and provenance inspectable.",
  },
};

const getPack = (id: string): StarterTemplate => {
  const template = getStarterTemplate(id);
  if (!template) throw new Error(`Missing Starter Pack ${id}`);
  return template;
};

export function StarterPackChooser({
  route,
  onBack,
  onOpenExisting,
  onSelect,
}: StarterPackChooserProps) {
  const packs = starterPackIds[route].map(getPack);
  const copy = routeCopy[route];
  const [customisingPackId, setCustomisingPackId] = useState<string | null>(null);
  const [showPacks, setShowPacks] = useState(false);
  const [customModules, setCustomModules] = useState<Set<string>>(new Set());

  const startCustomising = (pack: StarterTemplate) => {
    setCustomisingPackId(pack.id);
    setCustomModules(new Set(pack.moduleIds));
  };

  const toggleModule = (id: string, checked: boolean) => {
    setCustomModules((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <section className="starter-pack-chooser" aria-labelledby="starter-pack-title">
      <header className="route-header">
        <div>
          <p className="eyebrow">{copy.eyebrow} · good ways to start</p>
          <h1 id="starter-pack-title">{copy.title}</h1>
          <p className="lede">Choose a pack, load an existing RACK, or start with your own. All three lead into the same local workspace.</p>
        </div>
        <button className="quiet-action" type="button" onClick={onBack}>
          Choose different work
        </button>
      </header>

      <div className="starter-start-options" aria-label="Choose your starting point">
        <button type="button" className="starter-start-option" aria-expanded={showPacks} onClick={() => setShowPacks(value => !value)}><strong>Choose a pack</strong><span>Browse ready-made practices for {route} that you can edit later.</span><span className="starter-start-action">{showPacks ? "Hide packs" : "Browse packs"} →</span></button>
        <button type="button" className="starter-start-option" onClick={onOpenExisting}><strong>Load a RACK</strong><span>Open an existing {route} RACK from a folder on your computer.</span><span className="starter-start-action">Choose folder →</span></button>
        <button type="button" className="starter-start-option" onClick={() => onSelect(null, "tune", null)}><strong>Start from scratch</strong><span>Create a RACK using your own instructions and context.</span><span className="starter-start-action">Create your own →</span></button>
      </div>
      {showPacks ? <div className="starter-pack-grid">
        {packs.map((pack) => {
          const entries = pack.moduleIds
            .map((id) => getStarterEntry(id))
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
          const origins = [...new Set(entries.map((entry) => entry.sourceOrigin))];
          const licences = [...new Set(entries.map((entry) => entry.contentLicense))];
          const customising = customisingPackId === pack.id;
          const selectedCount = pack.moduleIds.filter((id) => customModules.has(id)).length;

          return (
            <article className="starter-pack-card" key={pack.id}>
              <div className="starter-pack-card__copy">
                <p className="eyebrow">{pack.route}</p>
                <h2>{pack.title}</h2>
                <p className="starter-pack-card__promise">
                  {pack.promise ?? pack.description}
                </p>
                {pack.bestFor?.length ? (
                  <div className="starter-pack-best-for">
                    <strong>Good for</strong>
                    <span>{pack.bestFor.join(" · ")}</span>
                  </div>
                ) : null}
              </div>

              <details className="starter-pack-details">
                <summary>Show me why</summary>
                <p>{pack.description}</p>
                <div className="starter-pack-ingredients">
                  {entries.map((entry) => (
                    <div key={entry.id}>
                      <strong>{entry.title}</strong>
                      <span>{entry.description}</span>
                    </div>
                  ))}
                </div>
                <p className="starter-pack-provenance">
                  {entries.length} inspectable practices · {licences.join(" + ")}
                  {origins.length > 1 || origins[0] !== "rack-starter"
                    ? ` · sources: ${origins.join(" · ")}`
                    : " · RACK Starter"}
                </p>
              </details>

              {customising ? (
                <div className="starter-pack-customise">
                  <div>
                    <strong>Choose what to keep</strong>
                    <span>
                      Start with everything selected. Remove anything that does not fit;
                      you can inspect exact source at final review.
                    </span>
                  </div>
                  <div className="starter-pack-customise__items">
                    {entries.map((entry) => (
                      <label key={entry.id}>
                        <input
                          type="checkbox"
                          checked={customModules.has(entry.id)}
                          onChange={(event) =>
                            toggleModule(entry.id, event.target.checked)
                          }
                        />
                        <span>
                          <strong>{entry.title}</strong>
                          <small>{entry.description}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="starter-pack-actions">
                    <button
                      className="primary-action"
                      type="button"
                      disabled={selectedCount === 0}
                      onClick={() =>
                        onSelect(
                          pack.id,
                          "tune",
                          pack.moduleIds.filter((id) => customModules.has(id)),
                        )
                      }
                    >
                      Use {selectedCount} selected
                    </button>
                    <button
                      className="quiet-action"
                      type="button"
                      onClick={() => {
                        setCustomisingPackId(null);
                        setCustomModules(new Set());
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="starter-pack-actions">
                  <button
                    className="primary-action"
                    type="button"
                    onClick={() => onSelect(pack.id, "use", [...pack.moduleIds])}
                  >
                    Use this
                  </button>
                  <button
                    className="quiet-action"
                    type="button"
                    onClick={() => startCustomising(pack)}
                  >
                    Change a few things
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div> : null}


    </section>
  );
}
