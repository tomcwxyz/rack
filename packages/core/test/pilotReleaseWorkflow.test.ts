import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

type Step = {
  name?: string;
  uses?: string;
  with?: Record<string, unknown>;
};

type Workflow = {
  on?: Record<string, unknown>;
  jobs?: Record<
    string,
    {
      env?: Record<string, unknown>;
      strategy?: {
        matrix?: {
          include?: Array<Record<string, unknown>>;
        };
      };
      steps?: Step[];
    }
  >;
};

const workflow = parse(
  readFileSync(
    new URL("../../../.github/workflows/pilot-release.yml", import.meta.url),
    "utf8",
  ),
) as Workflow;

describe("pilot release workflow", () => {
  it("is manual-only and keeps signing preflight separate from native builds", () => {
    expect(workflow.on).toEqual(
      expect.objectContaining({ workflow_dispatch: expect.any(Object) }),
    );
    expect(Object.keys(workflow.on ?? {})).toEqual(["workflow_dispatch"]);

    const preflight = workflow.jobs?.preflight;
    expect(preflight).toBeDefined();
    expect(preflight?.env).toEqual(
      expect.objectContaining({
        WINDOWS_CERTIFICATE_SET: expect.any(String),
        WINDOWS_CERTIFICATE_PASSWORD_SET: expect.any(String),
        WINDOWS_TIMESTAMP_URL_SET: expect.any(String),
        APPLE_CERTIFICATE_SET: expect.any(String),
        APPLE_CERTIFICATE_PASSWORD_SET: expect.any(String),
        APPLE_API_KEY_SET: expect.any(String),
        APPLE_API_ISSUER_SET: expect.any(String),
        APPLE_API_KEY_BASE64_SET: expect.any(String),
      }),
    );
  });

  it("builds only the supported pilot desktop targets", () => {
    const matrix = workflow.jobs?.publish?.strategy?.matrix?.include ?? [];
    expect(matrix.map((entry) => entry.label)).toEqual([
      "Windows x64",
      "macOS Apple Silicon",
      "macOS Intel",
      "Linux x64",
    ]);
    expect(matrix.some((entry) => String(entry.platform).includes("ubuntu"))).toBe(
      false,
    );
  });

  it("pins Tauri Action and only creates draft pre-releases", () => {
    const steps = workflow.jobs?.publish?.steps ?? [];
    const release = steps.find((step) =>
      step.uses?.startsWith("tauri-apps/tauri-action@"),
    );

    expect(release?.uses).toBe(
      "tauri-apps/tauri-action@action-v1.0.0",
    );
    expect(release?.with).toEqual(
      expect.objectContaining({
        tagName: "rack-v__VERSION__",
        releaseDraft: true,
        prerelease: true,
        uploadUpdaterJson: false,
        uploadUpdaterSignatures: false,
        releaseAssetNamePattern:
          "[name]_[version]_[platform]_[arch][setup][ext]",
      }),
    );
  });

  it("contains explicit Windows signing and macOS notarisation setup", () => {
    const names = (workflow.jobs?.publish?.steps ?? [])
      .map((step) => step.name)
      .filter(Boolean);

    expect(names).toContain("Import Windows signing certificate");
    const windowsStep = (workflow.jobs?.publish?.steps ?? []).find(
      (step) => step.name === "Import Windows signing certificate",
    ) as (Step & { run?: string }) | undefined;
    expect(windowsStep?.run).toContain("wixVersion");
    expect(windowsStep?.run).toContain("version = $wixVersion");
    expect(names).toContain("Import macOS Developer ID certificate");
    expect(names).toContain("Prepare macOS notarisation key");
  });
});
