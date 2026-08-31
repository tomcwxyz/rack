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

## First local transport: TOPO CLI

For the first interoperability proof, the Node-specific RACK boundary can use TOPO's machine-readable CLI command:

~~~sh
topo --store ~/.topo/topo.sqlite oos context \
  --subject project:rack \
  --purpose "review implementation" \
  --requester rack
~~~

createTopoCliContextTransport() invokes that command with execFile, not a shell, and returns the resulting packet to the existing OOS ContextSource.

This is deliberately temporary plumbing. It proves that two independently useful local-first applications can exchange context through the shared protocol before we build a Bridge or settle on MCP/native transport.

The transport currently rejects free-text context queries rather than silently ignoring them because the first TOPO CLI surface only supports subject/purpose and bounded item count.
