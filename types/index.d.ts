export type LiveUsage = {
  tokens: number;
  window: number;
  percent: number;
};

export type HistoryEntry = {
  tokens: number;
};

declare module 'claude-code' {
  interface PluginState {
    'token-weather': {
      live: LiveUsage | null;
      history: HistoryEntry[];
    };
  }
}
