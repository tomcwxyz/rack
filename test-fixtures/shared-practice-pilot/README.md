# Shared-practice pilot fixture

This fixture backs both the automated organisational-practice journey test and the manual walkthrough in `docs/pilot/shared-practice.md`.

- `publisher/` is the canonical Rack which owns the practice being published.
- `receiver/` is a separate local Rack which accepts and adapts that publication.

Do not copy modules between them. The point of the fixture is to exercise the publication/materialisation/resolution boundary.
