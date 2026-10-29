import { describe, expect, it } from "vitest";
import { loadPractices, persistPractices } from "./storage.js";

describe("local pilot storage", () => {
  it("roundtrips saved approaches without collecting model output", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } };
    const entry = { id: "example", route: "writing" as const, task: "Trustee report", approach: { title: "Writing", guidance: "Be concise", boundary: "No invented evidence" }, reviews: [], updatedAt: "2026-10-29T00:00:00Z" };
    persistPractices([entry], storage);
    expect(loadPractices(storage)).toEqual([entry]);
  });
  it("fails closed on broken browser storage", () => {
    expect(loadPractices({getItem: () => "broken"})).toEqual([]);
  });
});
