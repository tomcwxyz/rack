import { describe, expect, it } from "vitest";
import { buildTarget, parseProjectSnapshot } from "../src/index.js";

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
      path: "modules/context/repository.md",
      content: `---
type: context
title: Repository context
description: Understand the existing repository before changing it.
harness:
  schema_version: "0.1"
  id: context.repository
  version: 0.1.0
  context_kind: project
  applies_to: [code]
---
Inspect the architecture, conventions and tests before implementation.
`,
    },
    {
      path: "modules/guardrails/safety.md",
      content: `---
type: guardrail
title: Safe changes
description: Preserve important behaviour and private information.
harness:
  schema_version: "0.1"
  id: guardrail.safety
  version: 0.1.0
  criticality: required
  applies_to: [code]
  rules:
    - id: preserve
      statement: Do not remove existing behaviour without making the consequence explicit.
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
  applies_to: [code]
  requires:
    - id: guardrail.safety
    - id: context.repository
  trigger:
    command: implement-feature
    label: Implement a feature
  inputs:
    - name: specification
      label: Feature specification
      type: markdown
      required: true
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
  applies_to: [code]
  servers:
    - id: repository-search
      name: Repository search
      transport: stdio
      command: search-repository
---
Use tools only when they are available and authorised.
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

describe("supported host adapters", () => {
  it("builds Claude Code standing instructions and an on-demand skill", () => {
    const result = buildTarget(project, "coding", "claude-code");
    expect(result.diagnostics).toEqual([]);
    expect(result.artifacts.map((item) => item.path)).toEqual([
      "CLAUDE.md",
      ".claude/skills/implement-feature/SKILL.md",
    ]);
    expect(result.artifacts[0]?.content).toContain("Tools remain configuration expectations");
    expect(result.artifacts[1]?.content).toContain("disable-model-invocation: true");
    expect(result.artifacts[1]?.content).not.toContain("allowed-tools:");
  });

  it("builds OpenCode AGENTS.md and a project command", () => {
    const result = buildTarget(project, "coding", "opencode");
    expect(result.diagnostics).toEqual([]);
    expect(result.artifacts.map((item) => item.path)).toEqual([
      "AGENTS.md",
      ".opencode/commands/implement-feature.md",
    ]);
    expect(result.artifacts[1]?.content).toContain("$ARGUMENTS");
    expect(result.artifacts[1]?.content).not.toMatch(/\n(model|agent):/);
  });

  it("builds a Codex AGENTS.md with tasks as procedures", () => {
    const result = buildTarget(project, "coding", "codex");
    expect(result.diagnostics).toEqual([]);
    expect(result.artifacts.map((item) => item.path)).toEqual(["AGENTS.md"]);
    expect(result.artifacts[0]?.content).toContain("More deeply nested AGENTS.md files");
    expect(result.artifacts[0]?.content).toContain("reference only; this file does not install a command");
    expect(result.degradations.map((item) => item.capability)).toEqual([
      "commands",
      "tools",
    ]);
  });
});
