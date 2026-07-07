# loop-engineering

A Claude Code plugin that helps you **design and scaffold self-prompting agent loops** —
"loop engineering." Instead of prompting an agent by hand each time, you describe a
recurring task once and the plugin generates a runnable loop for it.

> **What is loop engineering?** Stop prompting the agent yourself; design the loop that
> prompts it for you. Anthropic's official guide — *Getting Started with Loops*
> (claude.com/blog, 2026) — defines a loop as "an agent repeating cycles of work until a
> stop condition is met", built from a **trigger, verification, and stop condition**, and
> classifies loops as turn-based, goal-based (`/goal`), time-based (`/loop`, `/schedule`),
> or proactive. The *name* "loop engineering" is community coinage (Addy Osmani, June
> 2026, building on *Building Effective Agents* and statements by Boris Cherny) — the
> official docs simply say "loops".

## What it does

Describe the recurring task you want to automate — e.g. "set up a loop to triage
failing tests every night" or "automate our dependency bumps" — and this skill
activates (it triggers on phrases like those, per its description). It then
**interviews you** about the task and generates the **6-step adoption path** as
real files:

1. **Inner loop** → `loop-spec.md` — the task decomposed into discovery → handoff → verification → persistence → scheduling
2. **Maker/Checker** → `workflow.js` wired to the bundled `maker` / `checker` sub-agents — generation and verification as *separate* agents; the checker defaults to **refute** mode
3. **Durable state** → `STATE.md` — the loop's memory on disk, not in the context window
4. **Automation/Trigger** → `/goal` (goal-based pilot), `/loop`, `/schedule` (cron), GitHub Actions — or the **proactive composition** (`/schedule` + verifiable per-task goal + the workflow + auto mode) for fully unattended streams of work
5. **Hard limits** → max iterations / cost / wall-clock — whichever trips first stops the loop
6. **Eval-driven improvement** → a log tracking cost, termination reason, verifier accuracy

> ⚠️ Loops multiply token spend — every cycle re-runs discovery + maker + checker, and
> multi-agent patterns can spawn hundreds of agents. The scaffold bakes in the official
> token guidance: pilot on a small slice first, review `/usage`, script deterministic
> moves instead of spending agent turns on them, and don't run the routine more often
> than new work arrives. Hard limits (step 5) are mandatory, not optional.

## Install

Add this repo as a marketplace:

```sh
/plugin marketplace add namasugi/loop-engineering
```

Install the plugin from it:

```sh
/plugin install loop-engineering@loop-engineering
```

Restart your Claude Code session if the new skill isn't picked up immediately.

To pull later updates (no re-add needed):

```sh
/plugin marketplace update loop-engineering
```

## Usage

Invoke the design skill directly with the task as its argument:

```sh
/loop-engineering:design triage failing CI tests every night
```

Or just describe the task in plain language — the skill auto-activates on phrases
like "set up a loop for…", "automate this task", or "run this every night":

```text
Set up a loop that reviews new PRs and leaves comments.
```

Either way, the skill then **interviews you** (task, side-effects/MCP, CLAUDE.md,
which model the maker/checker run on) and walks you through all six steps, writing
the scaffold files listed in [What it does](#what-it-does): `loop-spec.md`,
`workflow.js`, `STATE.md`, a trigger config, hard limits, and `eval-log.md`.

After the scaffold is generated:

1. **Review** `loop-spec.md` — especially the success definition and any MCP connectors.
2. **Implement** the `readState` / `writeState` / `mergeQueue` stubs in `workflow.js` for your runtime.
3. **Dry-run one cycle** with the Workflow tool and watch `STATE.md` update before automating.
4. **Activate the trigger** (`/goal`, `/schedule`, `/loop`, GitHub Actions, or the proactive composition) only after a clean manual run.
5. **Review** `eval-log.md` after a few cycles and tune the maker prompt / checker criteria.

## Layout

```
loop-engineering/
├── .claude-plugin/
│   ├── marketplace.json     # distribution definition
│   └── plugin.json          # plugin manifest (namespace: loop-engineering)
├── agents/
│   ├── maker.md             # generator sub-agent
│   └── checker.md           # refute-mode verifier sub-agent
└── skills/
    └── design/
        ├── SKILL.md         # the interview + scaffolder
        └── templates/       # loop-spec.md, STATE.md, workflow.example.js, eval-log.md
```

## License

MIT
