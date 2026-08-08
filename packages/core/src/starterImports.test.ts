import { describe, expect, it } from "vitest";
import { getStarterEntry, getStarterTemplate } from "@rack/starter";
import { parseProjectSnapshot, type ProjectSnapshot } from "./index.js";
import { prepareTargetBuild } from "./build.js";
import { planStarterImport } from "./starterImports.js";

const manifest = `schema_version: "0.1"
name: starter-test
version: 0.1.0
title: Starter test
description: Test Rack
author:
  name: Test author
license: null
okf_root: modules
default_profile: default
profiles:
  - default
targets: {}
evaluation:
  config: eval/config.yaml
`;

const profile = `schema_version: "0.1"
id: default
title: Default
description: Test Set-up
domains:
  - writing
include: []
exclude: []
overrides:
  emit_priority: {}
  target_waivers: {}
budgets: {}
`;

const snapshot = (modules: ProjectSnapshot["modules"] = [], profileSource = profile): ProjectSnapshot => ({
  root: "/tmp/starter-test",
  manifest: { path: "rack.yaml", content: manifest },
  modules,
  profiles: [{ path: "profiles/default.yaml", content: profileSource }],
});

describe("Starter import planning", () => {
  it("plans new source and a loss-aware Set-up update", () => {
    const input = snapshot();
    const project = parseProjectSnapshot(input);
    const plan = planStarterImport(
      project,
      input,
      ["@rack-starter/voice.plain-language"],
      "default",
    );

    expect(plan.blocked).toBe(false);
    expect(plan.items[0]?.status).toBe("ready");
    expect(plan.files[0]?.path).toBe("modules/starter/voice-plain-language.md");
    expect(plan.profileChange?.after).toContain("@rack-starter/voice.plain-language");
    expect(plan.profileChange?.diff.some((line) => line.kind === "add")).toBe(true);
  });

  it("reports identical content without duplicating it", () => {
    const entry = getStarterEntry("@rack-starter/guardrail.evidence")!;
    const input = snapshot([{ path: "modules/shared/evidence.md", content: entry.source }]);
    const project = parseProjectSnapshot(input);
    const plan = planStarterImport(project, input, [entry.id]);

    expect(plan.blocked).toBe(false);
    expect(plan.items[0]?.status).toBe("identical");
    expect(plan.files).toHaveLength(0);
  });

  it("blocks a non-identical local module using the same ID", () => {
    const entry = getStarterEntry("@rack-starter/guardrail.evidence")!;
    const changed = entry.source.replace(
      "Use the strongest available evidence",
      "Use evidence differently",
    );
    const input = snapshot([{ path: "modules/shared/evidence.md", content: changed }]);
    const project = parseProjectSnapshot(input);
    const plan = planStarterImport(project, input, [entry.id]);

    expect(plan.blocked).toBe(true);
    expect(plan.items[0]?.status).toBe("changed");
    expect(plan.files).toHaveLength(0);
  });

  it("distinguishes an occupied import path from a changed known ID", () => {
    const entry = getStarterEntry("@rack-starter/guardrail.evidence")!;
    const other = getStarterEntry("@rack-starter/voice.accessible")!;
    const input = snapshot([
      { path: "modules/starter/guardrail-evidence.md", content: other.source },
    ]);
    const project = parseProjectSnapshot(input);
    const plan = planStarterImport(project, input, [entry.id]);

    expect(plan.blocked).toBe(true);
    expect(plan.items[0]?.status).toBe("conflict");
    expect(plan.files).toHaveLength(0);
  });

  it("compiles a reviewed Starter template through every installed destination pipeline", async () => {
    const input = snapshot();
    const project = parseProjectSnapshot(input);
    const template = getStarterTemplate("careful-code-change")!;
    const plan = planStarterImport(project, input, template.moduleIds, "default");

    expect(plan.blocked).toBe(false);
    const importedSnapshot: ProjectSnapshot = {
      ...input,
      modules: [...input.modules, ...plan.files],
      profiles: input.profiles.map((file) =>
        plan.profileChange && file.path === plan.profileChange.path
          ? { ...file, content: plan.profileChange.after }
          : file,
      ),
    };
    const imported = parseProjectSnapshot(importedSnapshot);
    expect(imported.diagnostics.filter((item) => item.severity === "error")).toHaveLength(0);

    const targets = [
      "prompt",
      "agents-md",
      "claude-code",
      "opencode",
      "codex",
    ] as const;
    for (const target of targets) {
      const build = await prepareTargetBuild(imported, "default", target);
      expect(
        build.diagnostics.filter((item) => item.severity === "error"),
        target,
      ).toHaveLength(0);
      expect(build.targetBuild.artifacts.length, target).toBeGreaterThan(0);
    }
  });

  it("does not silently reverse an explicit Set-up exclusion", () => {
    const excluded = profile.replace(
      "exclude: []",
      `exclude:
  - "@rack-starter/voice.plain-language"`,
    );
    const input = snapshot([], excluded);
    const project = parseProjectSnapshot(input);
    const plan = planStarterImport(
      project,
      input,
      ["@rack-starter/voice.plain-language"],
      "default",
    );

    expect(plan.blocked).toBe(true);
    expect(plan.blockedReasons[0]).toContain("explicitly excludes");
    expect(plan.profileChange).toBeNull();
  });
});
