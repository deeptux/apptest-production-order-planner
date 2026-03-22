// SKU# column = timestamp derived from createdAt ISO, or first digits of row.id if legacy rows lack createdAt

export function getRowCreatedAtMs(row) {
  const iso = row?.createdAt;
  if (iso && typeof iso === 'string') {
    const t = new Date(iso).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const id = String(row?.id ?? '');
  const m = id.match(/^(\d{10,13})/);
  if (m) {
    const n = Number(m[1]);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

export function formatSkuIdFromMs(ms) {
  if (!ms || Number.isNaN(Number(ms))) return '—';
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return '—';
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const DD = String(d.getDate()).padStart(2, '0');
  const YYYY = String(d.getFullYear());
  const HH = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${MM}${DD}${YYYY}${HH}${mm}${ss}`;
}
