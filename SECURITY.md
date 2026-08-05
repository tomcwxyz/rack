# Security policy

Rack handles local files, behavioural instructions, provider credentials and model requests. Please do not disclose suspected vulnerabilities publicly before they have been assessed.

## Reporting

During the private development phase, report security concerns directly to The Good Ship through its private contact route. A dedicated security email will be published before the repository becomes public.

Include:

- affected Rack version or commit;
- operating system;
- steps to reproduce;
- likely impact;
- whether local files, credentials, imports, updates or managed requests are involved.

Do not include real secrets or sensitive project content. Use a minimal reproduction where possible.

## Supported versions

Until the first public release, only the latest commit on `main` is supported. Preview destinations may change, but any issue that risks local files, privacy, credentials or another Supported destination is treated as a release blocker.

## Security boundaries

Rack v0.1 must not execute imported content, start imported tool servers automatically, store provider keys in project files, upload projects by default or install updates without user control.
