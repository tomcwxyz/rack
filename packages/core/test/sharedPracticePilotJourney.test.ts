import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildPrompt,
  createSharedPracticePublication,
  materializeSharedPractice,
  parseProjectSnapshot,
  resolvePracticeProject,
  type ProjectSnapshot,
} from "../src/index.js";

const fixtureFile = (
  side: "publisher" | "receiver",
  path: string,
): string =>
  readFileSync(
    new URL(
      `../../../test-fixtures/shared-practice-pilot/${side}/${path}`,
      import.meta.url,
    ),
    "utf8",
  );

const publisherSnapshot = (): ProjectSnapshot => ({
  root: "/pilot/publisher",
  manifest: {
    path: "rack.yaml",
    content: fixtureFile("publisher", "rack.yaml"),
  },
  modules: [
    "modules/guardrails/evidence.md",
    "modules/voice/plain.md",
    "modules/method/decision-notes.md",
    "modules/context/internal.md",
  ].map((path) => ({
    path,
    content: fixtureFile("publisher", path),
  })),
  profiles: [{
    path: "profiles/writing.yaml",
    content: fixtureFile("publisher", "profiles/writing.yaml"),
  }],
});

const receiverSnapshot = (leaveOutPlainLanguage = false): ProjectSnapshot => ({
  root: "/pilot/receiver",
  manifest: {
    path: "rack.yaml",
    content: fixtureFile("receiver", "rack.yaml"),
  },
  modules: [
    "modules/context/receiver.md",
    "modules/voice/plain.md",
  ].map((path) => ({
    path,
    content: fixtureFile("receiver", path),
  })),
  profiles: [{
    path: "profiles/writing.yaml",
    content: leaveOutPlainLanguage
      ? fixtureFile("receiver", "profiles/writing.yaml").replace(
          "exclude: []",
          "exclude:\n  - voice.plain",
        )
      : fixtureFile("receiver", "profiles/writing.yaml"),
  }],
});

const publishPilotPractice = () => {
  const publisher = parseProjectSnapshot(publisherSnapshot());
  expect(publisher.diagnostics).toEqual([]);

  const publication = createSharedPracticePublication(publisher, {
    id: "example-organisation",
    version: "1.0.0",
    title: "Example organisation practice",
    description: "Shared practice used by the pilot journey fixture.",
    publishedBy: {
      name: "Practice team",
      organisation: "Example Organisation",
    },
    license: "CC-BY-4.0",
    moduleIds: [
      "guardrail.evidence",
      "voice.plain",
      "method.decision-notes",
    ],
  });

  expect(publication.blocked).toBe(false);
  expect(publication.content).not.toBeNull();
  expect(publication.modules.map((module) => module.harness.id)).toEqual([
    "guardrail.evidence",
    "method.decision-notes",
    "voice.plain",
  ]);
  expect(publication.content).not.toContain("context.internal");

  return publication.content!;
};

const materializeForReceiver = (content: string) => {
  const materialized = materializeSharedPractice(content, {
    sourceId: "example-organisation",
    label: "Example Organisation",
    relationship: "organisation",
    precedence: 10,
    filePath: "/shared/example-organisation.rack.yaml",
  });

  expect(materialized.blocked).toBe(false);
  expect(materialized.diagnostics).toEqual([]);
  return materialized;
};

describe("shared-practice pilot journey", () => {
  it("publishes, receives and compiles binding and adaptable shared practice", () => {
    const shared = materializeForReceiver(publishPilotPractice());
    const receiver = parseProjectSnapshot(receiverSnapshot());
    expect(receiver.diagnostics).toEqual([]);

    const resolved = resolvePracticeProject(receiver, shared.candidates);
    const profile = resolved.project.profiles[0];

    expect(profile?.include).toEqual([
      "context.receiver",
      "guardrail.evidence",
      "method.decision-notes",
      "voice.plain",
    ]);
    expect(resolved.profileChanges[0]).toMatchObject({
      applicableBindingIds: ["guardrail.evidence"],
      applicableAdaptableDefaultIds: [
        "method.decision-notes",
        "voice.plain",
      ],
      addedBindingIds: ["guardrail.evidence"],
      addedAdaptableDefaultIds: [
        "method.decision-notes",
        "voice.plain",
      ],
    });

    const plain = resolved.resolution.instructions.find(
      (instruction) => instruction.module.harness.id === "voice.plain",
    );
    expect(plain?.provenance.kind).toBe("local");
    expect(plain?.module.body).toContain(
      "enough detail to explain consequential trade-offs",
    );

    const built = buildPrompt(resolved.project, "writing");
    expect(
      built.diagnostics.filter((diagnostic) => diagnostic.severity === "error"),
    ).toEqual([]);
    expect(built.artifact?.content).toContain(
      "Distinguish evidence from inference",
    );
    expect(built.artifact?.content).toContain(
      "enough detail to explain consequential trade-offs",
    );
    expect(built.artifact?.content).toContain(
      "record what was decided and the main reason",
    );
    expect(built.artifact?.content).not.toContain(
      "This private publisher context must never enter shared practice",
    );
  });

  it("lets a receiver leave out an adaptable default without weakening binding practice", () => {
    const shared = materializeForReceiver(publishPilotPractice());
    const receiver = parseProjectSnapshot(receiverSnapshot(true));
    const resolved = resolvePracticeProject(receiver, shared.candidates);

    expect(resolved.project.profiles[0]?.include).toEqual([
      "context.receiver",
      "guardrail.evidence",
      "method.decision-notes",
    ]);
    expect(resolved.project.profiles[0]?.exclude).toEqual(["voice.plain"]);
    expect(resolved.profileChanges[0]?.applicableAdaptableDefaultIds).toEqual([
      "method.decision-notes",
      "voice.plain",
    ]);
    expect(resolved.profileChanges[0]?.addedAdaptableDefaultIds).toEqual([
      "method.decision-notes",
    ]);

    const built = buildPrompt(resolved.project, "writing");
    expect(
      built.diagnostics.filter((diagnostic) => diagnostic.severity === "error"),
    ).toEqual([]);
    expect(built.artifact?.content).toContain(
      "Public-facing claims need a consistent evidence boundary",
    );
    expect(built.artifact?.content).toContain(
      "record what was decided and the main reason",
    );
    expect(built.artifact?.content).not.toContain(
      "enough detail to explain consequential trade-offs",
    );
    expect(receiver.profiles[0]?.exclude).toEqual(["voice.plain"]);
  });

  it("keeps experiment and review metadata intact through the full journey", () => {
    const shared = materializeForReceiver(publishPilotPractice());
    const receiver = parseProjectSnapshot(receiverSnapshot());
    const resolved = resolvePracticeProject(receiver, shared.candidates);
    const experiment = resolved.project.modules.find(
      (module) => module.harness.id === "method.decision-notes",
    );

    expect(experiment?.harness.authority).toMatchObject({
      mode: "adaptable",
      propagation: "shared",
      review_after: "2027-02-01",
    });
    expect(experiment?.harness.experiment?.question).toBe(
      "Do short decision notes reduce repeated discussion and lost context?",
    );
  });
});
