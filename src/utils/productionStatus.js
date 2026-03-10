/**
 * Production status (Waiting / In Progress / Finished) based on current time in Asia/Singapore.
 * Compares row's scheduled start (date + Start Sponge) and end (date + End Batch, next day if batch crosses midnight).
 */

function parseTimeToMinutes(str) {
  if (!str || typeof str !== 'string') return 0;
  const [h, m] = str.split(':').map(Number);
  return (h % 24) * 60 + (m || 0);
}

/**
 * Parse date (YYYY-MM-DD) and time (HH:MM) as a moment in Asia/Singapore, return epoch ms.
 */
function parseSingaporeMs(dateStr, timeStr) {
  if (!dateStr || !timeStr || typeof timeStr !== 'string') return NaN;
  const normalized = timeStr.includes(':') ? timeStr : `${timeStr.slice(0, 2)}:${timeStr.slice(2)}`;
  const iso = `${dateStr}T${normalized}:00+08:00`;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? NaN : ms;
}

/**
 * Get production status for a plan row based on "now" in Asia/Singapore.
 * @param {Object} row - Plan row with date, startSponge, endBatch
 * @param {number} [nowMs] - Epoch ms to compare (default: Date.now())
 * @returns {'Waiting'|'In Progress'|'Finished'}
 */
export function getProductionStatus(row, nowMs = Date.now()) {
  const date = row.date && typeof row.date === 'string' ? row.date.split('T')[0] : '';
  const startSponge = row.startSponge || '00:00';
  const endBatch = row.endBatch || '00:00';
  if (!date) return 'Waiting';

  const startMs = parseSingaporeMs(date, startSponge);
  if (Number.isNaN(startMs)) return 'Waiting';

  let endDate = date;
  const startMins = parseTimeToMinutes(startSponge);
  const endMins = parseTimeToMinutes(endBatch);
  if (endMins <= startMins && endBatch !== startSponge) {
    const [y, m, d] = date.split('-').map(Number);
    const next = new Date(y, m - 1, d + 1);
    endDate = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
  }
  const endMs = parseSingaporeMs(endDate, endBatch);
  if (Number.isNaN(endMs)) return nowMs >= startMs ? 'Finished' : 'Waiting';

  if (nowMs < startMs) return 'Waiting';
  if (nowMs < endMs) return 'In Progress';
  return 'Finished';
}
