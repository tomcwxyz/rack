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

## Next implementation step

The next step is to use a `ContextSnapshot` in a controlled build/execution path and record its identity/digest in build provenance.

The initial rule should be:

> context may influence an execution, but it does not become canonical RACK source.

After that, implement a local TOPO transport and prove the first TOPO → RACK context exchange.

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
