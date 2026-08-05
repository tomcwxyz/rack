import { describe, expect, it } from "vitest";
import { parseProjectSnapshot } from "../src/index.js";

describe("parseProjectSnapshot", () => {
  it("parses a small Rack and preserves source paths", () => {
    const project = parseProjectSnapshot({
      root: "/example",
      manifest: {
        path: "rack.yaml",
        content: `
schema_version: "0.1"
name: example-rack
version: 0.1.0
title: Example Rack
author: { name: Example Author }
default_profile: writing
profiles: [writing]
`,
      },
      modules: [
        { path: "modules/index.md", content: "# Example" },
        {
          path: "modules/voice/tone.md",
          content: `---
type: voice
title: Tone
harness:
  schema_version: "0.1"
  id: voice.tone
  version: 0.1.0
---
Write plainly.
`,
        },
      ],
      profiles: [
        {
          path: "profiles/writing.yaml",
          content: `
schema_version: "0.1"
id: writing
title: Writing
domains: [writing]
include: [voice.tone]
`,
        },
      ],
    });

    expect(project.manifest?.name).toBe("example-rack");
    expect(project.modules).toHaveLength(1);
    expect(project.modules[0]?.path).toBe("modules/voice/tone.md");
    expect(project.profiles[0]?.path).toBe("profiles/writing.yaml");
    expect(project.diagnostics).toEqual([]);
  });
});
