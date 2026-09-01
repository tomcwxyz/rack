# Iteration 34 — reviewed host installation and work-project targeting

## Outcome

Move Rack from "render files for a host" to a reviewed host hand-off that knows **where the actual work project is**, what Rack already owns there, and when it must stop rather than overwrite somebody else's instructions.

## Source versus work project

A Rack source folder is not assumed to be the same folder as the project being worked on.

The desktop now asks for an explicit **work project** target and remembers that selection as local Rack metadata across application restarts.

- canonical Rack Markdown/YAML stays in the Rack source folder;
- generated host files are installed into the selected work project;
- host ownership state and retained backups stay under the Rack source's local .rack/ metadata;
- repository verification also runs in the selected work project;
- "Use Rack folder" remains an explicit choice for people who deliberately keep the Rack at the repository root.

This avoids making a coding-specific repository assumption part of the canonical Rack format.

## Supported managed host installs

The first managed write path covers:

- Claude Code;
- Codex;
- OpenCode.

The install layer accepts only the paths produced by those supported adapters.

### Claude Code

- CLAUDE.md
- .claude/skills/<skill>/SKILL.md

### Codex

- AGENTS.md

### OpenCode

- AGENTS.md
- .opencode/commands/<command>.md

No arbitrary path supplied by Rack practice can be written through this command.

## Ownership and conflict rules

Rack only manages files it created through the reviewed host-install flow.

On first installation:

- an absent host path can be created;
- any pre-existing file at a target path is treated as a conflict;
- Rack does not overwrite it, even when the current contents happen to match generated output.

After installation Rack records:

- host ID;
- Set-up ID;
- selected canonical work-project path;
- managed relative paths;
- digest of the exact Rack-written content.

Before update or removal Rack re-reads every managed path.

If a managed file:

- changed outside Rack;
- disappeared;
- became a symlink/non-file;
- or conflicts with a newly generated path;

the automatic operation stops.

The user can then resolve the project manually rather than having Rack silently win a conflict.

## Backup and rollback boundary

Before replacing or removing a previous Rack-managed host installation, Rack copies the managed files into:

.rack/host-backups/<host>/<setup>/<timestamp>/

under the Rack source.

The write path attempts to restore the previous managed state if an update/removal fails part-way through.

Transient TOPO context is not part of these installed host files.

## UI

The Preview and export surface now shows:

- whether the selected AI host was detected locally;
- the standing/on-demand hand-off plan;
- the selected work project;
- per-file create/update/remove/current/conflict state;
- install/update action only when the plan is safe;
- removal only for unchanged Rack-owned files.

The build retained under .rack/generated/ remains separate from installing generated files into the work project.

## Remaining Iteration 34 work

- improve manual-conflict guidance for existing AGENTS.md/CLAUDE.md;
- consider an explicit adopt/compose flow rather than replacement for established host instruction files;
- add transient TOPO task-context delivery for supported hosts;
- complete OpenCode-specific host registration where required by the current host version;
- add host-install inspection to the CLI;
- build cross-host conformance fixtures before promoting agent-runtime destinations.
