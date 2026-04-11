import {
  getLineById,
  getMixingProfiles,
  getEquipmentForLine,
  getProcessTimesForProcess,
  getEquipmentMinutes,
} from '../store/productionLinesStore';

/**
 * Ordered steps for the live stepper: equipment + process-time entries from the
 * first mixing profile when present; otherwise line-level equipment + process times for the process.
 * Each step: { id, label, minutes, order }.
 *
 * Pipeline-checked rows (isPipelineStagger) are omitted — same as profile totals / proc time on the plan:
 * those minutes overlap the chain for staggering, they are not shown as a separate step here.
 */
export function buildProcessLiveStepperSteps(lineId, processId) {
  if (!lineId || !processId) return [];
  const profiles = getMixingProfiles(lineId, processId);
  if (profiles.length > 0) {
    const p = profiles[0];
    const items = [];
    (p.equipment || []).forEach((eq) => {
      if (eq?.isPipelineStagger) return;
      const id = eq.id ?? eq.name;
      const mins = Number(p.equipmentMinutes?.[eq.id] ?? p.equipmentMinutes?.[id]) || 0;
      items.push({
        id: `eq-${id}`,
        label: String(eq.name || 'Equipment').trim() || 'Equipment',
        minutes: mins,
        order: Number(eq.order) || 0,
      });
    });
    (p.processTimes || []).forEach((pt) => {
      if (pt?.isPipelineStagger) return;
      items.push({
        id: `pt-${pt.id}`,
        label: String(pt.name || 'Step').trim() || 'Step',
        minutes: Number(pt.minutes) || 0,
        order: Number(pt.order) || 0,
      });
    });
    items.sort((a, b) => a.order - b.order || String(a.id).localeCompare(String(b.id)));
    return items;
  }

  const eqList = getEquipmentForLine(lineId, processId);
  const ptList = getProcessTimesForProcess(lineId, processId);
  const items = [];
  eqList.forEach((eq) => {
    if (eq?.isPipelineStagger) return;
    const mins = getEquipmentMinutes(lineId, processId, eq.id) ?? 0;
    items.push({
      id: `eq-${eq.id}`,
      label: String(eq.name || 'Equipment').trim() || 'Equipment',
      minutes: Number(mins) || 0,
      order: Number(eq.order) || 0,
    });
  });
  (ptList || []).forEach((pt) => {
    if (pt?.isPipelineStagger) return;
    items.push({
      id: `pt-${pt.id}`,
      label: String(pt.name || 'Step').trim() || 'Step',
      minutes: Number(pt.minutes) || 0,
      order: Number(pt.order) != null && !Number.isNaN(Number(pt.order)) ? Number(pt.order) : 0,
    });
  });
  items.sort((a, b) => a.order - b.order || String(a.id).localeCompare(String(b.id)));
  return items;
}

export function totalMinutesForSteps(steps) {
  if (!steps?.length) return 0;
  return steps.reduce((s, x) => s + (Number(x.minutes) || 0), 0);
}
