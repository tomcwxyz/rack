# Shared-practice pilot walkthrough

This walkthrough exercises the organisational-practice path which needs real-world testing before Rack adds more source transports or administration.

It is deliberately small. The aim is to find where the model or language is confusing, not to demonstrate every feature.

## What this tests

The journey covers:

1. publishing selected local practice;
2. receiving it through a plain shared file;
3. seeing binding and adaptable practice behave differently;
4. keeping a local adaptation;
5. leaving out an adaptable default;
6. reviewing an incoming update before it applies;
7. checking that Preview and Checks use the same effective Set-up.

The matching automated fixture is in:

```text
test-fixtures/shared-practice-pilot/
```

## Roles

Use two Racks, even if one person is playing both roles.

### Publisher

Starts with:

```text
test-fixtures/shared-practice-pilot/publisher/
```

It contains:

- **Evidence boundary** — binding and required;
- **Plain language** — adaptable shared default;
- **Decision notes** — adaptable experiment with a review date;
- **Internal publishing notes** — local-only and deliberately not publishable.

### Receiver

Starts with:

```text
test-fixtures/shared-practice-pilot/receiver/
```

It contains:

- local receiver context;
- a local `voice.plain` adaptation which is not initially selected.

This is intentional. It tests whether shared practice can say "plain language belongs in this Set-up" while the receiver's nearer local version decides what that means for them.

## 1. Publish

Open the publisher Rack.

Go to **Shared practice** and expand **Publish practice from this Rack**.

Select:

- Evidence boundary;
- Plain language;
- Decision notes.

Do not select **Internal publishing notes**. Rack should show that it stays local and should not allow it to be selected.

Review the publication before saving it.

Check that:

- there are three instructions;
- Evidence boundary is binding;
- Plain language and Decision notes are adaptable;
- the Decision notes learning question is visible in the generated file;
- Internal publishing notes are absent.

Save the file somewhere you can treat as the organisation's shared location.

For a real pilot this could be OneDrive, Google Drive, Dropbox, Nextcloud or a shared network folder. Rack itself does not need to host it.

## 2. Receive

Open the receiver Rack.

Go to **Shared practice** and attach the file you just published.

Check that Rack:

- identifies the publication and publisher;
- stores an accepted local snapshot;
- shows one binding instruction and two adaptable instructions;
- explains what shared practice changes in the receiver's Set-up.

Go to **Set-ups**.

The effective Writing Set-up should now contain the shared practice even though its local YAML was not rewritten.

## 3. Check binding behaviour

Edit the Writing Set-up.

**Evidence boundary** should say:

> Required by shared practice

Its selection control should not let you leave it out.

This is the main binding boundary: the local Set-up can see why the instruction applies, but cannot present a false opt-out.

Close the editor without changing anything.

## 4. Check adaptable-default behaviour

Edit the Writing Set-up again.

**Plain language** should say:

> Included by shared practice

The receiver already has its own local instruction with the same ID. Preview the Set-up before making an opt-out.

The effective output should use the receiver's wording:

> Use direct British English, but keep enough detail to explain consequential trade-offs.

It should not use the publisher's plainer wording as the winning instruction.

This is the intended model:

- the shared source says the practice belongs in the Set-up;
- local adaptable practice remains nearer and wins the content.

## 5. Leave out an adaptable default

In the Set-up editor, change **Plain language** to **Leave out**.

Review the source change before saving it.

The diff should add `voice.plain` to the local Set-up's `exclude` list.

After saving:

- Preview should no longer contain the receiver's plain-language instruction;
- Evidence boundary should still be present;
- Decision notes should still be present.

The publisher receives no signal that this happened.

## 6. Return to the shared default

Edit the Set-up and return **Plain language** to:

> Included by shared practice

Review and save.

The explicit local exclusion should disappear.

Preview should again use the receiver's local `voice.plain` adaptation.

## 7. Publish an update

Return to the publisher Rack.

Change the publication version and make one visible change to a selected instruction.

For a tightening test, change **Plain language** from adaptable to binding and add a clear rationale.

Publish to a new file, or explicitly replace the existing ordinary file if you are testing the synced-file update path.

## 8. Review the incoming update

Return to the receiver Rack and use **Check source** if the file was replaced in place.

Rack should keep using the accepted version until you decide.

For the adaptable-to-binding example it should identify the update as tightening.

Try both paths during pilot testing:

### Keep current

Choose **Keep current**.

The existing accepted snapshot should remain effective. Rack should not repeatedly offer that exact file content.

Use **Review this update again** to prove the decision is reversible.

### Use this update

Choose **Use this update**.

The new accepted snapshot should become effective immediately.

If Plain language is now binding, the local Set-up should no longer be able to leave it out.

## 9. Review dates and experiments

In Shared practice, inspect **Decision notes**.

It should show:

- Experiment;
- its learning question;
- its review date.

The date does not disable the experiment. When its review date arrives, Rack should prompt reconsideration while leaving the accepted practice active.

## 10. Preview and Checks

For the same Set-up:

1. inspect **Preview and export**;
2. run local/static checks;
3. if using managed evaluation, run the intended Quick/Reliable path.

The important consistency check is that all of them see the same resolved Set-up.

A shared binding/default must not appear in Preview but disappear from Checks, or vice versa.

## What to observe in a pilot

Record confusion and friction rather than only pass/fail.

Useful questions:

- Did "binding" and "adaptable" make sense without explanation?
- Was **Included by shared practice** understandable?
- Did **Leave out** feel like a local choice rather than editing organisational policy?
- Was it clear that a local same-ID adaptation could win?
- Did the accepted-snapshot update model feel reassuring or cumbersome?
- Was the publisher's explicit selection boundary useful?
- Did participants understand why local-only/context material was treated cautiously?
- Did review dates feel like prompts rather than compliance deadlines?
- Was Shared practice the right place for both publishing and receiving?
- Did people expect more than one shared source immediately?

The answers to those questions should determine whether Rack needs multi-source UI next, or whether the one-source model needs simplifying first.
