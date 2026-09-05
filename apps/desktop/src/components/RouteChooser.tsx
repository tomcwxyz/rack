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
    status: "Strong starting practice",
    description:
      "Help AI sound more like you, stay clear about evidence and avoid the habits you dislike.",
    includes: ["Audience and voice", "Language to avoid", "Evidence honesty"],
  },
  {
    id: "research",
    title: "Research and knowledge work",
    status: "Strong starting practice",
    description:
      "Help AI investigate carefully, separate evidence from inference and stay explicit about uncertainty and gaps.",
    includes: ["Research question", "Evidence and sources", "Method and gaps"],
  },
  {
    id: "coding",
    title: "Coding and technical work",
    status: "Strong starting practice",
    description:
      "Help AI understand the existing code, make restrained changes and verify important work before claiming it is done.",
    includes: ["Project and stack", "Implementation practice", "Safe verification"],
  },
];

export function RouteChooser({ onSelect, onCancel }: RouteChooserProps) {
  return (
    <section className="route-chooser" aria-labelledby="route-chooser-title">
      <header className="route-header">
        <div>
          <p className="eyebrow">Start with the work</p>
          <h1 id="route-chooser-title">What are you using AI for?</h1>
          <p className="lede">
            Choose the closest fit. Rack will give you a useful starting practice,
            then you can keep, change or leave out anything before it becomes yours.
          </p>
        </div>
        <button className="quiet-action" type="button" onClick={onCancel}>
          Back
        </button>
      </header>

      <div className="route-choice-grid">
        {routes.map((route) => (
          <article className="route-choice-card" key={route.id}>
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
              Use Rack for {route.id}
            </button>
          </article>
        ))}
      </div>

      <aside className="route-chooser-note">
        <strong>You do not need to design a system.</strong>
        <span>
          Start with Rack's suggestions. The underlying practice remains local,
          inspectable and editable whenever you want to go deeper.
        </span>
      </aside>
    </section>
  );
}
