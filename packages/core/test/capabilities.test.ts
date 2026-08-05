import { describe, expect, it } from "vitest";
import { buildTarget, parseProjectSnapshot } from "../src/index.js";

const projectWith = (waived: boolean) =>
  parseProjectSnapshot({
    root: "/capabilities",
    manifest: {
      path: "rack.yaml",
      content: `
schema_version: "0.1"
name: capabilities
version: 0.1.0
title: Capabilities
author: { name: Example Author }
default_profile: coding
profiles: [coding]
`,
    },
    modules: [
      {
        path: "modules/tasks/required-command.md",
        content: `---
type: task
title: Required command
description: A task that must be installed as a real command.
harness:
  schema_version: "0.1"
  id: task.required-command
  version: 0.1.0
  applies_to: [code]
  capabilities:
    required: [commands]
  trigger:
    command: required-command
    label: Run the required command
---
Run this only where the destination can register a command.
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
description: Capability-sensitive coding work.
domains: [code]
include: [task.required-command]
overrides:
  emit_priority: {}
  target_waivers:
    codex: ${waived ? "[task.required-command]" : "[]"}
`,
      },
    ],
  });

describe("required destination capabilities", () => {
  it("blocks a destination that cannot provide a required capability", () => {
    const result = buildTarget(projectWith(false), "coding", "codex");
    expect(result.artifacts).toEqual([]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "RACK-TARGET-002", severity: "error" }),
    );
  });

  it("allows an explicit Set-up waiver and records a warning", () => {
    const result = buildTarget(projectWith(true), "coding", "codex");
    expect(result.artifacts).toHaveLength(1);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "RACK-TARGET-003", severity: "warning" }),
    );
  });
});
