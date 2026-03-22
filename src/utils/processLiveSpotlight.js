import { getProductionStatus } from './productionStatus';
import { compareRowsScheduleOrder } from './planDisplay';

/**
 * Single “spotlight” row for process live view: the batch currently running on the line,
 * or else the next Waiting batch by schedule order (earliest start sponge).
 */
export function pickSpotlightBatchRow(lineRows, nowMs = Date.now()) {
  if (!Array.isArray(lineRows) || lineRows.length === 0) return null;
  const ordered = [...lineRows].sort(compareRowsScheduleOrder);
  const inProg = ordered.find((r) => getProductionStatus(r, nowMs) === 'In Progress');
  if (inProg) return inProg;
  const waiting = ordered.find((r) => getProductionStatus(r, nowMs) === 'Waiting');
  return waiting ?? null;
}
