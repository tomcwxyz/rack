import { getStarterTemplate } from "@rack/starter";
import type { StarterPackIntent } from "../creationStarterPack.js";

type SelectedStarterPackProps = {
  templateId: string | null;
  moduleIds: string[] | null;
  intent: StarterPackIntent;
  onChange: () => void;
};

export function SelectedStarterPack({
  templateId,
  moduleIds,
  intent,
  onChange,
}: SelectedStarterPackProps) {
  const template = templateId ? getStarterTemplate(templateId) : null;

  return (
    <aside className="selected-starter-pack">
      <div>
        <p className="eyebrow">
          {template ? "Starting point" : "Starting from the basics"}
        </p>
        <strong>{template?.title ?? "Build your own practice"}</strong>
        <span>
          {template
            ? template.promise ?? template.description
            : "Rack will create the route basics and you can add practices afterwards."}
        </span>
        {template ? (
          <small>
            {moduleIds && moduleIds.length !== template.moduleIds.length
              ? `Using ${moduleIds.length} of ${template.moduleIds.length} pack practices. `
              : ""}
            {intent === "use"
              ? "Use this: Rack will accept the route defaults and take you straight to final review after the context questions."
              : "Change a few things: Rack will also pause on the local practice choices before final review."}
          </small>
        ) : null}
      </div>
      <button className="quiet-action" type="button" onClick={onChange}>
        Change starting point
      </button>
    </aside>
  );
}
