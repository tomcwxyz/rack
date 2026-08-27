import { describe, expect, it } from "vitest";
import {
  setupInstructionSelection,
  updateSetupInstructionSelection,
} from "./sharedSetupSelection.js";

describe("shared practice Set-up selection", () => {
  it("shows binding shared practice as required regardless of local source state", () => {
    expect(
      setupInstructionSelection({
        moduleId: "guardrail.evidence",
        include: [],
        exclude: ["guardrail.evidence"],
        sharedBindingIds: ["guardrail.evidence"],
      }),
    ).toBe("binding");
  });

  it("shows an untouched adaptable shared instruction as a default", () => {
    expect(
      setupInstructionSelection({
        moduleId: "voice.plain",
        include: [],
        exclude: [],
        sharedAdaptableDefaultIds: ["voice.plain"],
      }),
    ).toBe("default");
  });

  it("lets a local exclusion override an adaptable shared default", () => {
    expect(
      setupInstructionSelection({
        moduleId: "voice.plain",
        include: [],
        exclude: ["voice.plain"],
        sharedAdaptableDefaultIds: ["voice.plain"],
      }),
    ).toBe("exclude");
  });

  it("can leave out a shared default without touching unrelated selections", () => {
    expect(
      updateSetupInstructionSelection(
        "voice.plain",
        "exclude",
        ["context.organisation"],
        ["task.old"],
      ),
    ).toEqual({
      include: ["context.organisation"],
      exclude: ["task.old", "voice.plain"],
    });
  });

  it("can return a local decision to the shared default", () => {
    expect(
      updateSetupInstructionSelection(
        "voice.plain",
        "default",
        ["voice.plain", "context.organisation"],
        [],
      ),
    ).toEqual({
      include: ["context.organisation"],
      exclude: [],
    });

    expect(
      updateSetupInstructionSelection(
        "voice.plain",
        "default",
        [],
        ["voice.plain"],
      ),
    ).toEqual({ include: [], exclude: [] });
  });
});
