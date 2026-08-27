export type CreationRouteId = "writing" | "research" | "coding";

type RouteChooserProps = {
  onSelect: (route: CreationRouteId) => void;
  onCancel: () => void;
};

const routes: Array<{
  id: CreationRouteId;
  title: string;
  status: string;
  description: string;
  includes: string[];
}> = [
  {
    id: "writing",
    title: "Writing and communications",
    status: "Proposition-first route",
    description:
      "Add your context, then react to suggested voice and evidence practice instead of writing everything from scratch.",
    includes: ["Audience and voice", "Language to avoid", "Evidence honesty"],
  },
  {
    id: "research",
    title: "Research and knowledge work",
    status: "Proposition-first route",
    description:
      "Add the research question and evidence context, then react to suggested method and uncertainty practice.",
    includes: ["Research question", "Evidence and sources", "Method and gaps"],
  },
  {
    id: "coding",
    title: "Coding and technical work",
    status: "Proposition-first route",
    description:
      "Add repository and stack context, then react to suggested implementation and safety practice.",
    includes: ["Project and stack", "Implementation practice", "Safe verification"],
  },
];

export function RouteChooser({ onSelect, onCancel }: RouteChooserProps) {
  return (
    <section className="route-chooser" aria-labelledby="route-chooser-title">
      <header className="route-header">
        <div>
          <p className="eyebrow">Choose a starting route</p>
          <h1 id="route-chooser-title">What kind of work should this Rack support?</h1>
          <p className="lede">
            Each route creates a small local starting point that you can inspect,
            edit and build for different AI tools. No account or model connection
            is needed.
          </p>
        </div>
        <button className="quiet-action" type="button" onClick={onCancel}>
          Back to Rack
        </button>
      </header>

      <div className="route-choice-grid">
        {routes.map((route) => (
          <article
            className="route-choice-card"
            key={route.id}
          >
            <div>
              <p className="eyebrow">{route.status}</p>
              <h2>{route.title}</h2>
              <p>{route.description}</p>
              <ul>
                {route.includes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <button
              className="primary-action"
              type="button"
              onClick={() => onSelect(route.id)}
            >
              Start with {route.id}
            </button>
          </article>
        ))}
      </div>

      <aside className="route-chooser-note">
        <strong>Start small.</strong>
        <span>
          A route is only a useful first assembly. The source remains yours and
          every instruction can be changed later.
        </span>
      </aside>
    </section>
  );
}
