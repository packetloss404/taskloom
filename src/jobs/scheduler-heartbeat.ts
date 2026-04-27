export interface SchedulerHeartbeat {
  schedulerStartedAt: string | null;
  lastTickStartedAt: string | null;
  lastTickEndedAt: string | null;
  lastTickDurationMs: number | null;
  ticksSinceStart: number;
}

interface HeartbeatState {
  schedulerStartedAt: string | null;
  lastTickStartedAt: string | null;
  lastTickStartedAtMs: number | null;
  lastTickEndedAt: string | null;
  lastTickDurationMs: number | null;
  ticksSinceStart: number;
}

function baselineState(): HeartbeatState {
  return {
    schedulerStartedAt: null,
    lastTickStartedAt: null,
    lastTickStartedAtMs: null,
    lastTickEndedAt: null,
    lastTickDurationMs: null,
    ticksSinceStart: 0,
  };
}

let state: HeartbeatState = baselineState();

function defaultNow(): Date {
  return new Date();
}

export function recordSchedulerStart(now: () => Date = defaultNow): void {
  const date = now();
  state = baselineState();
  state.schedulerStartedAt = date.toISOString();
}

export function recordSchedulerStop(): void {
  state = baselineState();
}

export function recordTickStart(now: () => Date = defaultNow): void {
  const date = now();
  state.lastTickStartedAt = date.toISOString();
  state.lastTickStartedAtMs = date.getTime();
}

export function recordTickEnd(now: () => Date = defaultNow): void {
  const date = now();
  state.lastTickEndedAt = date.toISOString();
  if (state.lastTickStartedAtMs !== null) {
    state.lastTickDurationMs = date.getTime() - state.lastTickStartedAtMs;
  } else {
    state.lastTickDurationMs = null;
  }
  state.ticksSinceStart += 1;
}

export function getSchedulerHeartbeat(): SchedulerHeartbeat {
  return {
    schedulerStartedAt: state.schedulerStartedAt,
    lastTickStartedAt: state.lastTickStartedAt,
    lastTickEndedAt: state.lastTickEndedAt,
    lastTickDurationMs: state.lastTickDurationMs,
    ticksSinceStart: state.ticksSinceStart,
  };
}

export function __resetSchedulerHeartbeatForTests(): void {
  state = baselineState();
}
