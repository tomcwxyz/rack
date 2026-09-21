import { getStarterEntry, getStarterTemplate } from "@rack/starter";

type StarterPackReviewProps = {
  templateId: string | null;
  moduleIds: string[] | null;
};

export function StarterPackReview({
  templateId,
  moduleIds,
}: StarterPackReviewProps) {
  const template = templateId ? getStarterTemplate(templateId) : null;
  if (!template) return null;

  const selectedModuleIds = moduleIds ?? template.moduleIds;
  const entries = selectedModuleIds
    .map((id) => getStarterEntry(id))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  return (
    <section className="starter-pack-review" aria-labelledby="starter-pack-review-title">
      <div>
        <p className="eyebrow">Starting point to add</p>
        <h2 id="starter-pack-review-title">{template.title}</h2>
        <p>
          {template.promise ?? template.description} You are adding{" "}
          {selectedModuleIds.length} of {template.moduleIds.length} practices from
          this starting point. These are ordinary, inspectable Rack practices. Nothing in the pack can run code or install
          hooks by itself.
        </p>
      </div>

      <div className="starter-pack-review__items">
        {entries.map((entry) => (
          <details key={entry.id}>
            <summary>
              <span>
                <strong>{entry.title}</strong>
                <small>{entry.description}</small>
              </span>
              <small>{entry.contentLicense}</small>
            </summary>
            <p>
              Source: <code>{entry.sourceOrigin}</code>
            </p>
            <pre>{entry.source}</pre>
          </details>
        ))}
      </div>
    </section>
  );
}
