import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

const variable = (name: string): string => {
  const match = styles.match(
    new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`),
  );
  if (!match?.[1]) throw new Error(`Missing CSS variable --${name}.`);
  return match[1];
};

const rgb = (hex: string): [number, number, number] => {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  ];
};

const luminance = (hex: string): number => {
  const channels = rgb(hex).map((channel) =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return (
    0.2126 * channels[0]! +
    0.7152 * channels[1]! +
    0.0722 * channels[2]!
  );
};

const contrast = (foreground: string, background: string): number => {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
};

describe("desktop accessibility CSS", () => {
  it("keeps primary text combinations above WCAG AA contrast", () => {
    expect(contrast(variable("ink"), variable("ground"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(variable("muted"), variable("paper"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(variable("accent"), variable("paper"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(variable("moss"), variable("paper"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(variable("danger"), "#f8e1dd")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(variable("success"), variable("moss-soft"))).toBeGreaterThanOrEqual(4.5);
  });

  it("uses a two-part focus indicator that works on light and dark controls", () => {
    expect(contrast(variable("accent"), variable("paper"))).toBeGreaterThanOrEqual(3);
    expect(contrast(variable("paper"), variable("ink"))).toBeGreaterThanOrEqual(3);
    expect(styles).toContain("outline: 2px solid var(--paper);");
    expect(styles).toContain("box-shadow: 0 0 0 5px var(--accent);");
  });

  it("honours reduced-motion preferences", () => {
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain("transition-duration: 0.01ms !important;");
    expect(styles).toContain("animation-duration: 0.01ms !important;");
  });
});
