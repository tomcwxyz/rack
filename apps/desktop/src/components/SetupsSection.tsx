import { buildPrompt, type RackProject } from "@rack/core";

type SetupsSectionProps = {
  project: RackProject;
  selectedProfile: string;
  onEdit: (path: string, title: string) => void;
  onPreview: (profileId: string) => void;
};

export function SetupsSection({
  project,
  selectedProfile,
  onEdit,
  onPreview,
}: SetupsSectionProps) {
  return (
    <section aria-labelledby="setups-heading">
      <div className="section-heading section-heading--top">
        <div>
          <p className="eyebrow">Assemble for a purpose</p>
          <h2 id="setups-heading">Set-ups</h2>
        </div>
      </div>
      <p className="section-intro">
        A Set-up selects the instructions needed for a particular kind of work.
        Destinations are chosen separately.
      </p>
      <div className="setup-grid">
        {project.profiles.map((profile) => {
          const build = buildPrompt(project, profile.id);
          const blocked = build.diagnostics.some(
            (item) => item.severity === "error",
          );
          return (
            <article
              className={`setup-card ${selectedProfile === profile.id ? "setup-card--selected" : ""}`}
              key={profile.id}
            >
              <div>
                <p className="eyebrow">{profile.domains.join(" · ")}</p>
                <h3>{profile.title}</h3>
                <p>{profile.description}</p>
              </div>
              <dl className="setup-facts">
                <div>
                  <dt>Selected instructions</dt>
                  <dd>{build.compiled?.modules.length ?? 0}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{blocked ? "Blocked" : "Ready"}</dd>
                </div>
              </dl>
              <div className="setup-actions">
                <button
                  className="quiet-action"
                  type="button"
                  onClick={() => onEdit(profile.path, `${profile.title} Set-up`)}
                >
                  Edit Set-up source
                </button>
                <button
                  className="secondary-action"
                  type="button"
                  onClick={() => onPreview(profile.id)}
                >
                  Preview this Set-up
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
