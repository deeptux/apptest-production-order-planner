import { resolveSoCoExcessForDisplay } from '../store/planStore';
import { parseTimeToMinutes } from './stageDurations';
import { formatSkuIdFromMs, getRowCreatedAtMs } from './skuId';

// pretty print HH:MM -> 12h; if it doesn't look like HH:MM just echo it back
export function formatTime12h(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return '—';
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return hhmm;
  let h = Number(m[1]);
  const mm = m[2];
  if (Number.isNaN(h)) return hhmm;
  h = ((h % 24) + 24) % 24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm} ${ampm}`;
}

export function formatProcMinutesAsHours(mins) {
  const total = Number(mins);
  if (mins === '' || mins === null || mins === undefined || Number.isNaN(total)) return '—';
  const safe = Math.max(0, total);
  const h = Math.floor(safe / 60);
  const m = Math.round(safe % 60);
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Same idea as Scheduling: group by SKU id string, order by created-at, suffix ordinal.
export function buildSkuBatchOrderMap(rows) {
  const out = {};
  if (!Array.isArray(rows)) return out;
  const bySku = {};
  rows.forEach((r) => {
    const ms = getRowCreatedAtMs(r);
    const sku = formatSkuIdFromMs(ms);
    if (!sku || sku === '—') return;
    if (!bySku[sku]) bySku[sku] = [];
    bySku[sku].push(r);
  });
  Object.keys(bySku).forEach((sku) => {
    const list = [...bySku[sku]].sort((a, b) => {
      const aMs = getRowCreatedAtMs(a) ?? 0;
      const bMs = getRowCreatedAtMs(b) ?? 0;
      if (aMs !== bMs) return aMs - bMs;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
    const tail = sku.slice(-5);
    list.forEach((r, i) => {
      out[r.id] = `${tail}-${ordinal(i + 1)}`;
    });
  });
  return out;
}

export function compareRowsScheduleOrder(a, b) {
  const getCreatedMs = (r) => getRowCreatedAtMs(r) ?? 0;
  const getStartMs = (r) => {
    const d = (r.date || '').split('T')[0];
    if (!d || !r.startSponge) return 0;
    return new Date(`${d}T${r.startSponge}`).getTime();
  };
  const c = getStartMs(a) - getStartMs(b);
  if (c !== 0) return c;
  return getCreatedMs(b) - getCreatedMs(a);
}

function addDaysToYmd(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  const dt = new Date(y, m - 1, d + days);
  if (Number.isNaN(dt.getTime())) return ymd;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// batch date row.date is "day batch started"; end times after midnight need +1 day for labels
export function calendarDateForBatchTime(row, field) {
  const base = (row?.date || '').split('T')[0];
  if (!base || typeof base !== 'string') return '';
  if (field === 'startSponge') return base;
  const start = row.startSponge;
  const t = row[field];
  if (!start || !t) return base;
  if (parseTimeToMinutes(t) < parseTimeToMinutes(start)) return addDaysToYmd(base, 1);
  return base;
}

function formatMediumDate(yyyyMmDd) {
  const d = new Date(`${yyyyMmDd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return yyyyMmDd;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

function relativeDayWord(yyyyMmDd) {
  const d = new Date(`${yyyyMmDd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return '';
}

export function getEndDateYmdForWallTime(startYmd, startHm, endHm) {
  const base = (startYmd || '').split('T')[0];
  if (!base) return '';
  if (!endHm || !startHm) return base;
  const startMins = parseTimeToMinutes(startHm);
  const endMins = parseTimeToMinutes(endHm);
  if (endMins < startMins) return addDaysToYmd(base, 1);
  return base;
}

// Same wording as Scheduling schedule cells (Today / Tomorrow / Mar 24, 2026).
export function formatDateRelativeScheduling(yyyyMmDd) {
  const ymd = (yyyyMmDd || '').split('T')[0];
  if (!ymd) return '—';
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays === 1) return 'Tomorrow';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}

// dashboard two-line time cell: { time: '4:56 PM', sub: 'Tomorrow' } — same stack as scheduling grid
export function schedulingTimeStackFromMs(ms) {
  if (ms == null || Number.isNaN(Number(ms))) return null;
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return null;
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return {
    time: formatTime12h(`${hh}:${mm}`),
    sub: formatDateRelativeScheduling(ymd),
  };
}

export function schedulingTimeStackFromRowHm(row, field) {
  const raw = row?.[field];
  if (raw == null || raw === '') return null;
  const batchDate = (row.date || '').split('T')[0];
  const ymd =
    field === 'startSponge'
      ? batchDate
      : getEndDateYmdForWallTime(batchDate, row.startSponge, String(raw));
  return {
    time: formatTime12h(String(raw)),
    sub: formatDateRelativeScheduling(ymd),
  };
}

// older single-line string for tables that aren't scheduleAligned; new dashboard uses schedulingTimeStack* instead
export function formatTimeWithDayContext(row, field) {
  const raw = row[field];
  if (raw == null || raw === '') return '—';
  const ymd = calendarDateForBatchTime(row, field);
  if (!ymd) return formatTime12h(String(raw));
  const rel = relativeDayWord(ymd);
  const dateStr = formatMediumDate(ymd);
  const timeStr = formatTime12h(String(raw));
  const prefix = rel ? `${rel} · ${dateStr}` : dateStr;
  return `${prefix} · ${timeStr}`;
}

export function batchScheduleAnchorMs(row) {
  const d = (row?.date || '').split('T')[0];
  if (!d || !row?.startSponge) return null;
  const ms = new Date(`${d}T${row.startSponge}`).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function formatInstantMsWithDayContext(ms) {
  if (ms == null || Number.isNaN(Number(ms))) return '—';
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return '—';
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const hhmm = `${hh}:${mm}`;
  const rel = relativeDayWord(ymd);
  const dateStr = formatMediumDate(ymd);
  const timeStr = formatTime12h(hhmm);
  const prefix = rel ? `${rel} · ${dateStr}` : dateStr;
  return `${prefix} · ${timeStr}`;
}

// thin wrapper around resolveSoCoExcessForDisplay — keep one place so dashboard + scheduling tooltip don't drift
export function displaySoCoExcessForTable(row) {
  const v = resolveSoCoExcessForDisplay(row);
  if (v === null) return '—';
  return v;
}
