// Step ② Maker / Checker — the core of loop engineering.
// Generation and verification MUST be separate agents: a model grading its own
// homework is too kind. The checker DEFAULTS TO REFUTE (assume the work is wrong).
//
// This plugin ships reusable sub-agents `maker` and `checker` (see ../../agents/),
// referenced below via agentType so you don't re-write their roles each loop.
//
// Run this with the Workflow tool. Fill every {{placeholder}} from your loop-spec.md.
// Use isolation:"worktree" only if multiple makers mutate files in parallel.

export const meta = {
  name: '{{loop-name}}',
  description: '{{One-line: what one turn of this loop does}}',
  // Uncomment only if multiple makers mutate files in parallel — isolates each
  // run in its own branch/worktree copy so concurrent edits don't collide:
  // isolation: 'worktree',
  phases: [
    { title: 'Discover', detail: '{{re-populate the work queue}}' },
    { title: 'Make', detail: '{{maker generates the work}}' },
    { title: 'Check', detail: 'refute-mode verification' },
  ],
}

// Hard-limit constants — set these from your loop-spec.md ## Hard Limits table.
const MAX_ITERATIONS    = {{N}}   // max_iterations
const MAX_COST_USD      = {{X}}   // max_cost_usd
const MAX_WALL_CLOCK    = {{T}}   // max_wall_clock_minutes
const MAX_REFUTE_STREAK = {{R}}   // max_refute_streak

const VERDICT = {
  type: 'object',
  properties: {
    refuted: { type: 'boolean', description: 'true if the work is wrong/incomplete' },
    reasons: { type: 'array', items: { type: 'string' } },
    fix_hint: { type: 'string' },
  },
  required: ['refuted', 'reasons'],
}

