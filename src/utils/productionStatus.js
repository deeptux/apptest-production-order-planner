// Waiting / In Progress / Finished — "now" is always interpreted in Asia/Singapore (+08)
// end batch after midnight on the row bumps end date +1 day same as scheduling math

function parseTimeToMinutes(str) {
  if (!str || typeof str !== 'string') return 0;
  const [h, m] = str.split(':').map(Number);
  return (h % 24) * 60 + (m || 0);
}

// force +08:00 so laptop timezone doesn't screw up status badges
function parseSingaporeMs(dateStr, timeStr) {
  if (!dateStr || !timeStr || typeof timeStr !== 'string') return NaN;
  const normalized = timeStr.includes(':') ? timeStr : `${timeStr.slice(0, 2)}:${timeStr.slice(2)}`;
  const iso = `${dateStr}T${normalized}:00+08:00`;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? NaN : ms;
}

// nowMs optional for tests / simulated clock
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
