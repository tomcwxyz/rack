import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  parseOosContextPacket,
  type ContextObject,
  type ContextSnapshot,
} from "@rack/core";

type TopoCreationContextProps = {
  subject: string;
  purpose: string;
  onSubjectChange: (subject: string) => void;
  onUse: (text: string) => void;
};

const claimLabel = (object: ContextObject): string => {
  const key = object.value.key;
  return typeof key === "string" && key.trim() ? key : object.id;
};

const claimValue = (object: ContextObject): string => {
  const value = object.value.value;
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export function TopoCreationContext({
  subject,
  purpose,
  onSubjectChange,
  onUse,
}: TopoCreationContextProps) {
  const [snapshot, setSnapshot] = useState<ContextSnapshot | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedObjects = useMemo(
    () =>
      snapshot?.objects.filter((object) => selectedIds.includes(object.id)) ?? [],
    [selectedIds, snapshot],
  );

  const review = async () => {
    if (!subject.trim()) {
      setError("Enter the TOPO subject you want Rack to ask about.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const packet = await invoke<unknown>("topo_local_context", {
        subject: subject.trim(),
        purpose,
        maxItems: 20,
      });
      const next = parseOosContextPacket(packet, {
        subject: subject.trim(),
        purpose,
      });
      setSnapshot(next);
      setSelectedIds(next.objects.map((object) => object.id));
    } catch (reason) {
      setSnapshot(null);
      setSelectedIds([]);
      setError(
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Rack could not request TOPO context.",
      );
    } finally {
      setLoading(false);
    }
  };

  const useSelected = () => {
    const text = selectedObjects
      .map((object) => {
        const value = claimValue(object);
        return value
          ? claimLabel(object) + ": " + value
          : claimLabel(object);
      })
      .join("\n\n");

    if (text.trim()) onUse(text);
  };

  return (
    <section className="topo-creation-context" aria-label="Use TOPO context">
      <div className="topo-creation-heading">
        <div>
          <p className="eyebrow">TOPO memory</p>
          <strong>Start with context you already know</strong>
        </div>
        <span>Optional</span>
      </div>

      <p>
        Ask TOPO for memory about a subject, review exactly what it returns,
        then add only the items you want to this Rack.
      </p>

      <div className="topo-creation-request">
        <label className="field">
          <span>Context for</span>
          <input
            value={subject}
            onChange={(event) => {
              onSubjectChange(event.target.value);
              setSnapshot(null);
              setSelectedIds([]);
              setError(null);
            }}
            placeholder="project:my-project"
          />
          <small>
            Use the subject recorded in TOPO, for example project:rack or
            organisation:good-ship.
          </small>
        </label>
        <button
          className="quiet-action"
          type="button"
          onClick={() => void review()}
          disabled={loading || !subject.trim()}
        >
          {loading ? "Asking TOPO…" : snapshot ? "Refresh" : "Review TOPO context"}
        </button>
      </div>

      {error ? (
        <div className="notice notice--error topo-creation-error" role="alert">
          <span>{error}</span>
        </div>
      ) : null}

      {snapshot ? (
        snapshot.objects.length > 0 ? (
          <div className="topo-creation-review">
            <div className="topo-creation-review-heading">
              <span>
                {snapshot.objects.length} shareable{" "}
                {snapshot.objects.length === 1 ? "item" : "items"} found
              </span>
              <small>Review before adding anything to the Rack.</small>
            </div>
            <ul>
              {snapshot.objects.map((object) => {
                const selected = selectedIds.includes(object.id);
                const value = claimValue(object);
                return (
                  <li key={object.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) =>
                          setSelectedIds((current) =>
                            event.target.checked
                              ? [...current, object.id]
                              : current.filter((id) => id !== object.id),
                          )
                        }
                      />
                      <span>
                        <strong>{claimLabel(object)}</strong>
                        {value ? <small>{value}</small> : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="topo-creation-actions">
              <button
                className="secondary-action"
                type="button"
                onClick={useSelected}
                disabled={selectedObjects.length === 0}
              >
                Add selected to this Rack
              </button>
              <span>
                {selectedObjects.length} selected · TOPO remains the source of
                the original memory.
              </span>
            </div>
          </div>
        ) : (
          <p className="topo-creation-empty">
            TOPO found no shareable memory for this subject and purpose.
          </p>
        )
      ) : null}
    </section>
  );
}
