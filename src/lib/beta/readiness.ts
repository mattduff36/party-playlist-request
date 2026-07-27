/**
 * Event readiness wizard scoring and gates (PRD-08).
 */

export type LifecyclePhase =
  | 'draft'
  | 'ready'
  | 'pre_event'
  | 'live'
  | 'paused'
  | 'degraded'
  | 'ended'
  | 'archived';

export type ReadinessCheckId =
  | 'basics'
  | 'playback_mode'
  | 'spotify_connect'
  | 'spotify_device'
  | 'moderation'
  | 'guest_access'
  | 'display_theme'
  | 'signage'
  | 'e2e_test'
  | 'recovery'
  | 'ready_confirm';

export type ReadinessSeverity = 'required' | 'warning' | 'optional';

export interface ReadinessCheckDefinition {
  id: ReadinessCheckId;
  label: string;
  severity: ReadinessSeverity;
  step: number;
}

export interface ReadinessCheckState {
  id: ReadinessCheckId;
  completed: boolean;
  failed?: boolean;
  warning?: boolean;
  overridden?: boolean;
  note?: string;
  updatedAt?: string;
}

export interface ReadinessState {
  checks: Partial<Record<ReadinessCheckId, ReadinessCheckState>>;
  currentStep: number;
  markedReadyAt?: string | null;
  readyOverrideReason?: string | null;
}

export const READINESS_CHECKS: ReadinessCheckDefinition[] = [
  { id: 'basics', label: 'Name, date/time, venue', severity: 'required', step: 1 },
  { id: 'playback_mode', label: 'Spotify or manual mode', severity: 'required', step: 2 },
  {
    id: 'spotify_connect',
    label: 'Spotify connected',
    severity: 'required',
    step: 3,
  },
  {
    id: 'spotify_device',
    label: 'Playback device verified',
    severity: 'required',
    step: 3,
  },
  { id: 'moderation', label: 'Moderation rules', severity: 'required', step: 4 },
  { id: 'guest_access', label: 'Guest access configured', severity: 'required', step: 5 },
  { id: 'display_theme', label: 'Display / theme setup', severity: 'warning', step: 6 },
  { id: 'signage', label: 'QR / signage preview', severity: 'warning', step: 7 },
  { id: 'e2e_test', label: 'Test request + approval', severity: 'required', step: 8 },
  { id: 'recovery', label: 'Recovery checklist reviewed', severity: 'warning', step: 9 },
  {
    id: 'ready_confirm',
    label: 'Final Ready confirmation',
    severity: 'required',
    step: 9,
  },
];

export function emptyReadinessState(): ReadinessState {
  return { checks: {}, currentStep: 1 };
}

export function parseReadinessState(raw: unknown): ReadinessState {
  if (!raw || typeof raw !== 'object') return emptyReadinessState();
  const obj = raw as Record<string, unknown>;
  const checks =
    obj.checks && typeof obj.checks === 'object'
      ? (obj.checks as ReadinessState['checks'])
      : {};
  return {
    checks,
    currentStep:
      typeof obj.currentStep === 'number' && obj.currentStep >= 1
        ? obj.currentStep
        : 1,
    markedReadyAt:
      typeof obj.markedReadyAt === 'string' ? obj.markedReadyAt : null,
    readyOverrideReason:
      typeof obj.readyOverrideReason === 'string'
        ? obj.readyOverrideReason
        : null,
  };
}

export interface EvaluateReadinessInput {
  state: ReadinessState;
  playbackMode: 'spotify' | 'manual' | string;
  spotifyConnected: boolean;
  hasActiveDevice: boolean;
  eventTitle: string;
  /** Explicit organiser override only for non-critical warnings */
  allowWarningOverride?: boolean;
  overrideReason?: string | null;
}

export interface EvaluateReadinessResult {
  score: number;
  maxScore: number;
  canMarkReady: boolean;
  blockingFailures: ReadinessCheckId[];
  warningFailures: ReadinessCheckId[];
  /** True until Mark Ready persists ready_confirm / markedReadyAt */
  readyConfirmPending: boolean;
  lifecyclePhase: LifecyclePhase;
}

function isCheckDone(state: ReadinessState, id: ReadinessCheckId): boolean {
  const c = state.checks[id];
  if (!c) return false;
  if (c.failed && !c.overridden) return false;
  return Boolean(c.completed || c.overridden);
}

/**
 * Evaluate readiness. Spotify device/connect required only in spotify mode.
 * Required failures block Ready unless completed. Warnings may be overridden.
 */
export function evaluateReadiness(
  input: EvaluateReadinessInput
): EvaluateReadinessResult {
  const applicable = READINESS_CHECKS.filter((check) => {
    if (input.playbackMode === 'manual') {
      return check.id !== 'spotify_connect' && check.id !== 'spotify_device';
    }
    return true;
  });

  const blockingFailures: ReadinessCheckId[] = [];
  const warningFailures: ReadinessCheckId[] = [];

  for (const check of applicable) {
    // Mark Ready itself is the final confirmation — never chicken-and-egg gate on it.
    if (check.id === 'ready_confirm') {
      continue;
    }

    // Live-derived requirements (not only wizard ticks)
    if (check.id === 'basics' && !input.eventTitle?.trim()) {
      blockingFailures.push('basics');
      continue;
    }
    if (
      check.id === 'spotify_connect' &&
      input.playbackMode === 'spotify' &&
      !input.spotifyConnected
    ) {
      blockingFailures.push('spotify_connect');
      continue;
    }
    if (
      check.id === 'spotify_device' &&
      input.playbackMode === 'spotify' &&
      !input.hasActiveDevice
    ) {
      blockingFailures.push('spotify_device');
      continue;
    }

    if (isCheckDone(input.state, check.id)) continue;

    if (check.severity === 'required') {
      blockingFailures.push(check.id);
    } else if (check.severity === 'warning') {
      warningFailures.push(check.id);
    }
  }

  const readyConfirmDone =
    isCheckDone(input.state, 'ready_confirm') ||
    Boolean(input.state.markedReadyAt);

  const completedCount = applicable.filter((c) => {
    if (c.id === 'ready_confirm') return readyConfirmDone;
    if (blockingFailures.includes(c.id) || warningFailures.includes(c.id)) {
      return false;
    }
    return true;
  }).length;

  const maxScore = applicable.length;
  const score = Math.round((completedCount / Math.max(maxScore, 1)) * 100);

  const warningsOk =
    warningFailures.length === 0 ||
    (Boolean(input.allowWarningOverride) &&
      Boolean(input.overrideReason?.trim()));

  // ready_confirm is applied by the Mark Ready action; it must not block canMarkReady.
  const canMarkReady = blockingFailures.length === 0 && warningsOk;

  return {
    score,
    maxScore,
    canMarkReady,
    blockingFailures,
    warningFailures,
    readyConfirmPending: !readyConfirmDone,
    lifecyclePhase: canMarkReady && input.state.markedReadyAt ? 'ready' : 'draft',
  };
}

export function mergeCheckUpdate(
  state: ReadinessState,
  update: ReadinessCheckState
): ReadinessState {
  return {
    ...state,
    checks: {
      ...state.checks,
      [update.id]: {
        ...state.checks[update.id],
        ...update,
        updatedAt: new Date().toISOString(),
      },
    },
  };
}

/** Lifecycle phases where Mark Ready / recovery confirm CTAs should collapse. */
export function isReadinessLifecycleComplete(
  phase: LifecyclePhase | string
): boolean {
  return phase === 'ready' || phase === 'live';
}
