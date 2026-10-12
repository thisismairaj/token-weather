import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { HistoryEntry } from '../types'

const MAX_HISTORY = 12
const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']

const live = atom({ plugin: 'token-weather', key: 'live' } as const, null)
const history = atom({ plugin: 'token-weather', key: 'history' } as const, [])

type Tier = { icon: string; word: string; color: string }

const TIERS: readonly Tier[] = [
  { icon: '☀', word: 'Clear', color: 'yellow' },
  { icon: '☁', word: 'Cloudy', color: 'cyan' },
  { icon: '☂', word: 'Showers', color: 'blue' },
  { icon: '☇', word: 'Storm', color: 'magenta' },
  { icon: '↯', word: 'Compact soon', color: 'red' },
]

function tierFor(percent: number): Tier {
  if (percent < 25) return TIERS[0]!
  if (percent < 50) return TIERS[1]!
  if (percent < 75) return TIERS[2]!
  if (percent < 90) return TIERS[3]!
  return TIERS[4]!
}

// "134.4k", "200k" (whole-k values drop the decimal), "320" under 1k.
function formatTokens(n: number): string {
  if (n < 1000) return String(Math.round(n))
  const k = Math.round((n / 1000) * 10) / 10
  return (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + 'k'
}

// One block per finalized turn, scaled against the context window - not
// against each other - so the chart reads as "how full," matching the %.
function sparkline(entries: readonly HistoryEntry[], windowSize: number): string {
  return entries
    .map(({ tokens }) => {
      const ratio = Math.max(0, Math.min(1, tokens / windowSize))
      const idx = Math.min(BLOCKS.length - 1, Math.floor(ratio * BLOCKS.length))
      return BLOCKS[idx]
    })
    .join('')
}

export const register: Register = on => {
  // Fires whenever usage changes - finer-grained than once per turn, so the
  // live %/tokens tick during a turn's own tool calls, not just at its end.
  on('session.measure', ($, e, next) => {
    const { context, changed } = e

    if (changed.includes('context') && context.tokens !== undefined && context.percent !== undefined) {
      void update($, live, () => ({
        tokens: context.tokens!,
        window: context.window,
        percent: context.percent!,
      }))
    }

    return next(e)
  })

  // Fires once per turn - this is where one point lands in the 12-turn
  // history, so "last turn added" means exactly that, not a mid-turn blip.
  // Skip a subagent's turn (e.agentId present) - it runs in its own context
  // window, not the one this band is forecasting.
  on('turn.complete', async ($, e, next) => {
    if (e.agentId) return next(e)

    const usage = await $.session.usage()
    const { tokens, window: windowSize, percent } = usage.context

    if (tokens !== undefined && percent !== undefined) {
      await update($, live, () => ({ tokens, window: windowSize, percent }))
      await update($, history, list => [...list, { tokens }].slice(-MAX_HISTORY))
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const current = await read($, live)
    if (current === null) return next(e) // nothing measured yet this session

    const entries = await read($, history)
    const tier = tierFor(current.percent)
    const chart = sparkline(entries, current.window)
    const prevTokens = entries.length >= 2 ? entries[entries.length - 2]!.tokens : 0
    const delta = entries.length >= 1 ? entries[entries.length - 1]!.tokens - prevTokens : 0
    const arrow = delta >= 0 ? '▲' : '▼'
    const sign = delta >= 0 ? '+' : '-'

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="row">
        <Text color={tier.color}>
          {tier.icon} {tier.word}
        </Text>
        <Text>{'  '}</Text>
        <Text>{Math.round(current.percent)}%</Text>
        <Text>{'  '}</Text>
        <Text dimColor>
          {formatTokens(current.tokens)} / {formatTokens(current.window)}
        </Text>
        {chart.length > 0 && (
          <>
            <Text>{'  '}</Text>
            <Text>{chart}</Text>
          </>
        )}
        <Text>{'  '}</Text>
        <Text dimColor>
          {arrow} {sign}{formatTokens(Math.abs(delta))} last turn
        </Text>
      </Box>
    )
  })
}
