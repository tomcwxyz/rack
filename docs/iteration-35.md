# Iteration 35 — local repository-check execution

## Outcome

Turn the first Rack-owned verifier ID into a real local deterministic check without allowing Starter/shared practice to smuggle executable code into the verifier path.

## repository-checks

The repository-checks verifier is now implemented for the first pilot target: JavaScript/TypeScript work projects with a root package.json.

Rack inspects the selected work project and recognises only these script names:

- check;
- lint;
- typecheck;
- type-check;
- test;
- build.

Other scripts are ignored by this verifier.

Starter/shared practice can request the verifier ID. It cannot supply:

- a shell command;
- script body;
- package-manager arguments;
- executable plug-in.

## Package-manager selection

The pilot executor chooses:

- pnpm when pnpm-lock.yaml exists;
- Yarn when yarn.lock exists;
- npm otherwise.

Commands are constructed by Rack itself as:

<manager> run <recognised-script>

and displayed before execution. Rack also shows the actual repository-defined script body plus any matching pre/post lifecycle scripts (for example pretest and posttest) that the package manager may invoke.

## Confirmation and plan integrity

Inspection returns the exact command list plus a fingerprint derived from:

- canonical selected work-project path;
- current package.json, including the reviewed script and lifecycle definitions;
- selected package manager;
- recognised script set.

Execution requires an explicit confirmation from the user.

Immediately before running, Rack inspects the project again and refuses to execute if the fingerprint differs from the reviewed plan.

## Execution boundary

Commands run:

- directly through the OS process API, not through a shell;
- with the work project as the current directory;
- with CI=true;
- with NO_COLOR=1;
- with standard input disabled;
- with a three-minute limit per check.

Output is written temporarily under local Rack metadata and read back only after the process completes.

Captured stdout/stderr is bounded per check and the combined semantic-verification evidence is bounded again before being passed onward.

A timeout, non-zero exit or executor error is never treated as pass.

## Verification UX

Local deterministic verification is now available even when:

- managed verification is not configured;
- the user is signed out of managed services;
- no semantic judgement step exists.

When a bounded semantic verification step requests test-results or build-results, the latest local verifier evidence can populate those fields automatically.

This creates the intended sequence:

1. deterministic local checks establish machine-verifiable facts;
2. bounded fresh-context AI judgement evaluates semantic questions;
3. explicit human review remains available for uncertainty/consequential decisions.

The layers remain separate: one does not silently convert the other's missing result into pass.

## Remaining Iteration 35 work

- add trusted adapters for non-JavaScript repositories where pilot demand justifies them;
- improve script selection so repositories can express which recognised checks are authoritative without shared content providing executable commands;
- persist bounded verification result metadata locally;
- expose automatic result state in the target-neutral completion gate;
- improve child-process termination for process trees on each supported OS;
- add CLI inspection/execution with the same confirmation and fingerprint rules.
