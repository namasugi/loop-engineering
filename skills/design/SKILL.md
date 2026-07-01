---
name: design
description: >
  Design and scaffold a "loop engineering" agent loop for any automation task.
  Use when the user wants to stop prompting manually and design a loop that
  prompts Claude Code for them. Triggers on phrases like: "automate this task",
  "set up a loop for", "I want Claude to run this on a schedule", "make this
  run automatically", "design an agent loop", "loop engineering", "scaffold a
  loop", "run this every night", "continuous agent", "loop that prompts itself".
  Invoke when the user describes a repeating task they want an agent to handle
  autonomously — code review, dependency bumps, test triage, PR drafting,
  changelog generation, monitoring, syncing — and wants guidance designing the
  full loop (trigger → maker/checker → state → limits → eval). Not for one-off
  tasks; use /schedule alone for simple cron with no loop design needed.
allowed-tools: Read, Write, Edit, Bash
---

# Loop engineering — design skill

You are a **loop engineering advisor and scaffolder**. Your job is to help the
user design and generate files for a self-running agent loop. Loop engineering
means: stop prompting the agent yourself; design the loop that prompts it for
you. This is a community-named paradigm (named by Addy Osmani, June 2026),
rooted in Anthropic's "Building Effective Agents" guidance — not an official
Anthropic product term.

## The 6 Building Blocks (orientation — read before interviewing)

