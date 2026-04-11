// quick node script: node src/test-pipeline.mjs
// copies the stagger + time math from productionLinesStore / stageDurations so we can break it in isolation
function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

// Replicate stagger-from-profiles logic (productionLinesStore)
function getStaggerMinutesFromMixingProfiles(profiles) {
  const first = profiles && profiles[0];
  if (!first) return 0;
  const equipment = Array.isArray(first.equipment) ? first.equipment : [];
  const processTimes = Array.isArray(first.processTimes) ? first.processTimes : [];

  const selectedKeys = [];
  for (const e of equipment) if (e && e.isPipelineStagger) selectedKeys.push({ kind: 'equipment', id: e.id });
  for (const pt of processTimes) if (pt && pt.isPipelineStagger) selectedKeys.push({ kind: 'processTime', id: pt.id });
  if (selectedKeys.length === 0) return 0;

  const steps = [];
  for (const e of equipment) {
    const mins = first.equipmentMinutes && e?.id != null ? first.equipmentMinutes[e.id] : null;
    steps.push({ kind: 'equipment', id: e.id, order: Number(e.order) || null, minutes: mins != null && !Number.isNaN(Number(mins)) ? Number(mins) : 0 });
  }
  for (const pt of processTimes) {
    steps.push({ kind: 'processTime', id: pt.id, order: Number(pt.order) || null, minutes: pt.minutes != null && !Number.isNaN(Number(pt.minutes)) ? Number(pt.minutes) : 0 });
  }
  steps.sort((a, b) => {
    const ao = a.order ?? Number.POSITIVE_INFINITY;
    const bo = b.order ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return String(a.id).localeCompare(String(b.id));
  });

  const selectedSet = new Set(selectedKeys.map((k) => `${k.kind}:${k.id}`));
  let best = null;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (!selectedSet.has(`${s.kind}:${s.id}`)) continue;
    const thisMins = Number(s.minutes) || 0;
    const candidate = Math.max(0, thisMins);
    best = best === null ? candidate : Math.min(best, candidate);
  }
  return Math.max(0, best ?? 0);
}

// Replicate time helpers (stageDurations)
const DAY_MINUTES = 24 * 60;
function parseTimeToMinutes(str) {
  if (!str || typeof str !== 'string') return 0;
  const [h, m] = str.split(':').map(Number);
  return (h % 24) * 60 + (m || 0);
}
function addMinutesToTime(timeStr, minutes) {
  const total = parseTimeToMinutes(timeStr) + Number(minutes);
  const normalized = ((total % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const h = Math.floor(normalized / 60) % 24;
  const m = Math.round(normalized % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// --- getStaggerMinutesFromMixingProfiles ---
assert(getStaggerMinutesFromMixingProfiles(undefined) === 0, 'no profiles => 0');
assert(getStaggerMinutesFromMixingProfiles([]) === 0, 'empty profiles => 0');
assert(getStaggerMinutesFromMixingProfiles([{}]) === 0, 'profile with no processTimes => 0');
assert(getStaggerMinutesFromMixingProfiles([{ processTimes: [] }]) === 0, 'profile with empty processTimes => 0');
assert(getStaggerMinutesFromMixingProfiles([{ processTimes: [{ id: 'pt1', name: 'Anything', minutes: 30, order: 2, isPipelineStagger: true }] }]) === 30, 'processTime selected => minutes');
assert(getStaggerMinutesFromMixingProfiles([{ processTimes: [{ name: 'Anything', minutes: 0, isPipelineStagger: true }] }]) === 0, 'explicit stagger 0 => 0');
assert(getStaggerMinutesFromMixingProfiles([{ processTimes: [{ name: 'A', minutes: 25, isPipelineStagger: true }] }]) === 25, 'explicit stagger 25 => 25');
assert(getStaggerMinutesFromMixingProfiles([{ processTimes: [{ id: 'a', name: 'Sponge', minutes: 10, order: 1 }, { id: 'b', name: 'Stagger', minutes: 30, order: 2, isPipelineStagger: true }] }]) === 30, 'flagged step uses own minutes only');
assert(getStaggerMinutesFromMixingProfiles([{ equipment: [{ id: 'm1', name: 'Mixer', order: 1, isPipelineStagger: true }], equipmentMinutes: { m1: 7 }, processTimes: [{ id: 'pt1', name: 'X', minutes: 30, order: 2 }] }]) === 7, 'equipment flagged => its 7 min');
assert(getStaggerMinutesFromMixingProfiles([{ equipment: [{ id: 'm1', name: 'Mixer', order: 1 }], equipmentMinutes: { m1: 7 }, processTimes: [{ id: 'pt1', name: 'Gap', minutes: 30, order: 2, isPipelineStagger: true }] }]) === 30, 'Gap pipeline => 30 only, sponge ignored for stagger');
assert(getStaggerMinutesFromMixingProfiles([{ equipment: [{ id: 'm1', name: 'Mixer', order: 1, isPipelineStagger: true }], equipmentMinutes: { m1: 7 }, processTimes: [{ id: 'pt1', name: 'Gap', minutes: 30, order: 2, isPipelineStagger: true }] }]) === 7, 'multiple checked => min(7,30) => 7');

// --- addMinutesToTime ---
assert(addMinutesToTime('08:00', 30) === '08:30', '08:00 + 30 => 08:30');
assert(addMinutesToTime('23:45', 30) === '00:15', '23:45 + 30 => 00:15 (cross midnight)');
assert(addMinutesToTime('00:00', 0) === '00:00', '00:00 + 0 => 00:00');

// --- date rollover condition (pipelined): next start < prev start => advance day
const prevStart = '23:45';
const nextStart = addMinutesToTime(prevStart, 30);
const shouldRoll = parseTimeToMinutes(nextStart) < parseTimeToMinutes(prevStart) && nextStart !== prevStart;
assert(shouldRoll === true, '23:45 + 30 => 00:15 should trigger date rollover');

const prevStart2 = '08:00';
const nextStart2 = addMinutesToTime(prevStart2, 30);
const shouldRoll2 = parseTimeToMinutes(nextStart2) < parseTimeToMinutes(prevStart2) && nextStart2 !== prevStart2;
assert(shouldRoll2 === false, '08:00 + 30 => 08:30 should NOT trigger date rollover');

console.log('All pipelined batching tests passed.');