import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  PracticeReviewDecision,
  PracticeReviewRecord,
} from "@rack/core";

export type PracticeReviewInput = {
  requestId: string;
  moduleId: string;
  moduleTitle: string;
  modulePath: string;
  reviewAfter: string;
  experimentQuestion: string | null;
  reflection: string;
  decision: PracticeReviewDecision;
};

export function usePracticeReviews(rackRoot: string) {
  const [reviews, setReviews] = useState<PracticeReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const value = await invoke<PracticeReviewRecord[]>(
        "read_practice_reviews",
        { rackRoot },
      );
      setReviews(value);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Rack could not read local practice-review history.",
      );
    } finally {
      setLoading(false);
    }
  }, [rackRoot]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (review: PracticeReviewInput) => {
      setError(null);
      try {
        const value = await invoke<PracticeReviewRecord[]>(
          "save_practice_review",
          { rackRoot, review },
        );
        setReviews(value);
        return value;
      } catch (reason) {
        const message =
          reason instanceof Error
            ? reason.message
            : typeof reason === "string"
              ? reason
              : "Rack could not save this practice review.";
        setError(message);
        throw new Error(message);
      }
    },
    [rackRoot],
  );

  return { reviews, loading, error, refresh, save };
}