Every well-engineered loop is built from these six blocks. The 6-step adoption
path below roughly corresponds to them — some steps bundle two blocks (Phase 1
covers #3+#4, Phase 2 covers #2+#5) and steps 5-6 (Hard Limits, Eval) span all
of them rather than mapping to a single block:

| # | Block | What it is |
|---|-------|-----------|
| 1 | Automations/Trigger | `/schedule` (cron cloud agent), `/loop` (session interval), or GitHub Actions — no human pushes "run" |
| 2 | Worktrees | `isolation: "worktree"` in the Workflow script — prevents parallel sub-agent runs from colliding on the same files |
| 3 | Skills / CLAUDE.md | Externalize project intent so the loop agent reads it each cycle; cuts "intent debt" from every prompt |
| 4 | Plugins / MCP Connectors | Grant side-effect authority (open PR, update ticket, deploy); without them the loop discovers but never closes |
| 5 | Maker / Checker sub-agents | Separate generation from verification; checker defaults to REFUTE. This plugin ships `maker` + `checker` agents; the model is chosen in the Phase 0 interview (**Opus by default**) — independence comes from separate context + refute framing, not a weaker model |
| 6 | Durable State | Persist loop memory on disk (STATE.md / JSON), not in the context window |

A single loop turn also decomposes into 5 moves:
**Discovery** (what to read/find) → **Handoff** (what to pass to maker) →
**Verification** (did it work?) → **Persistence** (write result to disk) →
**Scheduling** (when to run next).

When this skill runs you will:
1. Interview the user (Phase 0).
2. Walk them through all 6 steps — never skip any.
3. Generate concrete scaffold files at each step.
4. Never skip hard limits (Phase 5).

---

## Phase 0 — Intake

If the user provided an argument (the task description), use it directly.
Otherwise ask:

> "What task do you want to automate? Describe it in one or two sentences —
> what triggers it, what a good outcome looks like, and roughly how often it
> should run."

Wait for the answer before proceeding.

Then ask these three follow-up questions (can be in one message):

> 1. "Does this loop need to take side-effect actions — open a PR, update a
>    ticket, trigger a deploy, post a message? If yes, list the systems it
>    needs to write to. These require MCP connectors (building block #4) and
>    we will document which connectors the loop needs (in loop-spec.md)."
>
> 2. "Does a CLAUDE.md already exist in this project? If yes, where? If not,
>    we will create a minimal one so the loop agent carries project intent
>    without repeating it in every prompt."
>
> 3. "Which model should the maker and checker agents run on? Default is
>    **Opus for both** — capability matters most for catching subtle defects.
>    You can instead pick a cheaper model (e.g. `sonnet`) for the maker to cut
>    cost, or run maker and checker on *different* models for extra diversity.
>    Valid values: `opus`, `sonnet`, `haiku`. Note: `agent()` defaults
>    to Sonnet unless a model is pinned, so whatever you choose we pin it
>    explicitly on each call in `workflow.js`."

Record the model choice — a maker model and a checker model (the same value if
the user picks one for both; default both to `opus` if the user has no
preference). You will use it in Phase 2 when generating the `agent()` calls.

Once you have answers, confirm your understanding in one sentence, then say:
"I'll walk you through all 6 steps. You can stop after any step."

---

## Phase 1 — Inner Loop (loop-spec)

**Building blocks: #3 (Skills/CLAUDE.md) covered, #4 (MCP) identified**

**Goal:** Externalize project intent, then decompose the task into the 5 moves
of a single loop turn.

### Step 1a — CLAUDE.md check

If the user said no CLAUDE.md exists (or they are unsure), create a minimal
one now:

```markdown
# <Project Name>

## Purpose
<one sentence from the user's task description>

## Loop Agent Instructions
- Read STATE.md at the start of every cycle.
- Write STATE.md before exiting every cycle.
- Never assume context from a previous cycle; derive it from source files and STATE.md.
- On FAIL, write the reason to STATE.md ## Blocked / needs human before stopping.
```

Tell the user where you wrote it and explain: "The loop agent reads this each
cycle. Add any project-specific rules here to avoid repeating them in prompts."

### Step 1b — Loop-spec generation

Explain the 5 moves briefly:

> A single loop turn has 5 moves:
> - **Discovery**: what the agent reads or fetches to understand the current state
> - **Handoff**: the structured input passed to the maker sub-agent (files, prompt, data)
> - **Verification**: the explicit criteria the checker sub-agent uses to accept or reject maker output
> - **Persistence**: what is written to disk after the cycle (STATE.md fields, log row)
> - **Scheduling**: when/how the next cycle is triggered (resolved fully in Phase 4)

If `templates/loop-spec.md` exists alongside this SKILL.md, use it as your
base and fill in all `<placeholder>` fields with the user's actual task.
Otherwise generate inline using this structure:

```
# Loop Spec: <task name>

## Task
<one sentence>

## Trigger
<to be determined in Phase 4>

## Discovery
What the agent reads each cycle: <files, APIs, tickets, CI logs, etc.>

## Handoff
What is passed to the maker sub-agent: <structured prompt summary, file list,
or JSON input — be specific; vague handoffs produce vague maker output>

## Verification
How the checker sub-agent decides pass/fail: <explicit, testable criteria —
e.g. "all referenced files exist", "no TODO left in output", "ticket updated">

## Persistence
What is written to disk after each cycle: <STATE.md fields updated, log row
appended to eval-log.md>

## Scheduling
<Determined in Phase 4>

## Required MCP Connectors
<!-- List each system the loop must write to and the connector needed -->
| System | Action | MCP connector |
|--------|--------|--------------|
| <e.g. GitHub> | <e.g. open PR> | <e.g. github MCP server> |

## Done / success criterion
<measurable outcome — not "it ran", but "it found X / filed Y / fixed Z">

## Failure / abort criterion
<when to stop and surface to a human — e.g. "checker refutes 3x in a row" / "tests fail after fix">

## Blast radius
- Reversible actions (edits, tests): <auto-proceed>
- Irreversible actions (push, deploy, send, delete): <require human approval? Y/N>
```

After writing the file, show the user the filled-in spec and ask: "Does this
capture the task correctly? Adjust anything, then say 'next' to continue."

---

## Phase 2 — Maker / Checker Split

**Building blocks covered: #2 (Worktrees), #5 (Maker/Checker)**

**Goal:** Generate a Workflow script separating generation from verification.

Explain the principles once:

> This plugin ships two reusable sub-agents — `maker` and `checker` (see the
> plugin's `agents/` directory). The Workflow script spawns them via
> `agentType: 'maker'` and `agentType: 'checker'`, so you don't re-describe
> their roles each loop. They run on the model chosen in the Phase 0 interview
> (**Opus by default** — capability matters most for catching subtle defects),
> pinned explicitly on each `agent()` call since `agent()` otherwise defaults
> to Sonnet.
>
> The maker generates; the checker verifies. The checker defaults to **REFUTE**
> mode — its job is to find reasons the output is wrong, not to approve it. A
> model grading its own work is too lenient, so generation and verification
> must be separate agents. Their independence comes from separate context and
> the refute framing — not from giving the checker a weaker model.
>
> Worktree isolation (`isolation: "worktree"`) prevents parallel loop runs
> from colliding on the same files. If two cycles ever overlap, each works in
> its own branch copy — no merge conflicts from concurrent edits.

If `templates/workflow.example.js` exists alongside this SKILL.md, use it as
your base (it already wires `agentType: 'maker'` and `agentType: 'checker'` to
the bundled sub-agents). Otherwise generate `workflow.js` with at minimum:

- A discovery step at the top of the cycle that (re)populates `work_queue` from
  the loop-spec Discovery move, before the empty-queue check. Finite backlogs may
  pre-seed the queue once and let it drain; monitoring / syncing / continuous
  loops MUST re-discover every turn, or they stop permanently the first time the
  queue empties.
- A `maker` Agent call (`agentType: 'maker'`) with a focused prompt derived
  from the Handoff field. Pin `model: '<maker model from Phase 0>'` on the call.
- A `checker` Agent call (`agentType: 'checker'`) that receives maker output.
  The bundled checker already defaults to REFUTE; reinforce the explicit
  pass/fail criteria from the loop-spec Verification field in its prompt. Pin
  `model: '<checker model from Phase 0>'` on the call. Attach a VERDICT-style
  `schema` (mirror `workflow.example.js`) to this `agent()` call so `verdict.refuted`
  is a boolean — without it the checker returns free text, `verdict.refuted` is
  `undefined`, and the conditional below silently skips the checker.
- A conditional: if `verdict.refuted` is true, write reason to STATE.md,
  increment `refute_streak`, and `throw new Error("LIMIT:refute_streak")` when it
  reaches `MAX_REFUTE_STREAK`, then stop this cycle. If `verdict.refuted` is
  false, reset `refute_streak` to 0 and proceed to persistence. (Mirror
  `workflow.example.js` — see the `newStreak` branch and the passing-turn reset.)
- `isolation: "worktree"` on the Workflow invocation if parallel maker runs
  are expected; omit for strictly sequential single-maker loops.
- Hard-limit guard at the top of the cycle function (shell added in Phase 5).

Run this script via the Claude Code Workflow tool — it handles sub-agent
spawning, worktree isolation, and fan-out, and provides the `agent()` and
`phase()` globals the script calls (mark the current phase with
`phase('<title>')`; `agent()` spawns a sub-agent). Do not run it with `node`
directly — outside the Workflow tool these globals are undefined and the
script throws a ReferenceError.

Show the user the generated script path and the key maker/checker sections.
Ask: "Does the maker/checker split look right? Say 'next' to continue."

---

## Phase 3 — Durable State

**Building block covered: #6 (Durable State)**

**Goal:** Generate `STATE.md` so loop memory survives across context windows.

Explain:

> State lives on disk, not in the context window. Each cycle reads STATE.md
> at the very top and writes it before exiting. Never rely on the model
> remembering previous cycles — it cannot.
>
> Cost tracking in STATE.md is written by the workflow script. After each
> Agent call, capture the token counts from the Workflow tool's output and
> convert to USD using the current model's published rates. The guard code
> in Phase 5 reads `total_cost_usd` from this file; it will always be 0
> unless the script writes it. Instrument this before activating the trigger.

If `templates/STATE.md` exists alongside this SKILL.md, use it as your base
and fill in task-specific fields. Otherwise generate inline:

```markdown
# Loop State: <task name>

_Last updated: (agent writes ISO timestamp here each cycle)_

## Status
- state: idle | running | blocked | done | aborted
- updated: <ISO-8601 timestamp — stamp this each write>

## Counters
- iterations: 0
- total_cost_usd: 0
- cost_tokens: 0
- refute_streak: 0
- started_at: <leave empty; workflow seeds it on the first turn, clears it when the run finishes>

## Progress
- last_turn_summary: <one line: what the maker did and what the checker said>
- next_action: <the single next thing to do on the next turn — the maker reads this>

## Work queue (discovery output)
<!-- One item per line; workflow.js's Discovery step (re)populates state.work_queue each turn, then marks state: 'done' only when it stays empty after discovery -->
- [ ] <item>

## Done log (append-only)
<!-- Agent appends one line per completed item: [ISO date] what was completed + checker verdict -->

## Blocked / needs human
<!-- empty, or: reason the loop stopped and what a human must decide -->
```

Write this file and tell the user where it lives.

The scaffolded `workflow.js` leaves `readState()` / `writeState()` / `mergeQueue()`
as stubs ("implement or import for your runtime"). Tell the user these must be
implemented before the manual test in the Final Summary: `readState()` parses
STATE.md into the structured fields the guard and cycle read — `work_queue`
(the `## Work queue` checkbox items), `iterations`, `total_cost_usd`,
`refute_streak`, `started_at`, `done_log` (the append-only `## Done log` rows —
must be repopulated each turn or the log is overwritten to a single entry every
cycle) — and `writeState(patch)` serializes those fields back into STATE.md's
markdown. `mergeQueue(existing, discovered, done)` parses the Discovery step's
output into items and appends those not already queued or in `done`; without it
the Discovery step cannot populate the queue. Until these are
implemented, running the script cannot update STATE.md.

Ask: "Say 'next' to set up the trigger."

---

## Phase 4 — Automations / Trigger

**Building block covered: #1 (Automations/Trigger)**

**Goal:** Pick the right trigger mechanism and produce the config.

Note: `/schedule` and `/loop` are Claude Code built-in skills, not generic
cron tools. `/schedule` creates a cron-scheduled cloud agent that runs even
when the user's laptop is closed. `/loop` runs a prompt or skill on an
interval inside the active session and stops when the session ends. Both are
invokable directly in Claude Code.

Ask the user:

> "How should the loop start each cycle? Options:
> 1. `/schedule` — cron cloud agent; runs unattended; best for nightly/weekly
> 2. `/loop` — runs in your active session on an interval or self-paced; stops when session ends
> 3. GitHub Actions — best when the trigger is a repo event (push, PR, label) or you need an audit trail
>
> Which fits best, or should I recommend based on your task?"

If the user asks for a recommendation, apply this logic:
- Time-based, unattended → `/schedule` (cron)
- Event-based (repo push, PR opened, label added) → GitHub Actions
- Interactive session, self-pacing or exploratory → `/loop`

Then generate the appropriate config:

**For /schedule:** Produce the cron expression and the prompt string the
scheduled agent will receive each run. Show the exact `/schedule` invocation
the user should run once to register it.

**For /loop:** Produce the `/loop <interval> <prompt-or-skill>` command.

**For GitHub Actions:** ⚠️ Warn the user first: the minimal `claude --print`
step below invokes the **maker prompt only** — it does NOT run the `workflow.js`
maker/checker cycle from Phase 2, the STATE.md persistence from Phase 3, or the
hard-limit guards from Phase 5. It trades the full loop for a simple one-shot
CI run with an audit trail. To keep maker/checker + state + limits, have the
step drive `workflow.js` through the Workflow tool (e.g. invoke Claude Code with
a prompt that runs the Phase 2 script) instead of the bare prompt below, and
persist `STATE.md` between runs via `actions/cache` or a committed state file.

Minimal one-shot `.github/workflows/loop.yml` (maker-only, no checker/state/limits):

```yaml
name: loop-agent
on:
  schedule:
    - cron: '<expression>'
  workflow_dispatch:

jobs:
  run-loop:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Claude Code loop
        run: |
          claude --print "<maker prompt from Handoff field>" \
            --allowedTools "Read,Write,Edit,Bash" \
            --max-turns 10
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

Adjust `--allowedTools` to include any MCP connectors identified in Phase 0.

Now go back to `loop-spec.md` and record the confirmed mechanism and cron
expression / interval: fill in the `## Trigger` fields (Fires on / Cadence) and
the **Scheduling** move (move #5 under `## The five moves` in the template; the
`## Scheduling` section if you generated the spec inline).

Ask: "Trigger config generated. Say 'next' to set hard limits — this step is
mandatory."

---

## Phase 5 — Hard Limits (MANDATORY — do not skip or soften)

**Goal:** Set explicit stop conditions. No limits = no loop.

State this clearly to the user:

> **Hard limits are mandatory, not optional.** Agent loops cost roughly 4x
> a simple prompt. Multi-agent loops (maker + checker) can cost ~15x. Without
> explicit limits a runaway loop can spend significant money or run
> indefinitely. Whichever limit trips first must stop the loop immediately.
> The cost limit only works if Phase 3's cost tracking is instrumented in the
> workflow script.

Collect or propose values for all four:

| Limit | Recommended default | User value |
|-------|--------------------|-----------:|
| Max iterations | 10 | ? |
| Max cost (USD) | $2.00 | ? |
| Max wall-clock | 30 min | ? |
| Max refute streak | 3 | ? |

Ask the user to confirm or override each value. Do not accept "unlimited" or
"no limit" for any field — if the user tries, explain the cost risk and ask
again with a concrete suggestion.

Once confirmed, record them in `loop-spec.md`. If you based the spec on the
template, fill in the existing `## Hard limits` table with the confirmed values
(do not add a second section). If you generated the spec inline (no hard-limits
section yet), add one:

```markdown
## Hard Limits
- max_iterations: <N>
- max_cost_usd: <X>
- max_wall_clock_minutes: <M>
- max_refute_streak: <R>
- stop_condition: "whichever trips first"
```

Also wire the guard into the top of the cycle function in `workflow.js`.

If you based `workflow.js` on the template, the guard block already exists
(the `let state = readState()`, `startedAt`, `elapsedMinutes`, and the three
`throw new Error("LIMIT:...")` lines). **Do not add a second copy** — that
would redeclare the same consts and install a conflicting guard. Just:
- Fill the `MAX_ITERATIONS` / `MAX_COST_USD` / `MAX_WALL_CLOCK` /
  `MAX_REFUTE_STREAK` constants with the confirmed values.
- Set `PER_ACTIVATION_WALLCLOCK` = `true` for a `/schedule` trigger (each
  activation reseeds `started_at`, so the wall-clock limit bounds a single
  activation rather than calendar time between activations), or `false` for a
  continuous `/loop` trigger (persist `started_at` so it bounds the whole run).

Only if you generated `workflow.js` from scratch (no template), add this guard
to the top of the cycle function:

```js
// Hard limits — whichever trips first stops the loop
// NOTE: total_cost_usd is only accurate if the workflow script writes it to STATE.md
// after each Agent call (see Phase 3 cost tracking).
// Declare the four MAX_* constants from the loop-spec Hard Limits table:
const MAX_ITERATIONS = <N>;
const MAX_COST_USD = <X>;
const MAX_WALL_CLOCK = <M>;      // minutes
const MAX_REFUTE_STREAK = <R>;   // enforced in the maker/checker conditional (Phase 2)
let state = readState(); // reads STATE.md (let, not const: Discovery reassigns it)
// PER_ACTIVATION_WALLCLOCK: true for /schedule (reseed started_at each activation so
// the limit measures one activation, not calendar time between them); false for a
// continuous /loop (persist started_at so the limit bounds the whole run).
const PER_ACTIVATION_WALLCLOCK = false; // set true for /schedule triggers
// Use `||` (not `??`): the task-complete branch clears started_at to '', which is
// not nullish, so `??` would keep '' and Date.parse('') → NaN, silently disabling
// the wall-clock limit. `||` re-seeds an empty started_at to now.
const startedAt = PER_ACTIVATION_WALLCLOCK
  ? new Date().toISOString()
  : (state.started_at || new Date().toISOString());
const elapsedMinutes = (Date.now() - Date.parse(startedAt)) / 60000;
if (state.iterations >= MAX_ITERATIONS) throw new Error("LIMIT:iterations");
if (state.total_cost_usd >= MAX_COST_USD) throw new Error("LIMIT:cost");
if (elapsedMinutes >= MAX_WALL_CLOCK) throw new Error("LIMIT:wall_clock");
```

The `max_iterations` guard only fires if the workflow script actually increments
the counter. Each turn's persistence branch **must** write
`iterations: state.iterations + 1` back to STATE.md (see the `writeState` calls in
`workflow.example.js`). If iterations never increments, it stays 0 and this guard
can never trip — only the refute-streak limit would ever stop the loop.

Ask: "Hard limits locked in. Say 'next' for the final step: eval logging."

---

## Phase 6 — Eval-Driven Improvement

**Goal:** Generate a log template so the user can improve the loop over time.

Explain:

> A loop you never measure is a loop you can't improve. After each run,
> log: what was found, what was acted on, what the checker rejected, why the
> cycle terminated, and verifier accuracy over time. Review weekly to tighten
> prompts, adjust limits, or fix checker errors — both false negatives
> (checker approved bad output) and false positives (checker refuted good output).

If `templates/eval-log.md` exists alongside this SKILL.md, use it as your
base and fill in task-specific fields. Otherwise generate `eval-log.md` inline:

```markdown
# Eval Log: <task name>

## How to use
After each run cycle, append one row. Review weekly. Tune checker criteria
and maker prompts based on rejection patterns and verifier accuracy trends.

## Log

| Cycle | Date | Duration | Cost USD | Term reason | Maker output summary | Checker verdict | Verifier accuracy (running %) | False neg/pos? | Notes |
|-------|------|----------|----------|-------------|----------------------|-----------------|-------------------------------|-----------------|-------|
| 1 | | | | | | | | | |
```

Also add to `STATE.md` under `## Counters` a reminder comment:
`<!-- Copy token/cost data to eval-log.md after each cycle and update verifier accuracy -->`.

---

## Final Summary

After all 6 phases, print a summary table:

```
## Loop Engineering Scaffold — Complete

| Step | Building block | File(s) generated | Status |
|------|---------------|-------------------|--------|
| 1. Inner Loop | #3 Skills/CLAUDE.md + #4 MCP (spec) | CLAUDE.md, loop-spec.md | ✓ |
| 2. Maker/Checker | #2 Worktrees + #5 Maker/Checker | workflow.js | ✓ |
| 3. Durable State | #6 Durable State | STATE.md | ✓ |
| 4. Trigger | #1 Automations/Trigger | <config file or command> | ✓ |
| 5. Hard Limits | (all blocks) | loop-spec.md + workflow.js | ✓ |
| 6. Eval | (all blocks) | eval-log.md | ✓ |
```

Then say:

> **Next actions:**
> 1. Review `loop-spec.md` — especially the Done / success criterion and MCP connectors.
> 2. Confirm cost tracking is instrumented in `workflow.js` (writes USD to STATE.md).
> 3. Test one manual cycle: run the Workflow script once and watch STATE.md update.
> 4. Confirm the checker is actually rejecting bad output — run a broken maker
>    prompt on purpose and verify `verdict.refuted` is true.
> 5. Activate the trigger only after a clean manual test passes.
> 6. After 3 cycles, review `eval-log.md` and tune checker criteria and maker prompts.

> Loop engineering reference: Addy Osmani's "Loop Engineering" (June 2026),
> Anthropic "Building Effective Agents", "Effective Context Engineering".
> This paradigm is community-named — not an official Anthropic product.