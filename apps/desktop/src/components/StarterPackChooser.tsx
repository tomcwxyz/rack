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
  onSelect: (templateId: string | null, intent: StarterPackIntent) => void;
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
  onSelect,
}: StarterPackChooserProps) {
  const packs = starterPackIds[route].map(getPack);
  const copy = routeCopy[route];

  return (
    <section className="starter-pack-chooser" aria-labelledby="starter-pack-title">
      <header className="route-header">
        <div>
          <p className="eyebrow">{copy.eyebrow} · good ways to start</p>
          <h1 id="starter-pack-title">{copy.title}</h1>
          <p className="lede">{copy.intro}</p>
        </div>
        <button className="quiet-action" type="button" onClick={onBack}>
          Choose different work
        </button>
      </header>

      <div className="starter-pack-grid">
        {packs.map((pack) => {
          const entries = pack.moduleIds
            .map((id) => getStarterEntry(id))
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
          const origins = [...new Set(entries.map((entry) => entry.sourceOrigin))];
          const licences = [...new Set(entries.map((entry) => entry.contentLicense))];

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

              <div className="starter-pack-actions">
                <button
                  className="primary-action"
                  type="button"
                  onClick={() => onSelect(pack.id, "use")}
                >
                  Use this
                </button>
                <button
                  className="quiet-action"
                  type="button"
                  onClick={() => onSelect(pack.id, "tune")}
                >
                  Change a few things
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <aside className="starter-pack-scratch">
        <div>
          <strong>None of these quite fit?</strong>
          <span>
            Start from the basic route and build your practice yourself. Nothing
            stops you adding a Starter Pack later.
          </span>
        </div>
        <button
          className="quiet-action"
          type="button"
          onClick={() => onSelect(null, "tune")}
        >
          Start from the basics
        </button>
      </aside>
    </section>
  );
}
