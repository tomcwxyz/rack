import { describe, expect, it } from "vitest";
import { moduleFrontmatterSchema, profileSchema, rackManifestSchema } from "../src/index.js";

describe("Rack schemas", () => {
  it("accepts a minimal manifest", () => {
    expect(rackManifestSchema.safeParse({
      schema_version: "0.1",
      name: "example-rack",
      version: "0.1.0",
      title: "Example Rack",
      author: { name: "Example Author" },
      default_profile: "writing",
      profiles: ["writing"],
    }).success).toBe(true);
  });

  it("rejects an invalid module ID", () => {
    expect(moduleFrontmatterSchema.safeParse({
      type: "voice",
      title: "Tone",
      harness: { schema_version: "0.1", id: "Tone", version: "0.1.0" },
    }).success).toBe(false);
  });

  it("accepts a writing profile with a prompt budget", () => {
    expect(profileSchema.safeParse({
      schema_version: "0.1",
      id: "writing",
      title: "Writing",
      domains: ["writing"],
      include: ["voice.tone"],
      budgets: { prompt: { recommended_tokens: 10000, maximum_tokens: 16000 } },
    }).success).toBe(true);
  });
});
