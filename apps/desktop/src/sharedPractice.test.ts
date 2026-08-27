import { describe, expect, it } from "vitest";
import {
  parseProjectSnapshot,
  type ProjectSnapshot,
} from "@rack/core";
import {
  acceptedStateFromFile,
  acceptSharedPracticeUpdate,
  attachSharedPracticeContent,
  declineSharedPracticeUpdate,
  deriveSharedPracticeLifecycle,
  reconsiderSharedPracticeUpdate,
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


describe("shared practice lifecycle", () => {
  const acceptedFile = {
    path: "/shared/org.rack.yaml",
    content: shared,
  };

  it("keeps the accepted snapshot effective until an incoming update is accepted", () => {
    const state = acceptedStateFromFile(acceptedFile);
    const changed = {
      path: acceptedFile.path,
      content: shared
        .replace("version: 0.1.0", "version: 0.2.0")
        .replace(
          "mode: binding",
          "mode: adaptable",
        ),
    };

    const lifecycle = deriveSharedPracticeLifecycle(state, changed);

    expect(lifecycle.accepted?.materialization.document?.version).toBe("0.1.0");
    expect(lifecycle.incoming?.materialization.document?.version).toBe("0.2.0");
    expect(lifecycle.accepted?.file.content).toBe(shared);
    expect(lifecycle.incoming?.file.content).toBe(changed.content);
  });

  it("classifies tightening without applying it", () => {
    const adaptable = shared
      .replace("version: 0.1.0", "version: 0.2.0")
      .replace("mode: binding", "mode: adaptable");
    const state = acceptedStateFromFile({
      path: "/shared/org.rack.yaml",
      content: adaptable,
    });

    const lifecycle = deriveSharedPracticeLifecycle(state, acceptedFile);

    expect(lifecycle.diff?.tightening).toBe(true);
    expect(lifecycle.diff?.tighteningModuleIds).toEqual([
      "guardrail.evidence",
    ]);
    expect(lifecycle.accepted?.materialization.document?.version).toBe("0.2.0");
    expect(lifecycle.incoming?.materialization.document?.version).toBe("0.1.0");
  });

  it("remembers an exact declined update by content", () => {
    const state = acceptedStateFromFile(acceptedFile);
    const incoming = {
      path: acceptedFile.path,
      content: shared.replace("version: 0.1.0", "version: 0.2.0"),
    };
    const declined = declineSharedPracticeUpdate(state, incoming);
    const lifecycle = deriveSharedPracticeLifecycle(declined, incoming);

    expect(lifecycle.incoming).toBeNull();
    expect(lifecycle.declinedCurrent).toBe(true);
    expect(lifecycle.accepted?.materialization.document?.version).toBe("0.1.0");
  });

  it("can explicitly reconsider an exact declined update", () => {
    const state = acceptedStateFromFile(acceptedFile);
    const incoming = {
      path: acceptedFile.path,
      content: shared.replace("version: 0.1.0", "version: 0.2.0"),
    };
    const declined = declineSharedPracticeUpdate(state, incoming);
    const reconsidered = reconsiderSharedPracticeUpdate(declined);
    const lifecycle = deriveSharedPracticeLifecycle(reconsidered, incoming);

    expect(lifecycle.declinedCurrent).toBe(false);
    expect(lifecycle.incoming?.materialization.document?.version).toBe("0.2.0");
  });

  it("offers a newer file after a previously declined file changes again", () => {
    const state = acceptedStateFromFile(acceptedFile);
    const declinedFile = {
      path: acceptedFile.path,
      content: shared.replace("version: 0.1.0", "version: 0.2.0"),
    };
    const declined = declineSharedPracticeUpdate(state, declinedFile);
    const newer = {
      path: acceptedFile.path,
      content: shared.replace("version: 0.1.0", "version: 0.3.0"),
    };
    const lifecycle = deriveSharedPracticeLifecycle(declined, newer);

    expect(lifecycle.declinedCurrent).toBe(false);
    expect(lifecycle.incoming?.materialization.document?.version).toBe("0.3.0");
  });

  it("accepting an update replaces the accepted snapshot and clears decline memory", () => {
    const state = {
      ...acceptedStateFromFile(acceptedFile),
      declinedContent: "previously declined",
    };
    const incoming = {
      path: acceptedFile.path,
      content: shared.replace("version: 0.1.0", "version: 0.2.0"),
    };
    const accepted = acceptSharedPracticeUpdate(state, incoming);
    const lifecycle = deriveSharedPracticeLifecycle(accepted, incoming);

    expect(accepted.declinedContent).toBeNull();
    expect(lifecycle.incoming).toBeNull();
    expect(lifecycle.accepted?.materialization.document?.version).toBe("0.2.0");
  });

  it("continues using the accepted snapshot when the source cannot be read", () => {
    const state = acceptedStateFromFile(acceptedFile);
    const lifecycle = deriveSharedPracticeLifecycle(
      state,
      null,
      "The source file is unavailable.",
    );

    expect(lifecycle.accepted?.materialization.document?.version).toBe("0.1.0");
    expect(lifecycle.incoming).toBeNull();
    expect(lifecycle.sourceError).toBe("The source file is unavailable.");
  });

  it("keeps an invalid incoming file separate from the accepted snapshot", () => {
    const state = acceptedStateFromFile(acceptedFile);
    const lifecycle = deriveSharedPracticeLifecycle(state, {
      path: acceptedFile.path,
      content: "not: valid shared practice",
    });

    expect(lifecycle.accepted?.materialization.blocked).toBe(false);
    expect(lifecycle.incoming?.materialization.blocked).toBe(true);
    expect(lifecycle.diff).toBeNull();
  });
});
