# loop-engineering

A Claude Code plugin that helps you **design and scaffold self-prompting agent loops** —
"loop engineering." Instead of prompting an agent by hand each time, you describe a
recurring task once and the plugin generates a runnable loop for it.

> **What is loop engineering?** Stop prompting the agent yourself; design the loop that
> prompts it for you. The term was named/codified by Addy Osmani (June 2026), building on
> Anthropic's *Building Effective Agents* and *Effective Context Engineering* and on
> statements by Boris Cherny (Claude Code lead) and Peter Steinberger. It is a
> community-named paradigm — **not an official Anthropic product term.**

## What it does

Describe the recurring task you want to automate — e.g. "set up a loop to triage
failing tests every night" or "automate our dependency bumps" — and this skill
activates (it triggers on phrases like those, per its description). It then
**interviews you** about the task and generates the **6-step adoption path** as
real files:

1. **Inner loop** → `loop-spec.md` — the task decomposed into discovery → handoff → verification → persistence → scheduling
2. **Maker/Checker** → `workflow.js` wired to the bundled `maker` / `checker` sub-agents — generation and verification as *separate* agents; the checker defaults to **refute** mode
3. **Durable state** → `STATE.md` — the loop's memory on disk, not in the context window
4. **Automation/Trigger** → schedule via `/loop`, `/schedule` (cron), or GitHub Actions
5. **Hard limits** → max iterations / cost / wall-clock — whichever trips first stops the loop
6. **Eval-driven improvement** → a log tracking cost, termination reason, verifier accuracy

> ⚠️ Agent loops can cost ~4× a simple prompt (~15× for multi-agent). Hard limits (step 5)
> are mandatory, not optional.

## Install

```sh
# add this repo as a local marketplace
/plugin marketplace add ~/work/tools/loop-engineering

# install the plugin
/plugin install loop-engineering@loop-engineering
```

Restart your Claude Code session if the new skill isn't picked up immediately.

Then describe the task you want to automate (the skill activates on phrases like
"set up a loop for…" or "automate this task") and answer the interview.

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
