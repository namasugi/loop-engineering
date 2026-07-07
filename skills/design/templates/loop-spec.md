# Loop Spec — {{LOOP_NAME}}

> Step ① of the loop-engineering adoption path. One loop = one small task, decomposed
> into the five moves. If you can't fill every field below, the loop is too big — shrink it.

## Goal (one sentence)
{{What this loop accomplishes when it runs once, e.g. "Address every unresolved review thread on the current PR."}}

## Trigger
- Fires on: {{cron schedule | event (CI done, PR comment, log line) | manual /goal or /loop}}
- Cadence / interval: {{e.g. every 30 min, on push, hourly}}
- Why this cadence: {{how often new work actually arrives — don't run more often than you need to; an idle cycle still pays discovery + maker + checker}}
- Unattended permissions: {{n/a (attended) | auto mode | allowlist of tools/MCP connectors — irreversible actions stay human-gated per Blast radius below}}

## The five moves (one turn)
1. **Discovery** — how the loop finds work to do: {{e.g. `gh pr view` for unresolved threads}}
2. **Handoff** — who/what does the work: {{maker sub-agent / a slash command / a script}}
3. **Verification** — how the result is judged (independent of the maker): {{checker sub-agent in refute mode / a test suite / a lint gate}}
4. **Persistence** — what is written to durable state: {{updated STATE.md fields, see templates/STATE.md}}
5. **Scheduling** — when the next turn runs: {{re-arm schedule / stop if done}}

## Done / success criterion
The loop has succeeded when: {{measurable condition, e.g. "0 unresolved threads AND CI green"}}

## Failure / abort criterion
Stop and surface to a human when: {{e.g. "checker refutes 3x in a row" / "tests fail after fix"}}

## Hard limits (Step ⑤ — mandatory, not optional)
| Limit | Value | Why |
|---|---|---|
| Max iterations | {{N}} | runaway backstop |
| Max cost (tokens / $) | {{X}} | every cycle re-runs discovery + maker + checker; pilot small, review /usage |
| Max wall-clock | {{T}} | don't run forever |
| max_refute_streak | {{R, e.g. 3}} | abort if checker refutes this many turns in a row |

Whichever trips **first** stops the loop.

## Required MCP Connectors
<!-- List each system the loop must write to and the MCP connector needed -->
| System | Action | MCP connector |
|--------|--------|--------------|
| {{e.g. GitHub}} | {{e.g. open PR}} | {{e.g. github MCP server}} |

## Blast radius
- Reversible actions (edits, tests): {{auto-proceed}}
- Irreversible actions (push, deploy, send, delete): {{require human approval? Y/N}}
