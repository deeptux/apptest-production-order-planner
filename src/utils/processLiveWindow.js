import { batchScheduleAnchorMsSingapore } from './planDisplay';
import {
  getProcessWindowStartOffsetMinutes,
  getProcessWindowEndOffsetMinutes,
  isLegacyProcessSectionId,
  getProcMinutesForPlanSection,
} from './stageDurations';

/**
 * Wall-clock window [startMs, endMs] for a plan row while it is in `processId` (line segment).
 */
export function getRowProcessWindowMs(row, processId, sortedProcesses) {
  const anchor = batchScheduleAnchorMsSingapore(row);
  if (anchor == null || row?.isBreak) return null;

  if (isLegacyProcessSectionId(processId, sortedProcesses)) {
    const startOff = getProcessWindowStartOffsetMinutes(row, processId, sortedProcesses);
    const endOff = getProcessWindowEndOffsetMinutes(row, processId, sortedProcesses);
    if (startOff == null || endOff == null) return null;
    return {
      startMs: anchor + startOff * 60000,
      endMs: anchor + endOff * 60000,
    };
  }

  const list = Array.isArray(sortedProcesses) ? sortedProcesses : [];
  let cum = 0;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const m = Number(getProcMinutesForPlanSection(row, p.id, list)) || 0;
    if (p.id === processId) {
      return {
        startMs: anchor + cum * 60000,
        endMs: anchor + (cum + m) * 60000,
      };
    }
    cum += m;
  }
  return null;
}

/**
 * Which step index (0-based) is active given elapsed minutes within the process window.
 */
export function activeStepIndexFromElapsed(elapsedMinutes, steps) {
  if (!steps?.length) return -1;
  const total = steps.reduce((s, st) => s + Math.max(0, Number(st.minutes) || 0), 0);
  const e = Math.max(0, Number(elapsedMinutes) || 0);
  if (total <= 0) {
    return Math.min(steps.length - 1, Math.max(0, Math.floor(e / 15)));
  }
  if (e >= total) return steps.length - 1;
  let cum = 0;
  for (let i = 0; i < steps.length; i++) {
    const m = Math.max(0, Number(steps[i].minutes) || 0);
    if (m === 0) {
      if (i === steps.length - 1) return i;
      if (e <= cum) return i;
      continue;
    }
    const next = cum + m;
    if (e < next) return i;
    cum = next;
  }
  return steps.length - 1;
}

/**
 * Active step + progress (0–1) within that step from elapsed minutes in the process window.
 */
export function getLiveStepperState(elapsedMinutes, steps) {
  if (!steps?.length) {
    return { activeIndex: -1, stepProgress: 0, elapsedInStep: 0, currentStepMinutes: 0 };
  }
  const e = Math.max(0, Number(elapsedMinutes) || 0);
  const total = steps.reduce((s, st) => s + Math.max(0, Number(st.minutes) || 0), 0);
  if (total <= 0) {
    const idx = Math.min(steps.length - 1, Math.max(0, Math.floor(e / Math.max(1, 60 / steps.length))));
    return { activeIndex: idx, stepProgress: 0.5, elapsedInStep: e, currentStepMinutes: 0 };
  }
  if (e >= total) {
    return {
      activeIndex: steps.length - 1,
      stepProgress: 1,
      elapsedInStep: Math.max(0, Number(steps[steps.length - 1].minutes) || 0),
      currentStepMinutes: Math.max(0, Number(steps[steps.length - 1].minutes) || 0),
    };
  }
  let cum = 0;
  for (let i = 0; i < steps.length; i++) {
    const m = Math.max(0, Number(steps[i].minutes) || 0);
    if (m === 0) {
      if (e <= cum || i === steps.length - 1) {
        return { activeIndex: i, stepProgress: 1, elapsedInStep: 0, currentStepMinutes: 0 };
      }
      continue;
    }
    if (e < cum + m) {
      const elapsedInStep = e - cum;
      return {
        activeIndex: i,
        stepProgress: elapsedInStep / m,
        elapsedInStep,
        currentStepMinutes: m,
      };
    }
    cum += m;
  }
  return {
    activeIndex: steps.length - 1,
    stepProgress: 1,
    elapsedInStep: 0,
    currentStepMinutes: Math.max(0, Number(steps[steps.length - 1].minutes) || 0),
  };
}

/** Human-readable remaining duration (ms → "2h 15m" / "45m" / "Less than a minute"). */
export function formatRemainingMs(ms) {
  if (ms == null || Number.isNaN(ms)) return '—';
  if (ms <= 0) return '0m';
  const totalMin = Math.ceil(ms / 60000);
  if (totalMin < 1) return 'Less than a minute';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
