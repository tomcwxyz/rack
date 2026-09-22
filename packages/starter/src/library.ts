import {
  STARTER_CONTENT_LICENSE,
  STARTER_SOURCE_ORIGIN,
  starterCatalogue as rackStarterCatalogue,
  starterTemplates as rackStarterTemplates,
  starterContentDigest,
  starterSourcesEqual,
  type StarterAttribution,
  type StarterEntry as BaseStarterEntry,
  type StarterRoute,
  type StarterSearch,
  type StarterTemplate,
} from "./catalogue.js";
import {
  honeyStarterCatalogue,
  honeyStarterTemplates,
} from "./honey.js";
import type { StarterSourceProvenance } from "./external.js";

export const STARTER_CATALOGUE_VERSION = "0.5.0";

export const starterCatalogueMetadata = {
  schemaVersion: "0.2",
  id: "rack-starter",
  version: STARTER_CATALOGUE_VERSION,
  origin: STARTER_SOURCE_ORIGIN,
  license: "mixed",
  licenses: [STARTER_CONTENT_LICENSE, "MIT"] as const,
} as const;

export type StarterEntry = BaseStarterEntry & StarterSourceProvenance;

const rackEntries: StarterEntry[] = rackStarterCatalogue.map((entry) => ({
  ...entry,
  sourceOrigin: STARTER_SOURCE_ORIGIN,
  contentLicense: STARTER_CONTENT_LICENSE,
}));

export const starterCatalogue: readonly StarterEntry[] = [
  ...rackEntries,
  ...honeyStarterCatalogue,
].sort((left, right) => left.title.localeCompare(right.title));

export const starterTemplates: readonly StarterTemplate[] = [
  ...rackStarterTemplates,
  ...honeyStarterTemplates,
];

const normalise = (value: string): string => value.trim().toLowerCase();

export const searchStarterCatalogue = (
  search: StarterSearch = {},
): StarterEntry[] => {
  const query = search.query ? normalise(search.query) : "";
  const tag = search.tag ? normalise(search.tag) : "";

  return starterCatalogue.filter((entry) => {
    if (search.route && !entry.routes.includes(search.route)) return false;
    if (search.type && entry.type !== search.type) return false;
    if (tag && !entry.tags.some((candidate) => normalise(candidate) === tag)) return false;
    if (!query) return true;
    const haystack = [
      entry.id,
      entry.title,
      entry.description,
      entry.type,
      ...entry.tags,
      ...entry.routes,
      entry.attribution?.name ?? "",
      entry.attribution?.note ?? "",
      entry.sourceOrigin,
      entry.contentLicense,
      entry.upstreamRevision ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return query
      .split(/\s+/)
      .filter(Boolean)
      .every((term) => haystack.includes(term));
  });
};

export const getStarterEntry = (id: string): StarterEntry | undefined =>
  starterCatalogue.find((entry) => entry.id === id);

export const getStarterTemplate = (id: string): StarterTemplate | undefined =>
  starterTemplates.find((template) => template.id === id);

export {
  STARTER_CONTENT_LICENSE,
  STARTER_SOURCE_ORIGIN,
  starterContentDigest,
  starterSourcesEqual,
};
export type {
  StarterAttribution,
  StarterRoute,
  StarterSearch,
  StarterTemplate,
};
