<h1 align="center">token-weather</h1>

<p align="center">
  A live weather forecast of your context window, in the band above the prompt.
</p>

---

## What it looks like

```
☁ Cloudy  42%  84.2k / 200k  ▁▂▃▄▅▅▆  ▲ +6.1k last turn
```

Five tiers, same read as an actual forecast: `☀ Clear` under 25% full, through `☁ Cloudy`, `☂ Showers`, `☇ Storm`, up to `↯ Compact soon` past 90%. Each tier has its own color, so the band is readable at a glance without reading the number first.

Next to the tier: the percent, the raw token count against the window (`84.2k / 200k`), a 12-turn sparkline scaled against the window size (not against each other, so the chart reads as "how full," matching the percent), and a delta arrow showing how much the last turn added or (after a compaction) removed.

## Why

Claude Code already shows context usage, but only as a number you have to go looking for. This turns it into something you read the way you'd glance at an actual weather band: a color and a shape, no math required, updating live as a turn runs instead of only at its end.

## Install

```
/plugin install token-weather --marketplace thisismairaj/token-weather
```

That's it. The band shows up above the prompt once there's been at least one turn to measure.

## How it works

This is a [Claude Code mod](https://github.com/anthropics/claude-code) built entirely from function hooks, no CLI, no build step, no npm dependencies:

- **`session.measure`** fires on every usage change, finer-grained than once per turn, so the live percent and token count tick during a turn's own tool calls, not just at the end.
- **`turn.complete`** fires once per finished turn (skipping a subagent's own turn, which runs in its own context window) and appends one point to a 12-turn rolling history, which is where the sparkline and the delta arrow come from.
- **`ui.render`** on the `AbovePrompt` component draws the band itself, reading the live state and history back out and composing them into the `Box`/`Text` tree the terminal (or desktop) actually paints.

State lives in `$.state` (`atom`/`read`/`update` from `claude-code`), not a module variable, so it survives the hot reloads that happen constantly while developing a mod this way.

## Development

Built and iterated entirely inside a live Claude Code session, using the engine's own hot-reload: a mod saved to its dev-mods folder reloads on save, no restart, no separate build step, since `hooks/register.tsx` runs directly as TypeScript/JSX.

```bash
claude plugin validate .   # checks the manifest and hooks module the way the engine will
```

## License

MIT
