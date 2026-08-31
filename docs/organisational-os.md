# Organisational OS context integration

RACK is beginning to participate in the draft [Organisational OS](https://github.com/tomcwxyz/Organisational-OS) architecture.

The first integration is deliberately narrow:

> RACK can ask a context node such as TOPO for purpose-bound context without making that context part of RACK practice.

## Context and practice remain different

This preserves the existing RACK/TOPO boundary:

- **TOPO / context** — what may be useful to know for this piece of work;
- **RACK / practice** — how the work should be done.

An OOS Context Packet is therefore normalised into a `ContextSnapshot`. It is **not** converted into a Rack module and cannot silently alter practice.

~~~text
RACK practice
     │
     │ needs context for a purpose
     ▼
ContextSource
     │
     │ OOS Context request
     ▼
TOPO / another node
     │
     ▼
Context Packet
     │
     ▼
ContextSnapshot
     │
     └── available to execution/build integration later
~~~

## Core abstraction

`ContextSource` is intentionally RACK-owned and protocol-neutral:

~~~ts
interface ContextSource {
  id: string;
  resolve(request: ContextRequest): Promise<ContextSnapshot>;
}
~~~

The OOS adapter is one implementation. A future local TOPO transport, MCP transport or static snapshot can implement the same interface.

This means RACK does not depend directly on TOPO.

## Cross-boundary validation

The OOS adapter validates the packet shape before accepting it and checks that the returned subject and purpose match the request.

The transport itself is injected. The current work does not choose HTTP, MCP, a local Bridge or another transport prematurely.

## What RACK advertises today

The draft RACK OOS manifest advertises only:

~~~text
queries:
  context
~~~

It does **not** yet advertise `Practice`.

That is intentional. RACK has several distinct practice concepts:

- instruction modules;
- Set-ups/profiles;
- shared-practice publications;
- compiled destination packages.

Forcing one of these into the OOS `Practice` primitive before we understand the semantic boundary would repeat the mistake the protocol is meant to avoid.

## Current status and next phase

The original proof sequence is complete:

- `ContextSnapshot` can influence a controlled prompt build without becoming canonical Rack source;
- build provenance records the context identity/digest;
- a local TOPO transport exists;
- the TOPO → Rack context exchange has been proved;
- the desktop can discover TOPO automatically and expose clear permission/connection states;
- reviewed TOPO memory can be used during Rack creation as well as prompt builds.

The next work is therefore product hardening rather than more Organisational OS protocol design.

Phase 3 should:

1. make paired TOPO/Rack use reliable across Windows, macOS and Linux;
2. make context requirements purpose-bound and task-aware rather than generic prompt decoration;
3. use TOPO first for context Rack can reasonably know, then ask the person only for genuine gaps;
4. define host-appropriate transient context delivery for Claude Code, Codex, OpenCode and agent runtimes;
5. preserve the rule that context can influence work without silently becoming practice.

Broader Organisational OS design is intentionally paused while TOPO and Rack generate implementation evidence. RACK should not add an OOS `Practice` primitive merely to make the protocol look complete.

## Local alpha workflow

RACK can now preview purpose-bound context from local TOPO:

~~~sh
rack context topo \
  --subject project:rack \
  --purpose "prepare implementation"
~~~

For the first controlled integration, TOPO context can be attached to a **prompt** build:

~~~sh
rack build . \
  --profile coding \
  --target prompt \
  --context-subject project:rack \
  --context-purpose "prepare implementation" \
  --install
~~~

Optional `--topo-store` and `--topo-command` flags select a specific TOPO store or CLI executable.

The generated prompt receives an explicit **Organisational context** section after the Rack instructions. Context is transient generated material: it does not become a Rack module, Set-up or source file.

The generated `build.json` records only context provenance needed to reproduce and audit use:

- provider node;
- Context Packet ID;
- context digest;
- subject and purpose;
- generation/expiry time;
- permissions;
- included object IDs.

The canonical Rack source digest remains unchanged by context.

This alpha deliberately supports the generic prompt destination only. We should test the semantics before deciding how context should be represented in destination-specific packages.

## Desktop-to-desktop local context

The desktop alpha no longer needs to read TOPO's store or know the TOPO CLI path.

When the TOPO desktop is running it publishes an authenticated loopback-only discovery record at:

~~~text
~/.topo/oos-local.json
~~~

Rack reads that discovery record, validates that it points to 127.0.0.1, checks TOPO's advertised capabilities, and can request a purpose-bound Context Packet through the local endpoint.

The desktop connection is deliberately zero-config:

1. open TOPO;
2. choose **Allow local tools** for the current TOPO session;
3. open Rack.

Rack watches for TOPO automatically and moves between **Waiting for TOPO**, **Permission needed** and **Connected** without requiring a manual refresh or any transport configuration.

Using memory in a particular build remains explicit:

1. enable **Use TOPO memory in this prompt build**;
2. describe **Context for** and **What are you doing?**;
3. review the selected context;
4. build with that reviewed snapshot.

Those plain-language fields map to the OOS subject and purpose semantics. Rack does not silently fetch memory when the feature is disabled.

The local endpoint is read-only and TOPO fixes its disclosure ceiling to ordinary + personal memory. A requesting application cannot ask this transport to elevate into sensitive or restricted memory.

Context remains transient generated material. The build manifest records the context digest and packet provenance while canonical Rack source remains unchanged.

A context digest is based on the selected context content rather than the packet's random ID or generation timestamp. Re-requesting identical context therefore remains current; changing the selected memory marks the managed build stale.

The CLI transport remains useful for development and automation. The desktop transport is the preferred local-alpha UX once both applications are installed.
