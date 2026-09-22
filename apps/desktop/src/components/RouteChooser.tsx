export type CreationRouteId = "writing" | "research" | "coding";

type RouteChooserProps = {
  onSelect: (route: CreationRouteId) => void;
  onCancel: () => void;
};

const routes: Array<{
  id: CreationRouteId;
  title: string;
  label: string;
  description: string;
  includes: string[];
}> = [
  {
    id: "writing",
    title: "Write something",
    label: "Writing",
    description:
      "Start with a clear, audience-aware way of writing. You can tune voice, evidence boundaries and the habits you want AI to avoid.",
    includes: ["Emails and messages", "Reports and explainers", "Rewriting and editing"],
  },
  {
    id: "research",
    title: "Research or make sense of something",
    label: "Research",
    description:
      "Start with a question-led research practice that checks sources, separates evidence from inference and keeps gaps visible.",
    includes: ["Evidence reviews", "Comparing options", "Briefings and synthesis"],
  },
  {
    id: "coding",
    title: "Build, change or review software",
    label: "Software",
    description:
      "Start with restrained coding practice: understand the codebase, make the smallest coherent change and verify important work before calling it done.",
    includes: ["Features and bug fixes", "Code review", "Agentic coding"],
  },
];

export function RouteChooser({ onSelect, onCancel }: RouteChooserProps) {
  return (
    <section className="route-chooser" aria-labelledby="route-chooser-title">
      <header className="route-header">
        <div>
          <p className="eyebrow">Start with the work</p>
          <h1 id="route-chooser-title">What do you want to do?</h1>
          <p className="lede">
            Pick the closest thing. Rack will give you a useful starting practice
            you can use immediately, tune a little, or inspect in detail when you
            want to know what is underneath.
          </p>
        </div>
        <button className="quiet-action" type="button" onClick={onCancel}>
          Back
        </button>
      </header>

      <div className="route-choice-grid">
        {routes.map((route) => (
          <article className={`route-choice-card route-choice-card--${route.id}`} key={route.id}>
            <div>
              <p className="eyebrow">{route.label}</p>
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
              Choose this
            </button>
          </article>
        ))}
      </div>

      <aside className="route-chooser-note">
        <strong>You do not need to know your “working practice” yet.</strong>
        <span>
          Start with something good, use it in real work, then shape it around what
          actually helps, what gets in the way and what you want AI to do differently.
        </span>
      </aside>
    </section>
  );
}
