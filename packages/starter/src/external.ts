import { stringify } from "yaml";
import {
  moduleFrontmatterSchema,
  type RackModuleFrontmatter,
} from "@rack/schemas";
import {
  starterContentDigest,
  type StarterAttribution,
  type StarterEntry as BaseStarterEntry,
  type StarterRoute,
} from "./catalogue.js";

export type StarterSourceProvenance = {
  sourceOrigin: string;
  contentLicense: string;
  upstreamRevision?: string;
};

export type ExternalStarterEntry = BaseStarterEntry & StarterSourceProvenance;

export type ExternalStarterSource = {
  name: string;
  publisher: string;
  origin: string;
  license: string;
  url: string;
  revision?: string;
  copyright?: string;
  note?: string;
};

type ExternalEntryInput = {
  type: RackModuleFrontmatter["type"];
  slug: string;
  title: string;
  description: string;
  routes: StarterRoute[];
  tags: string[];
  body: string;
  source: ExternalStarterSource;
  harness?: Record<string, unknown>;
  schemaVersion?: "0.1" | "0.2";
};

const attributionFor = (source: ExternalStarterSource): StarterAttribution => ({
  name: `${source.name} — ${source.publisher}`,
  url: source.url,
  note: [
    "RACK-native adaptation of the upstream working practice.",
    source.revision ? `Pinned to upstream revision ${source.revision}.` : undefined,
    source.note,
  ]
    .filter(Boolean)
    .join(" "),
});

export const makeExternalStarterEntry = (
  input: ExternalEntryInput,
): ExternalStarterEntry => {
  const id = `@rack-starter/${input.slug}`;
  const attribution = attributionFor(input.source);
  const frontmatter = moduleFrontmatterSchema.parse({
    type: input.type,
    title: input.title,
    description: input.description,
    tags: input.tags,
    harness: {
      schema_version: input.schemaVersion ?? "0.1",
      id,
      version: "0.1.0",
      ...(input.harness ?? {}),
      source: {
        origin: input.source.origin,
        license: input.source.license,
      },
    },
  });
  const sourceComments = [
    `# External Starter source: ${input.source.name}`,
    `# Publisher: ${input.source.publisher}`,
    `# Upstream: ${input.source.url}`,
    ...(input.source.revision ? [`# Upstream revision: ${input.source.revision}`] : []),
    `# Licence: ${input.source.license}`,
    ...(input.source.copyright ? [`# Copyright: ${input.source.copyright}`] : []),
    "# Full third-party licence notice: packages/starter/THIRD_PARTY_NOTICES.md",
    `# Starter attribution: ${attribution.name}`,
    `# Source: ${attribution.url}`,
    ...(attribution.note ? [`# Note: ${attribution.note}`] : []),
  ].join("\n");
  const source = `---\n${stringify(frontmatter, { lineWidth: 0 }).trimEnd()}\n${sourceComments}\n---\n\n${input.body.trim()}\n`;

  return {
    id,
    title: input.title,
    description: input.description,
    type: input.type,
    routes: input.routes,
    tags: input.tags,
    attribution,
    source,
    digest: starterContentDigest(source),
    fileName: `${input.slug.replace(/\./g, "-")}.md`,
    sourceOrigin: input.source.origin,
    contentLicense: input.source.license,
    upstreamRevision: input.source.revision,
  };
};
