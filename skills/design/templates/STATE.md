# STATE — {{LOOP_NAME}}

> Step ③ Durable State. This file IS the loop's memory. Read it at the start of every
> turn, write it at the end. NEVER rely on the context window to remember across turns —
> long-running loops break the moment you use context as memory.

## Status
- state: `idle` | `running` | `blocked` | `done` | `aborted`
- updated: {{ISO-8601 timestamp — stamp this each write}}

## Counters (enforced against the hard limits in loop-spec.md)
- iterations: 0
- total_cost_usd: 0        # the hard-limit guard reads THIS field; the workflow must write it each cycle
- cost_tokens: 0        # optional; the guard uses total_cost_usd — fill this by hand only if you copy token counts to eval-log.md
- refute_streak: 0         # consecutive checker refutals; the workflow enforces MAX_REFUTE_STREAK against it
- started_at:            # leave empty; the workflow seeds this on the first turn and clears it when the run finishes

## Progress
- last_turn_summary: {{one line: what the maker did and what the checker said}}
- next_action: {{the single next thing to do on the next turn}}

## Work queue (discovery output)
- [ ] {{item}}
- [ ] {{item}}

## Done log (append-only)
- {{ISO-8601}} — {{what was completed + checker verdict}}

## Blocked / needs human
- {{empty, or: reason the loop stopped and what a human must decide}}
