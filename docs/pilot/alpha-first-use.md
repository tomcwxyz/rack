# Alpha first-use acceptance

Use this walkthrough before promoting the next RACK pilot build.

The point is not to demonstrate every feature. It is to answer one product question:

> Can somebody start with a good way of working, use it with a real AI tool, understand what RACK carried across, and improve the practice afterwards?

## 1. Clean install

- Install the packaged desktop build, not a development build.
- Launch RACK from the installed application.
- Confirm there is no account gate and no TOPO requirement.
- Confirm the welcome screen has one obvious primary action.
- Check the minimum supported window size (860×620) remains usable.

## 2. First run

Run one journey for each route.

### Writing

- Choose **Write something**.
- Confirm **Clear everyday writing** is the obvious good default without hiding **Client communication**.
- Open **Why this works** and check that the ingredients explain a coherent purpose → structure → draft → review loop.
- Use **Change a few things** and remove one practice.
- Complete creation and confirm the final review reflects that choice exactly.

### Research

- Choose **Research or make sense of something**.
- Confirm **Evidence review** and **Decision research** feel meaningfully different.
- Check that both keep the question, source quality, triangulation, synthesis and uncertainty visible.
- Create a Rack from each once during the alpha test.

### Software

- Choose **Build, change or review software**.
- Compare **Careful code change**, **Repository review**, **Agent code hand-off** and **Lean agentic coding · Honey**.
- Confirm the difference is understandable from the promise before opening technical detail.
- Inspect Honey provenance and licence.

## 3. Real hand-off

Using a detected supported host:

- choose a real work project;
- select **Use with …**;
- check the capability consequence summary;
- confirm no important practice silently disappears;
- inspect the exact files RACK proposes to manage;
- install only after review;
- perform one real task.

Repeat once with a second supported host where available and note any explicit degradation.

## 4. Check and learn

After the real task:

- run the configured RACK checks that are available;
- open a due practice review;
- record what happened;
- exercise **Keep**, **Change** and **Remove** across test practices;
- confirm **Change** opens deliberate editing rather than rewriting canonical practice automatically;
- confirm **Remove** is visibly a decision until the practice is explicitly changed;
- confirm review history remains local under `.rack` and cannot be swept into Git by default.

## 5. Brand and interaction review

Check the experience as a whole:

- warm paper/ink remains the dominant visual language;
- purple primarily signals choice, action or selection;
- moss signals calm state/context/provenance;
- ordinary information is not presented as a sea of equally elevated cards;
- the RACK rail/rung mark is visible but restrained;
- focus is visible without relying on colour alone;
- **start well → use it → check it → learn from it** reads as one product loop.

## 6. Release evidence

Automated evidence required before hands-on testing:

- repository `pnpm check` passes;
- repository build passes;
- Windows desktop smoke passes;
- Linux desktop smoke and package build passes;
- packaged Windows installer installs and launches successfully;
- Defender reports no RACK detection where runner support is available.

Record hands-on findings as product observations, not individual-user scores.
