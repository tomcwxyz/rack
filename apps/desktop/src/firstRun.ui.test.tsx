// @vitest-environment jsdom

import { afterEach, beforeEach, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { FirstRun } from "./components/FirstRun.js";
import { firstRunSnapshot } from "./firstRun.js";
const native = vi.hoisted(() => ({
  invoke: vi.fn(),
  open: vi.fn(),
  save: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: native.open,
  save: native.save,
}));
const copy = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: copy },
  });
  copy.mockResolvedValue(undefined);
  native.open.mockResolvedValue("/tmp/approaches");
  native.save.mockResolvedValue("/tmp/approach.md");
  native.invoke.mockImplementation(async (cmd, args) =>
    cmd === "create_rack_project"
      ? {
          ...firstRunSnapshot({
            folderName: args.folderName,
            files: args.files,
          }),
          root: "/tmp/approaches/" + args.folderName,
        }
      : undefined,
  );
});
afterEach(cleanup);
function start(label: string) {
  const created = vi.fn();
  render(
    <FirstRun
      onOpen={() => {}}
      opening={false}
      openError={null}
      onAdvanced={() => {}}
      onCreated={created}
    />,
  );
  expect(
    screen.getByRole("heading", { name: "What would you like help with?" }),
  ).toBe(document.activeElement);
  expect(native.invoke).not.toHaveBeenCalled();
  expect(native.open).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/What are you working on/), {
    target: { value: "A report for our trustees" },
  });
  fireEvent.click(screen.getByRole("button", { name: new RegExp(label) }));
  fireEvent.click(screen.getByRole("button", { name: "Adjust it" }));
  fireEvent.change(screen.getByLabelText("How should it approach the work?"), {
    target: { value: "Explain decisions with concrete examples." },
  });
  fireEvent.change(screen.getByLabelText("What should it take care with?"), {
    target: { value: "" },
  });
  expect(
    (
      screen.getByRole("button", {
        name: "Use this approach",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.change(screen.getByLabelText("What should it take care with?"), {
    target: { value: "Keep uncertainty visible." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Use this approach" }));
  expect(screen.getByRole("heading", { name: "Where will you use it?" })).toBe(
    document.activeElement,
  );
  expect(native.invoke).not.toHaveBeenCalled();
  expect(native.open).not.toHaveBeenCalled();
  return created;
}
for (const label of [
  "Write something",
  "Research something",
  "Build something",
])
  it(label + " reaches copy and saves the reviewed source", async () => {
    const created = start(label);
    fireEvent.click(screen.getByRole("button", { name: "Copy instructions" }));
    await screen.findByText(/Copied\. Paste/);
    const text = copy.mock.calls[0][0];
    expect(text).toContain("Explain decisions with concrete examples.");
    expect(text).toContain("Keep uncertainty visible.");
    expect(text).toContain("A report for our trustees");
    if (label === "Build something")
      fireEvent.change(screen.getByLabelText("Your AI tool"), {
        target: { value: "codex" },
      });
    else
      fireEvent.click(
        screen.getByText("Save this approach for next time (optional)"),
      );
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "My useful approach" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name:
          label === "Build something"
            ? "Save and review tool setup"
            : "Save and open my approach",
      }),
    );
    await waitFor(() => expect(created).toHaveBeenCalledTimes(1));
    expect(created.mock.calls[0][1]).toBe(
      label === "Build something" ? "codex" : null,
    );
    expect(
      created.mock.calls[0][0].modules.some((f: { content: string }) =>
        f.content.includes("Explain decisions with concrete examples."),
      ),
    ).toBe(true);
    expect(
      native.invoke.mock.calls.every(([cmd]) => cmd === "create_rack_project"),
    ).toBe(true);
  });
it("handles clipboard failure and download cancellation without discarding the draft", async () => {
  start("Write something");
  copy.mockRejectedValueOnce(Error("denied"));
  fireEvent.click(screen.getByRole("button", { name: "Copy instructions" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("alert").textContent).toContain("copy them manually");
  expect(
    screen.getByLabelText("Instructions to copy").closest("details")?.open,
  ).toBe(true);
  native.save.mockResolvedValueOnce(null);
  fireEvent.click(
    screen.getByRole("button", { name: "Download instructions" }),
  );
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Download instructions",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  expect(native.invoke).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Download instructions" }),
  );
  await screen.findByText("Your instructions have been saved.");
  expect(native.invoke).toHaveBeenCalledWith("write_generated_file", {
    path: "/tmp/approach.md",
    content: (
      screen.getByLabelText("Instructions to copy") as HTMLTextAreaElement
    ).value,
  });
});
it("allows cancelled saving and failed writes to be retried", async () => {
  const created = start("Research something");
  fireEvent.click(
    screen.getByText("Save this approach for next time (optional)"),
  );
  native.open.mockResolvedValueOnce(null);
  fireEvent.click(
    screen.getByRole("button", { name: "Save and open my approach" }),
  );
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Save and open my approach",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  expect(created).not.toHaveBeenCalled();
  expect(native.invoke).not.toHaveBeenCalled();
  native.invoke.mockRejectedValueOnce(Error("Permission denied"));
  fireEvent.click(
    screen.getByRole("button", { name: "Save and open my approach" }),
  );
  await screen.findByRole("alert");
  expect(screen.getByRole("alert").textContent).toContain("Permission denied");
  fireEvent.click(
    screen.getByRole("button", { name: "Save and open my approach" }),
  );
  await waitFor(() => expect(created).toHaveBeenCalledTimes(1));
});
it("retains adjusted practice when going back and switching work", () => {
  start("Write something");
  fireEvent.click(screen.getByRole("button", { name: "Back to my approach" }));
  expect(
    (
      screen.getByLabelText(
        "How should it approach the work?",
      ) as HTMLTextAreaElement
    ).value,
  ).toContain("Explain decisions");
  fireEvent.click(screen.getByRole("button", { name: "Back to my work" }));
  fireEvent.click(screen.getByRole("button", { name: /Research something/ }));
  fireEvent.click(screen.getByRole("button", { name: "Back to my work" }));
  fireEvent.click(screen.getByRole("button", { name: /Write something/ }));
  expect(
    screen.getByText("Explain decisions with concrete examples."),
  ).toBeDefined();
});

it("keeps an opening error on the work screen only", () => {
  render(
    <FirstRun
      onOpen={() => {}}
      opening={false}
      openError="Invalid saved approach"
      onAdvanced={() => {}}
      onCreated={() => {}}
    />,
  );
  expect(screen.getByRole("alert").textContent).toContain(
    "Invalid saved approach",
  );
  fireEvent.click(screen.getByRole("button", { name: /Write something/ }));
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Use this approach" }));
  expect(screen.queryByRole("alert")).toBeNull();
});
