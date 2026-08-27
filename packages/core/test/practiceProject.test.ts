import { describe, expect, it } from "vitest";
import {
  moduleFrontmatterSchema,
  profileSchema,
  rackManifestSchema,
  type PracticeSource,
  type RackModule,
} from "@rack/schemas";
import { buildPrompt } from "../src/compiler.js";
import type { RackProject } from "../src/index.js";
import { resolvePracticeProject } from "../src/practiceProject.js";

const manifest = rackManifestSchema.parse({
  schema_version: "0.1",
  name: "example-rack",
  version: "0.1.0",
  title: "Example Rack",
  author: { name: "Example" },
  default_profile: "writing",
  profiles: ["writing"],
});

const moduleFor = (
  id: string,
  options: {
    body?: string;
    mode?: "adaptable" | "binding";
    appliesTo?: "all" | string[];
  } = {},
): RackModule => ({
  ...moduleFrontmatterSchema.parse({
    type: "context",
    title: id,
    harness: {
      schema_version: "0.2",
      id,
      version: "0.2.0",
      applies_to: options.appliesTo ?? "all",
      authority: {
        mode: options.mode ?? "adaptable",
        propagation: "shared",
        ...(options.mode === "binding"
          ? { rationale: "This shared boundary must apply." }
          : {}),
      },
    },
  }),
  path: `modules/${id}.md`,
  body: options.body ?? id,
});

const sharedSource: PracticeSource = {
  id: "organisation-practice",
  label: "Organisation practice",
  kind: "shared-file",
  relationship: "organisation",
  precedence: 10,
  path: "/shared/org.rack.yaml",
  version: "0.1.0",
};

const projectFor = (input: {
  modules?: RackModule[];
  include?: string[];
  exclude?: string[];
  domains?: string[];
} = {}): RackProject => ({
  root: "/rack",
  manifest,
  modules: input.modules ?? [],
  profiles: [{
    ...profileSchema.parse({
      schema_version: "0.1",
      id: "writing",
      title: "Writing",
      domains: input.domains ?? ["writing"],
      include: input.include ?? [],
      exclude: input.exclude ?? [],
    }),
    path: "profiles/writing.yaml",
  }],
  diagnostics: [],
});

describe("resolved practice projects", () => {
  it("injects a new applicable shared binding into the resolved Set-up and compiler", () => {
    const binding = moduleFor("guardrail.evidence", {
      mode: "binding",
      body: "Distinguish evidence from inference.",
    });
    const sourceProject = projectFor();

    const resolved = resolvePracticeProject(sourceProject, [{
      module: binding,
      source: sharedSource,
    }]);

    expect(sourceProject.profiles[0]?.include).toEqual([]);
    expect(resolved.project.profiles[0]?.include).toEqual([
      "guardrail.evidence",
    ]);
    expect(resolved.profileChanges[0]?.addedBindingIds).toEqual([
      "guardrail.evidence",
    ]);

    const built = buildPrompt(resolved.project, "writing");
    expect(built.artifact?.content).toContain(
      "Distinguish evidence from inference.",
    );
  });

  it("removes a local exclusion from the resolved copy when shared practice is binding", () => {
    const binding = moduleFor("guardrail.evidence", { mode: "binding" });
    const sourceProject = projectFor({
      exclude: ["guardrail.evidence"],
    });

    const resolved = resolvePracticeProject(sourceProject, [{
      module: binding,
      source: sharedSource,
    }]);

    expect(sourceProject.profiles[0]?.exclude).toEqual([
      "guardrail.evidence",
    ]);
    expect(resolved.project.profiles[0]?.exclude).toEqual([]);
    expect(resolved.project.profiles[0]?.include).toEqual([
      "guardrail.evidence",
    ]);
    expect(resolved.project.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "RACK-PRACTICE-102",
        severity: "warning",
        moduleIds: ["guardrail.evidence"],
        sourceIds: ["organisation-practice"],
      }),
    );
  });

  it("does not auto-inject a new adaptable shared instruction", () => {
    const adaptable = moduleFor("voice.plain");
    const resolved = resolvePracticeProject(projectFor(), [{
      module: adaptable,
      source: sharedSource,
    }]);

    expect(resolved.project.profiles[0]?.include).toEqual([]);
    expect(resolved.project.modules.map((module) => module.harness.id)).toEqual([
      "voice.plain",
    ]);
  });

  it("does not inject a binding instruction that does not apply to the Set-up domains", () => {
    const researchBinding = moduleFor("guardrail.research", {
      mode: "binding",
      appliesTo: ["research"],
    });
    const resolved = resolvePracticeProject(projectFor({
      domains: ["writing"],
    }), [{
      module: researchBinding,
      source: sharedSource,
    }]);

    expect(resolved.project.profiles[0]?.include).toEqual([]);
  });

  it("keeps local practice nearest for adaptable conflicts", () => {
    const local = moduleFor("voice.plain", { body: "Local wording." });
    const shared = moduleFor("voice.plain", { body: "Shared wording." });
    const resolved = resolvePracticeProject(projectFor({
      modules: [local],
      include: ["voice.plain"],
    }), [{
      module: shared,
      source: sharedSource,
    }]);

    expect(resolved.resolution.instructions[0]?.provenance.kind).toBe("local");
    expect(resolved.project.modules[0]?.body).toBe("Local wording.");
  });
});
