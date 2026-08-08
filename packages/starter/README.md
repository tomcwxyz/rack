# @rack/starter

The bundled Rack Starter library. It is deliberately local, inspectable content: no executable plugins, network fetches, credentials or host configuration.

The catalogue is versioned separately from the Rack application. Every entry is rendered as ordinary Rack Markdown/YAML source, carries `origin: rack-starter` and `license: CC BY 4.0`, and receives a deterministic content digest. When an entry draws on an attributed method, the attribution, source URL and note are copied into the Markdown frontmatter as comments so they travel with the local source. Importing an entry copies that source into a local Rack; the catalogue never owns or silently updates the copied file afterwards.

The catalogue content is licensed under CC BY 4.0. Software used to render, search and validate the catalogue follows the repository's Apache-2.0 licence.
