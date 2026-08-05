import { describe, expect, it } from "vitest";
import { buildAgentsMd, parseProjectSnapshot } from "../src/index.js";

const project = parseProjectSnapshot({
  root: "/coding",
  manifest: {
    path: "rack.yaml",
    content: `
schema_version: "0.1"
name: coding-rack
version: 0.1.0
title: Coding Rack
author: { name: Example Author }
default_profile: coding
profiles: [coding]
`,
  },
  modules: [
    {
      path: "modules/guardrails/safety.md",
      content: `---
type: guardrail
title: Safe changes
description: Preserve important existing behaviour.
harness:
  schema_version: "0.1"
  id: guardrail.safety
  version: 0.1.0
  criticality: required
  enforcement: [instruction]
  rules:
    - id: preserve
      statement: Preserve existing behaviour unless the change is explicit.
---
Review consequential changes before implementation.
`,
    },
    {
      path: "modules/tasks/implement.md",
      content: `---
type: task
title: Implement a feature
description: Implement an agreed feature carefully.
harness:
  schema_version: "0.1"
  id: task.implement
  version: 0.1.0
  requires:
    - id: guardrail.safety
  trigger:
    command: implement-feature
    label: Implement a feature
  inputs: []
  stages:
    - id: inspect
      label: Inspect the existing implementation
    - id: change
      label: Make the smallest coherent change
---
Use the existing architecture where it is sound.
`,
    },
    {
      path: "modules/tools/repository.md",
      content: `---
type: tools
title: Repository tools
description: Tools that may be configured by the host.
harness:
  schema_version: "0.1"
  id: tools.repository
  version: 0.1.0
  servers:
    - id: repository-search
      name: Repository search
      transport: stdio
      command: search-repository
---
Use repository tools only when they are available and authorised.
`,
    },
  ],
  profiles: [
    {
      path: "profiles/coding.yaml",
      content: `
schema_version: "0.1"
id: coding
title: Coding
description: Safe implementation guidance.
domains: [code]
include:
  - task.implement
  - tools.repository
`,
    },
  ],
});

describe("AGENTS.md adapter", () => {
  it("renders one deterministic portable file with explicit degradation", () => {
    const first = buildAgentsMd(project, "coding");
    const second = buildAgentsMd(project, "coding");

    expect(first.diagnostics).toEqual([]);
    expect(first.artifacts).toHaveLength(1);
    expect(first.artifacts[0]).toEqual(second.artifacts[0]);
    expect(first.artifacts[0]?.path).toBe("AGENTS.md");
    expect(first.artifacts[0]?.content).toContain(
      "Commands become procedures",
    );
    expect(first.artifacts[0]?.content).toContain(
      "reference only; this file does not install a command",
    );
    expect(first.artifacts[0]?.content).toContain(
      "nothing is started or authenticated by this file",
    );
    expect(first.artifacts[0]?.content).toContain(
      "Preserve existing behaviour unless the change is explicit.",
    );
    expect(first.degradations.map((item) => item.capability)).toEqual([
      "commands",
      "tools",
    ]);
  });
});
