# Simple first use

The default entry point is a three-step journey:

1. **What would you like help with?** Choose Write, Research or Build. Describing the task is optional.
2. **Start with a good approach.** Review a short suggested approach, adjust its guidance and boundaries if useful, then accept it.
3. **Where will you use it?** Read, copy or download the compiled instructions. Saving an editable approach is optional.

No account, model call, context integration, project name or folder selection is required to reach copyable instructions. Suggested approaches use the existing guided source builders and compiler. Missing organisation, audience and technology details remain unknown: the instructions ask the AI to use supplied context or clarify gaps.

Saving writes the reviewed guidance, boundaries and task through the existing `create_rack_project` command. Changing the optional name changes the project title, not the accepted practice. The desktop then opens the existing workspace. Coding users may choose Claude Code, Codex or OpenCode and continue directly into the existing reviewed host installation flow. Selecting a tool does not install files or execute repository checks.

The detailed creation routes and Starter Pack catalogue remain available through **Explore packs and detailed setup**. Existing projects can still be opened from the first screen.

## Acceptance check

- Start without an account, TOPO or any saved project. The three work choices should be immediately visible.
- Choose each route with and without a task description. Accept the approach and copy the instructions without choosing a folder.
- Adjust guidance and boundaries. Confirm the copied text uses the changes; going back should retain them.
- Deny clipboard access: the exact instructions should remain selectable, with a useful error and download option.
- Cancel download or saving: remain on the hand-off screen with the draft intact.
- Save an approach, reopen it and compare its compiled prompt with the preview. Only an intentionally changed project name should differ.
- For Coding, choose a supported tool, save and verify that its existing installation review opens. No host files should be written before that review is confirmed.
- Check keyboard navigation and heading focus after each step.

## Verification for this change

Eight committed compiler/source tests cover the three routes, adjusted instructions, saved-source parity, invalid edits and supported coding destinations. Six additional local DOM interaction checks covered the screen transitions, copy, download, cancellation, write-error recovery and the selected host callback using mocked native calls. Focused TypeScript checks and a standalone Vite build passed. Native desktop acceptance remains required; these checks do not claim a signed installer or real filesystem-dialog test.
