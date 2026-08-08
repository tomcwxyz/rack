import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openProject, readProjectSnapshot } from "./node.js";
import { planStarterImport } from "./starterImports.js";
import { applyStarterImport } from "./starterNode.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const makeProject = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "rack-starter-"));
  roots.push(root);
  await mkdir(path.join(root, "profiles"), { recursive: true });
  await writeFile(
    path.join(root, "rack.yaml"),
    `schema_version: "0.1"\nname: starter-node-test\nversion: 0.1.0\ntitle: Starter node test\ndescription: Test Rack\nauthor:\n  name: Test author\nlicense: null\nokf_root: modules\ndefault_profile: default\nprofiles:\n  - default\ntargets: {}\nevaluation:\n  config: eval/config.yaml\n`,
  );
  await writeFile(
    path.join(root, "profiles", "default.yaml"),
    `schema_version: "0.1"\nid: default\ntitle: Default\ndescription: Test Set-up\ndomains:\n  - writing\ninclude: []\nexclude: []\noverrides:\n  emit_priority: {}\n  target_waivers: {}\nbudgets: {}\n`,
  );
  return root;
};

describe("Starter Node import", () => {
  it("applies a reviewed import without replacing existing source", async () => {
    const root = await makeProject();
    const snapshot = await readProjectSnapshot(root);
    const project = await openProject(root);
    const plan = planStarterImport(
      project,
      snapshot,
      ["@rack-starter/voice.plain-language"],
      "default",
    );

    await applyStarterImport(root, plan);

    const imported = await readFile(
      path.join(root, "modules", "starter", "voice-plain-language.md"),
      "utf8",
    );
    expect(imported).toContain("@rack-starter/voice.plain-language");
    expect(await readFile(path.join(root, "profiles", "default.yaml"), "utf8")).toContain(
      "@rack-starter/voice.plain-language",
    );

    await expect(applyStarterImport(root, plan)).rejects.toThrow("now exists");
  });

  it("refuses to apply a blocked plan", async () => {
    const root = await makeProject();
    const snapshot = await readProjectSnapshot(root);
    const project = await openProject(root);
    const plan = planStarterImport(project, snapshot, ["@rack-starter/voice.plain-language"]);
    plan.blocked = true;
    plan.blockedReasons = ["blocked for test"];

    await expect(applyStarterImport(root, plan)).rejects.toThrow("blocked for test");
  });
});
