import { describe, expect, it } from "vitest";
import {
  parseProjectSnapshot,
  type ProjectSnapshot,
} from "@rack/core";
import {
  attachSharedPracticeContent,
  resolveAttachedSharedPractice,
} from "./sharedPractice.js";

const snapshot: ProjectSnapshot = {
  root: "/rack",
  manifest: {
    path: "rack.yaml",
    content: `schema_version: "0.1"
name: example-rack
version: 0.1.0
title: Example Rack
author:
  name: Example
default_profile: writing
profiles:
  - writing
`,
  },
  modules: [],
  profiles: [{
    path: "profiles/writing.yaml",
    content: `schema_version: "0.1"
id: writing
title: Writing
domains:
  - writing
include: []
exclude: []
`,
  }],
};

const shared = `format: rack.shared-practice
schema_version: "0.1"
id: organisation
version: 0.1.0
title: Organisation practice
published_by:
  name: Example Organisation
instructions:
  - type: guardrail
    title: Evidence boundary
    harness:
      schema_version: "0.2"
      id: guardrail.evidence
      version: 0.2.0
      criticality: required
      authority:
        mode: binding
        propagation: shared
        rationale: Evidence boundaries need to apply consistently.
      rules:
        - id: evidence
          statement: Distinguish evidence from inference.
    body: Distinguish evidence from inference.
`;

describe("desktop shared practice helper", () => {
  it("keeps a blocked attachment out of the effective project", () => {
    const project = parseProjectSnapshot(snapshot);
    const attachment = attachSharedPracticeContent({
      path: "/shared/bad.rack.yaml",
      content: "not: a shared practice file",
    });

    expect(attachment.materialization.blocked).toBe(true);
    expect(resolveAttachedSharedPractice(project, attachment)).toBeNull();
  });

  it("resolves an attached binding into the effective Set-up", () => {
    const project = parseProjectSnapshot(snapshot);
    const attachment = attachSharedPracticeContent({
      path: "/shared/org.rack.yaml",
      content: shared,
    });
    const resolved = resolveAttachedSharedPractice(project, attachment);

    expect(resolved?.project.profiles[0]?.include).toEqual([
      "guardrail.evidence",
    ]);
    expect(project.profiles[0]?.include).toEqual([]);
  });
});