// One turn = one call of this cycle function, re-invoked by the trigger.
// The Workflow tool runs runTurn(); the top-of-cycle guard and the
// verify-then-act persistence branch both live inside it.
export async function runTurn() {

// Reads/writes loop state from STATE.md — implement or import for your runtime.
let state = readState()
// writeState(patch) merges patch into STATE.md and saves.

// Top-of-turn hard-limit guard — whichever trips first stops the loop.
// Each run is one turn re-invoked by the trigger, so these must read persisted
// counters (iterations is incremented below; total_cost_usd is written by your
// cost instrumentation after each agent call — see loop-spec.md / SKILL Phase 3).
// started_at scopes the wall-clock limit; how depends on your trigger (loop-spec.md
// ## Trigger). Continuous loops re-invoke turns back-to-back, so persist started_at
// across turns and wall-clock bounds the whole run (`||`, not `??`, re-seeds a
// cleared/empty value). Scheduled loops (e.g. /schedule nightly) activate once per
// run, spaced hours/days apart: persisting started_at would make elapsedMinutes
// measure CALENDAR time between activations and trip the guard permanently, so reseed
// per activation. Set this true for /schedule (per-activation) triggers.
const PER_ACTIVATION_WALLCLOCK = {{true for /schedule triggers, false for continuous loops}}
const startedAt = PER_ACTIVATION_WALLCLOCK
  ? new Date().toISOString()
  : (state.started_at || new Date().toISOString())
const elapsedMinutes = (Date.now() - Date.parse(startedAt)) / 60000
// On a tripped hard limit, mark the run 'aborted' and record which limit in
// blocked_reason (→ STATE.md ## Blocked / needs human) so STATE.md isn't left stale
// for the human inspecting it, then stop.
const abort = (reason) => { writeState({ ...state, state: 'aborted', blocked_reason: reason }); throw new Error(`LIMIT:${reason}`) }
if ((state.iterations ?? 0) >= MAX_ITERATIONS) abort("iterations")
if ((state.total_cost_usd ?? 0) >= MAX_COST_USD) abort("cost")
if (elapsedMinutes >= MAX_WALL_CLOCK) abort("wall_clock")

// Move #1 Discovery — run EVERY turn (before the empty-queue check below) to
// (re)populate the work queue via the loop-spec Discovery move. This is what makes
// monitoring / syncing / continuous loops work: without it the queue only drains and
// the loop dies permanently the first time it empties (even the next /schedule
// activation would read an empty queue and terminate). For a fixed pre-seeded backlog
// this may legitimately return nothing — the queue just drains to done.
phase('Discover')
const discovered = await agent(
  `{{DISCOVERY PROMPT — run the loop-spec Discovery move: scan the source (files,
    API, tickets, CI…) and list NEW work items, one per line, excluding anything
    already in the current queue ${JSON.stringify(state.work_queue ?? [])} or
    done log ${JSON.stringify(state.done_log ?? [])}.}}`,
  { label: 'discovery', phase: 'Discover', model: 'opus' }
)
// mergeQueue: parse discovered items into an array and append those not already
// queued or done. Implement alongside readState/writeState for your runtime.
state = { ...state, work_queue: mergeQueue(state.work_queue ?? [], discovered, state.done_log ?? []) }
// Persist the merged queue (and next_action) NOW, before the maker runs, so the
// maker reads from STATE.md the exact same queue/item this turn will act on.
// Without this, STATE.md still holds the pre-discovery (possibly empty/template)
// queue and the maker acts on the wrong item — or nothing. The empty-queue done
// branch below harmlessly overwrites this write.
writeState({ ...state, next_action: state.work_queue[0] })

// Task-complete branch — when the work queue is STILL empty after Discovery there is
// nothing left to do. Mark the run `done` and CLEAR started_at (set to '') so a later
// restart of a continuous loop begins a fresh wall-clock window rather than counting
// time since the original run. (Scheduled loops already reseed via
// PER_ACTIVATION_WALLCLOCK above.) Adapt the emptiness check to STATE.md.
if ((state.work_queue?.length ?? 0) === 0) {
  writeState({ ...state, state: 'done', started_at: '' })
  return { acted: false, done: true }
}

// --- One turn: make, then independently check (refute by default) ---
phase('Make')
const work = await agent(
  `{{MAKER PROMPT — do this item from STATE.md's work queue: ${state.work_queue[0]}. Discovery → handoff.}}`,
  { label: 'maker', phase: 'Make', agentType: 'maker', model: 'opus' }
)

phase('Check')
// The bundled `maker` / `checker` agents both run on Opus (capability matters most for
// catching subtle defects). agent() defaults to Sonnet unless model is pinned on the
// call, so we pin `model: 'opus'` here explicitly rather than relying on agentType to
// carry the sub-agent frontmatter model. Independence comes from separate context +
// refute framing, not a weaker model — change `model` only if you want deliberate diversity.
const verdict = await agent(
  `WORK TO VERIFY:\n${work}\n\n{{CHECKER CRITERIA — tests pass? criteria from loop-spec met?}}`,
  { label: 'checker', phase: 'Check', agentType: 'checker', schema: VERDICT, model: 'opus' }
)

// Cost accrued by this turn's agent() calls. Fill from the Workflow tool's token
// counts × the model's published rates; both writeState calls below persist it so
// the MAX_COST_USD guard can actually trip. Left at 0 = cost limit never fires.
const turnCostUsd = 0 // TODO: compute from discovery+maker+checker token usage

// --- Verify-then-act: only persist/act when the checker is satisfied ---
if (verdict.refuted) {
  // Step ④/⑤: do NOT act. Increment the streak counter and record the refutation.
  // Abort if the refute-streak limit from loop-spec.md (max_refute_streak) is hit.
  const newStreak = (state.refute_streak ?? 0) + 1
  // Record the checker's refutation so the NEXT maker turn (which reads only STATE.md,
  // not this return value) sees why it failed and can fix it instead of retrying blind.
  const refutation = verdict.fix_hint ?? verdict.reasons?.join('; ')
  writeState({ ...state, started_at: startedAt, iterations: (state.iterations ?? 0) + 1, refute_streak: newStreak,
    last_turn_summary: `refuted: ${refutation}`,
    total_cost_usd: (state.total_cost_usd ?? 0) + turnCostUsd }) // TODO: set turnCostUsd from Workflow tool token counts (see SKILL Phase 3)
  if (newStreak >= MAX_REFUTE_STREAK) {
    // Patch ONLY the changed fields here (writeState merges into STATE.md): re-spreading
    // stale `state` would clobber the iterations+1 / refute_streak / total_cost_usd /
    // last_turn_summary just persisted above, leaving STATE.md one turn behind.
    writeState({ state: 'aborted', blocked_reason: `refute_streak — ${refutation}` })
    throw new Error("LIMIT:refute_streak")
  }
  return { acted: false, verdict }
}

// Step ④ Persistence + side effects (gated behind the checker passing).
// Increment the iteration counter (so MAX_ITERATIONS can trip) and reset
// refute_streak on a passing turn, then write other STATE.md fields.
// CRITICAL: advance the work queue — drop the item we just completed so the
// maker moves on and the empty-queue 'done' branch above can eventually fire.
// Without this the queue never shrinks and the loop only ends via a hard limit.
// Also record progress (last_turn_summary + done-log) per the STATE template.
// Irreversible actions (push/deploy/send) belong here, AFTER verification — and only if
// loop-spec.md marked them auto-OK; otherwise surface to a human.
const [completed, ...remaining] = state.work_queue
writeState({ ...state, started_at: startedAt, iterations: (state.iterations ?? 0) + 1, refute_streak: 0,
  work_queue: remaining, // maker.md always takes the first unchecked item, so drop it here
  next_action: remaining[0], // next turn's item; maker.md reads next_action as its primary signal
  last_turn_summary: `{{one-line summary of ${completed}}}`,
  done_log: [...(state.done_log ?? []), `${new Date().toISOString()} — ${completed} (checker: passed)`],
  total_cost_usd: (state.total_cost_usd ?? 0) + turnCostUsd }) // TODO: set turnCostUsd from Workflow tool token counts (see SKILL Phase 3)
return { acted: true, work, verdict }
}
