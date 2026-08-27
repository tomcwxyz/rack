# Iteration 15 — model-backed Reliable evaluation

Iteration 15 turns the Reliable planning and Workflow foundations from Iterations 10–14 into the first full model-backed Reliable behavioural check.

## Product outcome

A signed-in desktop user can choose **Reliable** in Checks, enter one representative test case and a plain-language rubric, see the complete maximum paid exposure before anything runs, explicitly confirm the run and receive a durable aggregate result.

Local Rack use remains account-free. Reliable is an optional managed feature and never becomes a prerequisite for authoring, compiling, previewing or exporting a Rack.

## Deliberately narrow v0.1 plan

Reliable currently accepts exactly one case and one rubric and runs:

- five candidate generations using the selected Rack Set-up;
- five baseline generations for the same task using a neutral no-Rack system instruction;
- one structured rubric judgement for every candidate output;
- one structured rubric judgement for every baseline output.

That is **20 paid provider calls** per Reliable run before provider-attempt exposure is considered. Preflight continues to price the complete plan and its maximum retry exposure before confirmation.

The baseline answers the practical question: *does this Rack improve this task compared with asking the same generator to do it without Rack-specific working practices?*

## Independent judging

Reliable requires the configured judge alias to resolve to a different provider/model pair from the generator. Preflight already records whether the judge is independent; the Reliable confirmation endpoint now refuses paid execution when it is not.

The workflow re-resolves both aliases immediately before execution and compares the exact resolved identities with the confirmation. A deployment mapping change therefore makes the run Incomplete rather than silently running different models.

## Pass and regression semantics

A completed Reliable run records:

- mean candidate score;
- mean baseline score;
- candidate and baseline pass rates;
- the most recent previous passing Reliable score for the same workspace, Set-up and target, when one exists;
- whether the candidate score regressed;
- one final boolean behavioural verdict.

For this first slice, a Reliable run passes only when all five candidate judgements pass, the candidate mean is at least the baseline mean, and the candidate mean is not below the previous passing Reliable mean when one exists.

“Previous accepted” is therefore represented by the most recent completed Reliable run whose final behavioural verdict was true. There is not yet a separate manual acceptance action.

Provider failure, invalid structured judgement, ambiguous paid-call state or inability to complete the aggregate produces **Incomplete**, not behavioural Fail.

## Paid-work safety

Reliable reserves the complete accepted maximum retry exposure atomically before the Workflow is queued.

Every candidate, baseline and judge call has a stable call key and a durable provider-call ledger row. The row is claimed before the network request begins. If a Workflow retry encounters a still-claimed call, Rack refuses to repeat it automatically because it cannot know whether the previous request reached the provider.

Completed provider usage is charged from reported token usage when available and from the planned allowance otherwise. Failed calls are charged conservatively. The workspace reservation is released only when the complete Reliable run settles or becomes Incomplete.

## Privacy boundary

The durable Reliable result stores only model identities, statuses, aggregate scores/pass rates, the final nullable verdict, regression metadata and cost/accounting fields.

Instructions, case text, rubric, generated outputs and detailed judge responses remain in the existing transient payload boundary with a maximum 24-hour expiry. Vercel Workflow receives only the random Rack run ID; detailed managed content is fetched inside a run-scoped database step.

The Workflow role remains scoped to its current run. The single cross-run read required for regression comparison is exposed by a narrowly scoped database helper that returns only the previous passing integer score for the same workspace/Set-up/target.

## Desktop behaviour

The Checks screen now offers Quick and Reliable as two explicit modes while keeping the same Set-up, case and rubric form.

Reliable preflight shows:

- estimated and maximum retry cost;
- total call count and repetition count;
- generator and judge aliases;
- whether the judge resolves independently;
- any budget, output-limit or concurrency blockers.

After explicit confirmation the desktop polls the durable Reliable status and reports candidate vs baseline scores/pass rates plus the regression gate.

## Deliberately deferred

- multi-case Reliable suites;
- more than one judge per output;
- configurable repetition counts;
- adversarial case generation;
- manual acceptance/promotion of a Reliable run;
- richer historical trend views;
- automatic recovery of ambiguous paid calls.

Those should be considered after the pilot review rather than expanding the pre-pilot architecture further.
