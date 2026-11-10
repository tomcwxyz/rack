import type { RackProposal, CreationRouteId } from "@rack/creation";
import { firstRunInstructions } from "@rack/creation";

export type EditablePractice = { id: string; title: string; description: string; enabled: boolean; path?: string; sourceId?: string };
const decoder = new TextDecoder();

export function readRackTar(bytes: Uint8Array): RackProposal {
  if (bytes.length > 12_000_000) throw new Error("This RACK exceeds the 12 MB import limit.");
  const files: RackProposal["files"] = [];
  let offset = 0;
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const read = (start: number, length: number) => decoder.decode(header.subarray(start, start + length)).replace(/\0.*$/, "").trim();
    if (read(257, 5) !== "ustar") throw new Error("Please choose a RACK tar archive.");
    const path = [read(345, 155), read(0, 100)].filter(Boolean).join("/");
    const length = Number.parseInt(read(124, 12), 8);
    const kind = read(156, 1);
    if (!path || path.startsWith("/") || path.split("/").some(p => !p || p === "." || p === "..") || !Number.isSafeInteger(length) || length < 0 || offset + 512 + length > bytes.length || files.length > 500) throw new Error("This archive contains an invalid file.");
    if (kind === "0" || kind === "") {
      if (!/^(rack\.yaml|modules\/.*\.md|profiles\/.*\.yaml|eval\/.*\.yaml)$/.test(path)) throw new Error("This archive contains an unexpected file.");
      if (files.some(f => f.path === path)) throw new Error("This archive contains duplicate files.");
      files.push({path, content: decoder.decode(bytes.subarray(offset + 512, offset + 512 + length))});
    }
    offset += 512 + Math.ceil(length / 512) * 512;
  }
  if (!files.some(file => file.path === "rack.yaml") || !files.some(file => file.path.startsWith("profiles/"))) throw new Error("No valid RACK manifest or profile was found.");
  return {folderName: "imported-rack", files};
}

const frontmatter = (text: string) => text.startsWith("---\n") ? text.indexOf("\n---", 4) : -1;
const yamlValue = (content: string, key: string) => {
  const match = content.match(new RegExp("^" + key + ":\\s*(.+)$", "m"));
  const value = match?.[1]?.trim() || "";
  if (value.startsWith('"')) { try { return JSON.parse(value) as string; } catch { return value; } }
  return value.replace(/^['"]|['"]$/g, "");
};
const moduleId = (content: string) => content.match(/^  id:\s*([\w.-]+)/m)?.[1] || "";
const contentBody = (content: string) => {
  const end = frontmatter(content);
  return end >= 0 ? content.slice(end + 4).trim() : content.trim();
};
export function extractPractices(proposal: RackProposal): EditablePractice[] {
  return proposal.files.filter(f => f.path.startsWith("modules/") && f.path.endsWith(".md") && f.path !== "modules/index.md").map(file => ({
    id: crypto.randomUUID(), path: file.path, sourceId: moduleId(file.content),
    title: yamlValue(file.content, "title") || file.path.split("/").pop() || "Practice",
    description: contentBody(file.content) || yamlValue(file.content, "description"),
    enabled: true,
  }));
}
const quote = (value: string) => JSON.stringify(value.trim());
const customFile = (practice: EditablePractice, route: CreationRouteId) => {
  const id = practice.id.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase();
  return {path: "modules/context/user-" + id + ".md", content: [
    "---", "type: context", "title: " + quote(practice.title),
    "description: \"A practice written by the RACK owner.\"", "tags: [custom]",
    "harness:", "  schema_version: \"0.1\"", "  id: context.user-" + id,
    "  version: 0.1.0", "  context_kind: organisation",
    "  applies_to: [" + route + "]", "---", "", practice.description.trim(), ""
  ].join("\n")};
};
export function applyPractices(base: RackProposal, practices: EditablePractice[], route: CreationRouteId): RackProposal {
  const currentPaths = new Set(practices.map(p => p.path).filter(Boolean));
  const disabledIds = new Set(practices.filter(p => !p.enabled && p.sourceId).map(p => p.sourceId!));
  const files = base.files.filter(file => !currentPaths.has(file.path) || practices.some(p => p.path === file.path && p.enabled)).map(file => {
    const practice = practices.find(p => p.path === file.path);
    if (practice?.enabled) {
      const end = frontmatter(file.content);
      if (end >= 0) {
        const header = file.content.slice(0, end + 4).replace(/^title:.*$/m, "title: " + quote(practice.title));
        return {...file, content: header + "\n\n" + practice.description.trim() + "\n"};
      }
    }
    if (file.path.startsWith("profiles/") && file.path.endsWith(".yaml")) {
      const lines = file.content.split("\n").filter(line => !disabledIds.has(line.trim().replace(/^- /,"")));
      return {...file, content: lines.join("\n")};
    }
    return file;
  });
  const added = practices.filter(p => !p.path && p.enabled).map(p => customFile(p, route));
  const profile = files.find(f => f.path.startsWith("profiles/") && f.path.endsWith(".yaml"));
  if (profile && added.length) {
    const additions = added.map(f => "  - " + moduleId(f.content)).join("\n");
    profile.content = profile.content.replace(/^(include:\s*\n(?:  - .*\n)*)/m, match => match + additions + "\n");
  }
  return {...base, files: [...files, ...added]};
}
export function compilePractices(base: RackProposal, practices: EditablePractice[], route: CreationRouteId) {
  const proposal = applyPractices(base, practices, route);
  return {proposal, instructions: firstRunInstructions(proposal, route)};
}
