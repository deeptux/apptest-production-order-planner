import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Plus, Trash2, Pencil } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tooltip from '@radix-ui/react-tooltip';
import { usePlan } from '../context/PlanContext';
import { useSnackbar } from '../context/SnackbarContext';
import { computeTheoreticalOutput, getLatestBatchEndForLine, getOrderBatchAndLineBatch } from '../store/planStore';
import { recomputeEndTimesForRow, parseTimeToMinutes } from '../utils/stageDurations';
import { getProductionStatus } from '../utils/productionStatus';
import { getRecipesForLine, getTotalProcessMinutes, getTotalProcessMinutesForLine } from '../store/recipeStore';
import { getCapacityForProduct, getDoughWeightKgForProduct, getGramsPerUnitForProduct, getTotalDoughWeightKgForProduct, getYieldForProduct } from '../store/capacityProfileStore';
import { getLines, getLineById } from '../store/productionLinesStore';

const FIELDS_THAT_TRIGGER_AUTO_ADJUST = ['startSponge', 'product'];

export default function SchedulingView() {
  const { planDate, setPlanDate, rows, setRows, reorderRows, previewSwapOrderBetweenRows, swapOrderBetweenRows, addBatch, addBatchesFromModal, previewInsertBatchesWithReflow, insertBatchesWithReflow, deleteBatch } = usePlan();
  const { show: showSnackbar } = useSnackbar() ?? {};
  const formatTime12h = useCallback((hhmm) => {
    if (!hhmm || typeof hhmm !== 'string') return '—';
    const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return hhmm;
    let h = Number(m[1]);
    const mm = m[2];
    if (Number.isNaN(h)) return hhmm;
    h = ((h % 24) + 24) % 24;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : (h % 12);
    return `${h12}:${mm} ${ampm}`;
  }, []);

  const formatDateShort = useCallback((yyyyMmDd) => {
    if (!yyyyMmDd || typeof yyyyMmDd !== 'string') return '—';
    const d = new Date(`${yyyyMmDd}T00:00:00`);
    if (Number.isNaN(d.getTime())) return yyyyMmDd;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
  }, []);

  const formatDateRelative = useCallback((yyyyMmDd) => {
    if (!yyyyMmDd || typeof yyyyMmDd !== 'string') return '—';
    const d = new Date(`${yyyyMmDd}T00:00:00`);
    if (Number.isNaN(d.getTime())) return yyyyMmDd;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays === 0) return 'Today';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays === 1) return 'Tomorrow';
    return formatDateShort(yyyyMmDd);
  }, [formatDateShort]);

  const formatDateCreated = useCallback((isoOrYmd) => {
    if (!isoOrYmd || typeof isoOrYmd !== 'string') return '—';
    // Accept ISO or YYYY-MM-DD
    const d = isoOrYmd.includes('T') ? new Date(isoOrYmd) : new Date(`${isoOrYmd}T00:00:00`);
    if (Number.isNaN(d.getTime())) return isoOrYmd;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
  }, []);

  const getCreatedAtMs = useCallback((row) => {
    const iso = row?.createdAt;
    if (iso && typeof iso === 'string') {
      const t = new Date(iso).getTime();
      if (!Number.isNaN(t)) return t;
    }
    // Fallback: row.id often starts with Date.now() ms
    const id = String(row?.id ?? '');
    const m = id.match(/^(\d{10,13})/);
    if (m) {
      const n = Number(m[1]);
      if (!Number.isNaN(n)) return n;
    }
    return null;
  }, []);

  const formatSkuIdFromMs = useCallback((ms) => {
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
  }, []);

  const formatMinutesAsHours = useCallback((mins) => {
    const total = Number(mins);
    if (mins === '' || mins === null || mins === undefined || Number.isNaN(total)) return '—';
    const safe = Math.max(0, total);
    const h = Math.floor(safe / 60);
    const m = Math.round(safe % 60);
    if (h <= 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }, []);

  const addDaysToDateStr = useCallback((yyyyMmDd, days) => {
    if (!yyyyMmDd || typeof yyyyMmDd !== 'string') return '';
    const d = new Date(`${yyyyMmDd}T00:00:00`);
    if (Number.isNaN(d.getTime())) return yyyyMmDd;
    d.setDate(d.getDate() + Number(days || 0));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const getEndDateStr = useCallback((startDateStr, startTimeStr, endTimeStr) => {
    if (!startDateStr) return '';
    const startMins = parseTimeToMinutes(startTimeStr);
    const endMins = parseTimeToMinutes(endTimeStr);
    // If end time is earlier than start time, it crossed midnight -> next day
    if (endTimeStr && startTimeStr && endMins < startMins) return addDaysToDateStr(startDateStr, 1);
    return startDateStr;
  }, [addDaysToDateStr]);
  const [editingRowId, setEditingRowId] = useState(null);
  const [draftRow, setDraftRow] = useState(null);
  const [addBatchModalOpen, setAddBatchModalOpen] = useState(false);
  const [addBatchForm, setAddBatchForm] = useState({
    date: '',
    startSponge: '00:00',
    productionLineId: '',
    product: '',
    salesOrder: '',
    soQty: 0,
    carryOverExcess: 0,
    exchangeForLoss: 0,
    excess: 0,
    samples: 2,
    theorOutputOverride: '',
  });
  const [addBatchValidationError, setAddBatchValidationError] = useState('');
  const [timeConflictOpen, setTimeConflictOpen] = useState(false);
  const [timeConflictInfo, setTimeConflictInfo] = useState({ affectedRowIds: [] });
  const [pendingAddBatchPayload, setPendingAddBatchPayload] = useState(null);
  const [addBatchSelectedBatchIndex, setAddBatchSelectedBatchIndex] = useState(0);
  const [selectedLineId, setSelectedLineId] = useState('all');
  const [showAllDates, setShowAllDates] = useState(true);
  const [dateTimeSort, setDateTimeSort] = useState({ key: null, dir: null }); // default uses DateTime Created desc
  const [hoveredRowId, setHoveredRowId] = useState(null);
  const [clickedRowId, setClickedRowId] = useState(null);
  const [statusTick, setStatusTick] = useState(() => Date.now());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetRow, setDeleteTargetRow] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const clickTimeoutRef = useRef(null);
  const hoverTimeoutRef = useRef(null);
  const swapHighlightTimeoutRef = useRef(null);
  const [swapHighlightRowIds, setSwapHighlightRowIds] = useState([]);
  const [swapConfirmOpen, setSwapConfirmOpen] = useState(false);
  const [swapConfirmInfo, setSwapConfirmInfo] = useState(null); // { rowIdA, rowIdB, crossDay, changedCount }
  const [swapConfirmCountdown, setSwapConfirmCountdown] = useState(0);
  const [timeConflictCountdown, setTimeConflictCountdown] = useState(0);
  const [deleteConfirmCountdown, setDeleteConfirmCountdown] = useState(0);
  const [orderHelpOpen, setOrderHelpOpen] = useState(false);
  const lines = getLines();

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (swapHighlightTimeoutRef.current) clearTimeout(swapHighlightTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!swapConfirmOpen) {
      setSwapConfirmCountdown(0);
      return undefined;
    }
    setSwapConfirmCountdown(4);
    const t = setInterval(() => {
      setSwapConfirmCountdown((v) => (v <= 1 ? 0 : v - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [swapConfirmOpen]);

  useEffect(() => {
    if (!timeConflictOpen) {
      setTimeConflictCountdown(0);
      return undefined;
    }
    setTimeConflictCountdown(4);
    const t = setInterval(() => {
      setTimeConflictCountdown((v) => (v <= 1 ? 0 : v - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [timeConflictOpen]);

  useEffect(() => {
    if (!deleteConfirmOpen) {
      setDeleteConfirmCountdown(0);
      return undefined;
    }
    setDeleteConfirmCountdown(4);
    const t = setInterval(() => {
      setDeleteConfirmCountdown((v) => (v <= 1 ? 0 : v - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [deleteConfirmOpen]);

  useEffect(() => {
    const interval = setInterval(() => setStatusTick(Date.now()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDateInput = (d) => {
    if (!d || !(d instanceof Date)) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const planDateStr = formatDateInput(planDate);
  const isFilterAll = !selectedLineId || selectedLineId === 'all';
  const rowsByLine = isFilterAll ? rows : rows.filter((r) => r.productionLineId === selectedLineId);
  // When showAllDates: no date filter (all scheduled batches by line). Otherwise filter by plan date.
  const displayedRows = showAllDates || !planDateStr
    ? rowsByLine
    : rowsByLine.filter((r) => r.date === planDateStr);
  const sortedDisplayedRows = useMemo(() => {
    const base = [...displayedRows];
    const getCreatedMs = (r) => getCreatedAtMs(r) ?? 0;
    const getStartMs = (r) => {
      const d = (r.date || '').split('T')[0];
      if (!d || !r.startSponge) return 0;
      return new Date(`${d}T${r.startSponge}`).getTime();
    };
    const getEndMs = (r, endField) => {
      const d = (r.date || '').split('T')[0];
      const start = r.startSponge;
      const end = r[endField];
      if (!d || !start || !end) return 0;
      const startM = parseTimeToMinutes(start);
      const endM = parseTimeToMinutes(end);
      let ms = new Date(`${d}T${end}`).getTime();
      if (endM < startM) ms += 24 * 60 * 60 * 1000;
      return ms;
    };

    // Default: DateTime Created desc (latest first)
    const defaultCmp = (a, b) => getCreatedMs(b) - getCreatedMs(a);

    const { key, dir } = dateTimeSort || {};
    if (!key || !dir) return base.sort(defaultCmp);

    const sign = dir === 'asc' ? 1 : -1;
    const cmpNum = (va, vb) => (va - vb) * sign;

    const keyCmp = (a, b) => {
      if (key === 'createdAt') return cmpNum(getCreatedMs(a), getCreatedMs(b));
      if (key === 'startSponge') return cmpNum(getStartMs(a), getStartMs(b));
      if (key === 'endDough') return cmpNum(getEndMs(a, 'endDough'), getEndMs(b, 'endDough'));
      if (key === 'endBatch') return cmpNum(getEndMs(a, 'endBatch'), getEndMs(b, 'endBatch'));
      return 0;
    };

    return base.sort((a, b) => {
      const c = keyCmp(a, b);
      if (c !== 0) return c;
      return defaultCmp(a, b);
    });
  }, [dateTimeSort, displayedRows, getCreatedAtMs]);

  const toggleTriSort = useCallback((key) => {
    setDateTimeSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'desc' };
      if (prev.dir === 'desc') return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key: null, dir: null };
      return { key, dir: 'desc' };
    });
  }, []);

  const sortIndicator = useCallback((key) => {
    if (dateTimeSort?.key !== key || !dateTimeSort?.dir) return '↕';
    return dateTimeSort.dir === 'desc' ? '↓' : '↑';
  }, [dateTimeSort]);
  const lineIdForNewBatch = selectedLineId && selectedLineId !== 'all' ? selectedLineId : getLines()[0]?.id;
  const recipeOptions = lineIdForNewBatch ? getRecipesForLine(lineIdForNewBatch) : [];
  const { orderBatch: orderBatchMap, lineBatch: lineBatchMap } = useMemo(
    () => getOrderBatchAndLineBatch(rows),
    [rows]
  );
  const skuBatchOrderMap = useMemo(() => {
    const ordinal = (n) => {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    const bySku = {};
    rows.forEach((r) => {
      const ms = getCreatedAtMs(r);
      const sku = formatSkuIdFromMs(ms);
      if (!sku || sku === '—') return;
      if (!bySku[sku]) bySku[sku] = [];
      bySku[sku].push(r);
    });
    const out = {};
    Object.keys(bySku).forEach((sku) => {
      const list = [...bySku[sku]].sort((a, b) => {
        const d = (a.date || '').localeCompare(b.date || '');
        if (d !== 0) return d;
        return parseTimeToMinutes(a.startSponge) - parseTimeToMinutes(b.startSponge);
      });
      const tail = sku.slice(-5);
      list.forEach((r, i) => {
        out[r.id] = `${tail}-${ordinal(i + 1)}`;
      });
    });
    return out;
  }, [formatSkuIdFromMs, getCreatedAtMs, rows]);

  const openAddBatchModal = useCallback(() => {
    const lineId = lineIdForNewBatch || getLines()[0]?.id || 'line-loaf';
    const latest = getLatestBatchEndForLine(lineId);
    const defaultDate = planDateStr || formatDateInput(new Date());
    const defaultTime = latest ? latest.endBatch : '00:00';
    setAddBatchForm({
      date: defaultDate,
      startSponge: defaultTime,
      productionLineId: lineId,
      product: '',
      salesOrder: '',
      soQty: 0,
      carryOverExcess: 0,
      exchangeForLoss: 0,
      excess: 0,
      samples: 2,
      theorOutputOverride: '',
    });
    setAddBatchValidationError('');
    setAddBatchSelectedBatchIndex(0);
    setAddBatchModalOpen(true);
  }, [lineIdForNewBatch, planDateStr]);

  const closeAddBatchModal = useCallback(() => {
    setAddBatchModalOpen(false);
    setAddBatchValidationError('');
  }, []);

  const handleAddBatchSubmit = useCallback(() => {
    setAddBatchValidationError('');
    const f = addBatchForm;
    const totalQty = Number(f.soQty) || 0;
    const yieldForProduct = f.product && f.productionLineId ? getYieldForProduct(f.product, f.productionLineId) : null;
    const canUseTotalQty = totalQty > 0 && yieldForProduct != null && yieldForProduct > 0;
    if (totalQty > 0 && !canUseTotalQty) {
      setAddBatchValidationError('Total Quantity splitting requires Theoretical Yield / Batch. Please set Yield in Capacity Profile (Production) for this product/line.');
      return;
    }
    const salesOrderNum = f.salesOrder !== '' && !Number.isNaN(Number(f.salesOrder)) ? Number(f.salesOrder) : 0;
    const carryOverNum = Number(f.carryOverExcess) || 0;
    const computedSoCoExcess = Math.max(0, salesOrderNum - carryOverNum);
    const theorOutput = f.theorOutputOverride !== undefined && f.theorOutputOverride !== '' && !Number.isNaN(Number(f.theorOutputOverride))
      ? Number(f.theorOutputOverride)
      : computedSoCoExcess + (Number(f.exchangeForLoss) || 0) + (Number(f.excess) || 0) + (Number(f.samples) || 2);
    if (!canUseTotalQty && theorOutput <= 0) {
      setAddBatchValidationError('Theoretical Output must be greater than 0 (set Sales Order, or use Exchange for LOSS, Excess, Samples, or override).');
      return;
    }
    const payload = {
      productionLineId: f.productionLineId,
      date: f.date,
      startSponge: f.startSponge,
      product: f.product,
      salesOrder: f.salesOrder !== '' && !Number.isNaN(Number(f.salesOrder)) ? Number(f.salesOrder) : undefined,
      soQty: f.soQty,
      soCoExcess: computedSoCoExcess,
      carryOverExcess: carryOverNum,
      exchangeForLoss: f.exchangeForLoss,
      excess: f.excess,
      samples: f.samples,
      theorOutputOverride: f.theorOutputOverride !== '' ? f.theorOutputOverride : undefined,
    };

    const preview = typeof previewInsertBatchesWithReflow === 'function'
      ? previewInsertBatchesWithReflow(payload)
      : { hasConflict: false, affectedRowIds: [], snappedTo: null };
    if (preview?.hasConflict) {
      setPendingAddBatchPayload(payload);
      setTimeConflictInfo({ affectedRowIds: preview.affectedRowIds || [], snappedTo: preview.snappedTo || null });
      setTimeConflictOpen(true);
      return;
    }

    const result = typeof insertBatchesWithReflow === 'function'
      ? insertBatchesWithReflow(payload)
      : addBatchesFromModal(payload);
    if (result.success) {
      closeAddBatchModal();
    } else {
      setAddBatchValidationError(result.error || 'Could not add batch.');
    }
  }, [addBatchForm, addBatchesFromModal, closeAddBatchModal, insertBatchesWithReflow, previewInsertBatchesWithReflow]);

  const handlePlanDateChange = (e) => {
    const v = e.target.value;
    if (!v) return;
    const d = new Date(v);
    if (!isNaN(d.getTime())) setPlanDate(d);
  };

  const startEditing = useCallback((row) => {
    setEditingRowId(row.id);
    const lineId = row.productionLineId || lineIdForNewBatch || getLines()[0]?.id;
    const draft = { ...row, productionLineId: lineId };
    draft.date = row.date ?? '';
    draft.salesOrder = row.salesOrder !== undefined && row.salesOrder !== '' ? row.salesOrder : '';
    draft.soCoExcess = row.soCoExcess !== undefined ? row.soCoExcess : (row.soQty ?? 0);
    draft.exchangeForLoss = row.exchangeForLoss !== undefined ? row.exchangeForLoss : 0;
    draft.excess = row.excess !== undefined ? row.excess : 0;
    draft.samples = row.samples !== undefined ? row.samples : 2;
    draft.carryOverExcess = row.carryOverExcess !== undefined ? row.carryOverExcess : 0;
    draft.theorExcess = row.theorExcess !== undefined ? row.theorExcess : 0;
    draft.theorOutputOverride = row.theorOutputOverride !== undefined ? row.theorOutputOverride : '';
    draft.capacity = getCapacityForProduct(row.product, lineId) ?? row.capacity;
    draft.procTime = getTotalProcessMinutesForLine(row.product, lineId) || getTotalProcessMinutes(row.product) || row.procTime;
    const { endDough, endBatch } = recomputeEndTimesForRow(draft);
    draft.endDough = endDough;
    draft.endBatch = endBatch;
    setDraftRow(draft);
  }, [lineIdForNewBatch]);

  const updateDraft = useCallback((field, value) => {
    setDraftRow((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [field]: value };
      if (field === 'productionLineId') {
        next.product = '';
        next.capacity = null;
        next.procTime = 0;
        next.endDough = '00:00';
        next.endBatch = '00:00';
      }
      if (field === 'product') {
        const lineId = next.productionLineId || lineIdForNewBatch;
        next.capacity = getCapacityForProduct(value, lineId) ?? prev.capacity;
        next.procTime = getTotalProcessMinutesForLine(value, lineId) || getTotalProcessMinutes(value) || prev.procTime;
        const { endDough, endBatch } = recomputeEndTimesForRow(next);
        next.endDough = endDough;
        next.endBatch = endBatch;
      }
      if (FIELDS_THAT_TRIGGER_AUTO_ADJUST.includes(field) && field !== 'product') {
        const { endDough, endBatch } = recomputeEndTimesForRow(next);
        return { ...next, endDough, endBatch };
      }
      return next;
    });
  }, [lineIdForNewBatch]);

  const openEditModal = useCallback((row) => {
    startEditing(row);
  }, [startEditing]);

  const cancelEdit = useCallback(() => {
    setEditingRowId(null);
    setDraftRow(null);
  }, []);

  const handleDeleteClick = useCallback((row) => {
    setDeleteTargetRow(row);
    setDeleteConfirmText('');
    setDeleteConfirmOpen(true);
    setSwapHighlightRowIds([]);
    setClickedRowId(null);
  }, [deleteBatch, showSnackbar, statusTick]);

  const confirmSave = useCallback(() => {
    if (!draftRow) return;
    const lineId = draftRow.productionLineId || lineIdForNewBatch;
    const soCoExcess = Math.max(0, (Number(draftRow.salesOrder) || 0) - (Number(draftRow.carryOverExcess) || 0));
    const toSave = { ...draftRow, productionLineId: lineId, soCoExcess };
    setRows((prev) =>
      prev.map((r) => (r.id === toSave.id ? { ...toSave } : r))
    );
    setEditingRowId(null);
    setDraftRow(null);
  }, [draftRow, lineIdForNewBatch, setRows]);

  const handleMoveUp = (index) => {
    if (index <= 0) return;
    const row = sortedDisplayedRows[index];
    const prevRow = sortedDisplayedRows[index - 1];
    if (row.productionLineId !== prevRow.productionLineId) return;
    const preview = typeof previewSwapOrderBetweenRows === 'function'
      ? previewSwapOrderBetweenRows(row.id, prevRow.id)
      : { canSwap: true, crossDay: false, changedCount: 2 };
    const requiresConfirm = !!preview?.canSwap && ((preview?.crossDay) || (Number(preview?.changedCount || 0) > 2));
    if (requiresConfirm) {
      setSwapConfirmInfo({ rowIdA: row.id, rowIdB: prevRow.id, crossDay: !!preview.crossDay, changedCount: Number(preview.changedCount || 0), affected: preview.affected || [] });
      setSwapConfirmOpen(true);
      return;
    }
    if (swapHighlightTimeoutRef.current) clearTimeout(swapHighlightTimeoutRef.current);
    setSwapHighlightRowIds([row.id, prevRow.id]);
    swapHighlightTimeoutRef.current = setTimeout(() => setSwapHighlightRowIds([]), 4000);
    setClickedRowId(null);
    swapOrderBetweenRows(row.id, prevRow.id);
    showSnackbar?.('Schedule updated');
  };

  const handleMoveDown = (index) => {
    if (index >= sortedDisplayedRows.length - 1) return;
    const row = sortedDisplayedRows[index];
    const nextRow = sortedDisplayedRows[index + 1];
    if (row.productionLineId !== nextRow.productionLineId) return;
    const preview = typeof previewSwapOrderBetweenRows === 'function'
      ? previewSwapOrderBetweenRows(row.id, nextRow.id)
      : { canSwap: true, crossDay: false, changedCount: 2 };
    const requiresConfirm = !!preview?.canSwap && ((preview?.crossDay) || (Number(preview?.changedCount || 0) > 2));
    if (requiresConfirm) {
      setSwapConfirmInfo({ rowIdA: row.id, rowIdB: nextRow.id, crossDay: !!preview.crossDay, changedCount: Number(preview.changedCount || 0), affected: preview.affected || [] });
      setSwapConfirmOpen(true);
      return;
    }
    if (swapHighlightTimeoutRef.current) clearTimeout(swapHighlightTimeoutRef.current);
    setSwapHighlightRowIds([row.id, nextRow.id]);
    swapHighlightTimeoutRef.current = setTimeout(() => setSwapHighlightRowIds([]), 4000);
    setClickedRowId(null);
    swapOrderBetweenRows(row.id, nextRow.id);
    showSnackbar?.('Schedule updated');
  };

  const isEditing = (rowId) => editingRowId === rowId;

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-6 max-w-[1600px] xl:max-w-[1920px] 2xl:max-w-[2200px] mx-auto w-full min-w-0">
      <h2 className="text-lg sm:text-xl md:text-2xl 2xl:text-3xl font-semibold text-gray-900 mb-0">
        Scheduling
      </h2>

      <div className="bg-surface-card rounded-card shadow-card p-4 border border-gray-100">
        <label className="block text-kpi-label sm:text-sm-kpi-label font-medium text-gray-700 mb-2 uppercase tracking-wide text-muted">
          Plan date
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={formatDateInput(planDate)}
            onChange={handlePlanDateChange}
            className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-xs sm:text-sm md:text-base w-full max-w-xs"
            aria-label="Show batches scheduled for this date"
          />
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showAllDates}
              onChange={(e) => setShowAllDates(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
              aria-label="Show all dates"
            />
            <span className="text-sm text-gray-700">Show all dates</span>
          </label>
        </div>
        <p className="text-xs text-muted mt-1">
          {showAllDates
            ? 'Table shows all scheduled batches (all dates). Production line filter still applies: All = all lines; selected line = that line only.'
            : 'Table shows only batches scheduled for the selected date. Check "Show all dates" to see batches across all dates.'}
        </p>
        <div className="mt-3">
          <label className="block text-kpi-label sm:text-sm-kpi-label font-medium text-gray-700 mb-2 uppercase tracking-wide text-muted">
            Production line
          </label>
          <select
            value={selectedLineId}
            onChange={(e) => setSelectedLineId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-xs sm:text-sm md:text-base max-w-xs w-full"
            aria-label="Filter by production line"
          >
            <option value="all">All</option>
            {lines.map((line) => (
              <option key={line.id} value={line.id}>{line.name}</option>
            ))}
          </select>
          <p className="text-xs text-muted mt-1">Filter by production line. New batches use the selected line (or first line when All) and get the plan date above as their scheduled date.</p>
        </div>
      </div>

      <div className="bg-surface-card rounded-card shadow-card overflow-hidden border border-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 p-2 sm:p-3 border-b border-gray-200 bg-surface-card-warm">
          <span className="text-xs sm:text-sm 2xl:text-base text-muted font-medium">Production orders</span>
          <button
            type="button"
            onClick={openAddBatchModal}
            disabled={!lineIdForNewBatch}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors text-xs sm:text-sm disabled:opacity-50"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            Add batch
          </button>
        </div>
        <div className="overflow-x-auto min-w-0">
          <Tooltip.Provider delayDuration={300}>
          <table className="w-full border-collapse text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl 2xl:text-2xl min-w-[800px]">
            <thead>
              <tr className="bg-surface-card-warm border-b border-gray-200">
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap">
                  <span className="inline-flex items-center gap-2">
                    Order
                    <button
                      type="button"
                      onClick={() => setOrderHelpOpen(true)}
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100"
                      aria-label="Learn about swap order"
                    >
                      ?
                    </button>
                  </span>
                </th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap w-10 sm:w-12">Actions</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap min-w-[4rem]">Line</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap min-w-[8rem]">
                  <button type="button" onClick={() => toggleTriSort('createdAt')} className="inline-flex items-center gap-1 hover:text-gray-900">
                    DateTime Created <span className="text-gray-500">{sortIndicator('createdAt')}</span>
                  </button>
                </th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap min-w-[7rem]">SKU ID#</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap min-w-[6rem]">Product</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap min-w-[4rem]">Sales Order</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap min-w-[5rem]">Total Qty</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap min-w-[4rem]">Batch Qty</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap min-w-[5rem]">
                  <button type="button" onClick={() => toggleTriSort('startSponge')} className="inline-flex items-center gap-1 hover:text-gray-900">
                    Start Sponge <span className="text-gray-500">{sortIndicator('startSponge')}</span>
                  </button>
                </th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap min-w-[5rem]">
                  <button type="button" onClick={() => toggleTriSort('endDough')} className="inline-flex items-center gap-1 hover:text-gray-900">
                    End Dough <span className="text-gray-500">{sortIndicator('endDough')}</span>
                  </button>
                </th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap min-w-[5rem]">
                  <button type="button" onClick={() => toggleTriSort('endBatch')} className="inline-flex items-center gap-1 hover:text-gray-900">
                    End Batch <span className="text-gray-500">{sortIndicator('endBatch')}</span>
                  </button>
                </th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap min-w-[5rem]">Process Time</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap min-w-[3rem]">Order Batch</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap min-w-[6rem]">SKU Batch Order</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-inherit whitespace-nowrap min-w-[4rem]">Production Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedDisplayedRows.map((row, index) => {
                const displayProcTime = getTotalProcessMinutesForLine(row.product, row.productionLineId) || getTotalProcessMinutes(row.product) || row.procTime || '';
                const capacityDisplay = getCapacityForProduct(row.product, row.productionLineId) ?? row.capacity ?? '—';
                const doughDisplay = getDoughWeightKgForProduct(row.product, row.productionLineId) != null ? `${getDoughWeightKgForProduct(row.product, row.productionLineId)} kg` : '—';
                const totalDoughKg = getTotalDoughWeightKgForProduct(row.product, row.productionLineId);
                const gramsPerUnit = getGramsPerUnitForProduct(row.product, row.productionLineId);
                const totalGramsDisplay = totalDoughKg != null && !Number.isNaN(totalDoughKg) ? (totalDoughKg * 1000).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—';
                const tooltipContent = (
                  <div className="text-left text-xs sm:text-sm space-y-1 p-1 max-w-[280px]">
                    <div><span className="font-medium text-gray-500">Total Quantity:</span> {row.soQty ?? '—'}</div>
                    <div><span className="font-medium text-gray-500">Batch Qty (Quantity of the Batch):</span> {row.theorOutput ?? '—'}</div>
                    <div><span className="font-medium text-gray-500">Sales Order:</span> {row.salesOrder ?? '—'}</div>
                    <div><span className="font-medium text-gray-500">SO-CO Excess:</span> {row.soCoExcess ?? '—'}</div>
                    <div><span className="font-medium text-gray-500">Exchange Loss:</span> {row.exchangeForLoss ?? '—'}</div>
                    <div><span className="font-medium text-gray-500">Excess:</span> {row.excess ?? '—'}</div>
                    <div><span className="font-medium text-gray-500">Samples:</span> {row.samples ?? '—'}</div>
                    <div><span className="font-medium text-gray-500">Carry Over:</span> {row.carryOverExcess ?? '—'}</div>
                    <div><span className="font-medium text-gray-500">Theoretical Excess:</span> {row.theorExcess ?? '—'}</div>
                    <div><span className="font-medium text-gray-500">Theoretical Output:</span> {row.theorOutput ?? '—'}</div>
                    <div><span className="font-medium text-gray-500">Capacity:</span> {capacityDisplay}</div>
                    <div><span className="font-medium text-gray-500">Dough (kg):</span> {doughDisplay}</div>
                    <div><span className="font-medium text-gray-500">Total dough (kg):</span> {totalDoughKg != null ? `${totalDoughKg} kg` : '—'}</div>
                    <div><span className="font-medium text-gray-500">Grams:</span> {gramsPerUnit != null ? gramsPerUnit : '—'}</div>
                    <div><span className="font-medium text-gray-500">Total grams:</span> {totalGramsDisplay}</div>
                  </div>
                );
                return (
                  <Tooltip.Root
                    key={row.id}
                    delayDuration={300}
                    open={hoveredRowId === row.id || clickedRowId === row.id}
                  >
                    <Tooltip.Trigger asChild>
                  <tr
                    className={`border-b border-gray-100 bg-surface-card hover:bg-gray-50/50 whitespace-nowrap ${
                      clickedRowId === row.id ? 'bg-primary/20 ring-2 ring-primary/40 ring-inset' : ''
                    } ${
                      swapHighlightRowIds.includes(row.id) ? 'bg-primary/10 ring-2 ring-primary/30 ring-inset' : ''
                    }`}
                    onPointerEnter={(e) => {
                      if (e?.target?.closest?.('[data-no-row-tooltip="true"]')) return;
                      // Hovering another row should close any "clicked" pinned details + highlight
                      if (clickedRowId && clickedRowId !== row.id) {
                        if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
                        setClickedRowId(null);
                      }
                      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                      hoverTimeoutRef.current = setTimeout(() => setHoveredRowId(row.id), 300);
                    }}
                    onPointerLeave={() => {
                      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                      hoverTimeoutRef.current = null;
                      setHoveredRowId(null);
                    }}
                    onClick={(e) => {
                      if (e?.target?.closest?.('[data-exclude-row-click="true"]')) return;
                      if (e.target.closest('button')) return;
                      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
                      setSwapHighlightRowIds([]);
                      setClickedRowId(row.id);
                      clickTimeoutRef.current = setTimeout(() => {
                        setClickedRowId(null);
                        if (document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur();
                      }, 4000);
                    }}
                  >
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4" data-no-row-tooltip="true" data-exclude-row-click="true">
                      <div className="flex gap-1">
                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <button
                              type="button"
                              onClick={() => handleMoveUp(index)}
                              disabled={index === 0 || (sortedDisplayedRows[index - 1] && (sortedDisplayedRows[index].productionLineId !== sortedDisplayedRows[index - 1].productionLineId))}
                              className="p-1 rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-100 text-inherit"
                              aria-label="Move to previous schedule slot"
                            >
                              ↑
                            </button>
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content side="right" className="z-[80] rounded-md bg-gray-900 text-white px-2 py-1 text-xs shadow-lg max-w-[220px]">
                              Move to the previous schedule slot. Times may reflow.
                              <Tooltip.Arrow className="fill-gray-900" />
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>
                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <button
                              type="button"
                              onClick={() => handleMoveDown(index)}
                              disabled={index === sortedDisplayedRows.length - 1 || (sortedDisplayedRows[index + 1] && (sortedDisplayedRows[index].productionLineId !== sortedDisplayedRows[index + 1].productionLineId))}
                              className="p-1 rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-100 text-inherit"
                              aria-label="Move to next schedule slot"
                            >
                              ↓
                            </button>
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content side="right" className="z-[80] rounded-md bg-gray-900 text-white px-2 py-1 text-xs shadow-lg max-w-[220px]">
                              Move to the next schedule slot. Times may reflow.
                              <Tooltip.Arrow className="fill-gray-900" />
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>
                      </div>
                    </td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4" data-exclude-row-click="true">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(row)}
                          className="p-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 inline-flex items-center justify-center"
                          aria-label="Edit row"
                        >
                          <Pencil className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(row)}
                          className="p-1.5 rounded border border-gray-300 hover:bg-red-50 hover:border-red-300 text-gray-600 hover:text-red-700 transition-colors inline-flex items-center justify-center"
                          aria-label="Delete row"
                        >
                          <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                    </td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-700 text-inherit">{getLineById(row.productionLineId)?.name ?? '—'}</td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-700 text-inherit whitespace-nowrap">
                      <div className="leading-tight">
                        <div>{(() => {
                          const ms = getCreatedAtMs(row);
                          if (!ms) return formatDateCreated(row.createdAt ?? '');
                          const d = new Date(ms);
                          if (Number.isNaN(d.getTime())) return formatDateCreated(row.createdAt ?? '');
                          const y = d.getFullYear();
                          const m = String(d.getMonth() + 1).padStart(2, '0');
                          const day = String(d.getDate()).padStart(2, '0');
                          return formatDateRelative(`${y}-${m}-${day}`);
                        })()}</div>
                        <div className="text-[0.65rem] sm:text-xs text-gray-500">
                          {(() => {
                            const ms = getCreatedAtMs(row);
                            if (!ms) return '—';
                            const d = new Date(ms);
                            if (Number.isNaN(d.getTime())) return '—';
                            const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                            return formatTime12h(hhmm);
                          })()}
                        </div>
                      </div>
                    </td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-700 text-inherit tabular-nums whitespace-nowrap">{formatSkuIdFromMs(getCreatedAtMs(row))}</td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-800 text-inherit">{row.product ?? '—'}</td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-800 text-inherit">{row.salesOrder ?? '—'}</td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-800 text-inherit">{row.soQty ?? '—'}</td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-800 text-inherit">{row.theorOutput ?? '—'}</td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-700 text-inherit">
                      <div className="leading-tight">
                        <div>{formatTime12h(row.startSponge)}</div>
                        <div className="text-[0.65rem] sm:text-xs text-gray-500">{formatDateRelative(row.date)}</div>
                      </div>
                    </td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-700 text-inherit">
                      <div className="leading-tight">
                        <div>{formatTime12h(row.endDough)}</div>
                        <div className="text-[0.65rem] sm:text-xs text-gray-500">
                          {formatDateRelative(getEndDateStr(row.date, row.startSponge, row.endDough))}
                        </div>
                      </div>
                    </td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-700 text-inherit">
                      <div className="leading-tight">
                        <div>{formatTime12h(row.endBatch)}</div>
                        <div className="text-[0.65rem] sm:text-xs text-gray-500">
                          {formatDateRelative(getEndDateStr(row.date, row.startSponge, row.endBatch))}
                        </div>
                      </div>
                    </td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-700 text-inherit whitespace-nowrap tabular-nums">{formatMinutesAsHours(displayProcTime)}</td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-700 text-inherit whitespace-nowrap">
                      <div className="leading-tight">
                        <div>{orderBatchMap[row.id] ?? '—'}</div>
                        <div className="text-[0.65rem] sm:text-xs text-gray-500">{formatDateRelative(row.date)}</div>
                      </div>
                    </td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-700 text-inherit whitespace-nowrap tabular-nums">{skuBatchOrderMap[row.id] ?? '—'}</td>
                    <td className="py-2 sm:py-2.5 px-2 sm:px-4">
                      {(() => {
                        const status = getProductionStatus(row, statusTick);
                        const statusClass =
                          status === 'In Progress'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : status === 'Finished'
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : 'bg-gray-100 text-gray-700 border-gray-200';
                        return (
                          <span className={`inline-block px-2 py-0.5 rounded border text-xs font-medium ${statusClass}`}>
                            {status}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content side="top" sideOffset={6} className="z-50 max-w-[90vw] rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg text-gray-900">
                        {tooltipContent}
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                );
              })}
            </tbody>
          </table>
          </Tooltip.Provider>
        </div>
        <p className="p-2 sm:p-3 text-xs sm:text-sm 2xl:text-base text-muted bg-surface-card-warm border-t border-gray-200">
          Click Edit on a row to open the edit modal and change all fields. Move rows with Order arrows.
        </p>
      </div>

      <Dialog.Root open={!!editingRowId && !!draftRow} onOpenChange={(open) => !open && cancelEdit()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg max-h-[90vh] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white shadow-lg flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <Dialog.Title className="text-lg font-semibold text-gray-900">Edit batch</Dialog.Title>
              <Dialog.Description className="text-sm text-gray-600 mt-0.5">Change any field below. Theoretical Output is computed from formula or override.</Dialog.Description>
            </div>
            <div className="p-4 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {draftRow && (() => {
                const r = draftRow;
                const lineId = r.productionLineId || lineIdForNewBatch;
                const editRecipeOptions = lineId ? getRecipesForLine(lineId) : [];
                const capacityVal = getCapacityForProduct(r.product, lineId) ?? r.capacity ?? '—';
                const doughVal = getDoughWeightKgForProduct(r.product, lineId) != null ? `${getDoughWeightKgForProduct(r.product, lineId)} kg` : '—';
                const procTimeVal = getTotalProcessMinutesForLine(r.product, lineId) || getTotalProcessMinutes(r.product) || r.procTime || '—';
                return (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Line</label>
                      <select value={r.productionLineId ?? ''} onChange={(e) => updateDraft('productionLineId', e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900">
                        {lines.map((line) => <option key={line.id} value={line.id}>{line.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Date</label>
                      <input type="date" value={r.date ?? ''} onChange={(e) => updateDraft('date', e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Product</label>
                      <select value={r.product ?? ''} onChange={(e) => updateDraft('product', e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900">
                        <option value="">— Select product —</option>
                        {editRecipeOptions.map((rec) => <option key={rec.id} value={rec.name}>{rec.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Total Quantity</label>
                      <input type="number" value={r.soQty ?? ''} onChange={(e) => updateDraft('soQty', Number(e.target.value) || 0)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Sales Order (base qty)</label>
                      <input type="number" value={r.salesOrder ?? ''} onChange={(e) => updateDraft('salesOrder', e.target.value === '' ? '' : Number(e.target.value))} className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900" placeholder="e.g. 1090" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">SO-CO Excess</label>
                      <div className="w-full border border-gray-200 rounded px-2 py-1.5 bg-gray-50 text-gray-700">
                        {Math.max(0, (Number(r.salesOrder) || 0) - (Number(r.carryOverExcess) || 0))}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">Computed: Sales Order − Carry Over (read-only).</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Exchange Loss</label>
                      <input type="number" value={r.exchangeForLoss ?? ''} onChange={(e) => updateDraft('exchangeForLoss', Number(e.target.value) || 0)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Excess</label>
                      <input type="number" value={r.excess ?? ''} onChange={(e) => updateDraft('excess', Number(e.target.value) || 0)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Samples</label>
                      <input type="number" value={r.samples ?? ''} onChange={(e) => updateDraft('samples', Number(e.target.value) || 0)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Carry Over</label>
                      <input type="number" value={r.carryOverExcess ?? ''} onChange={(e) => updateDraft('carryOverExcess', Number(e.target.value) || 0)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Theoretical Excess</label>
                      <input type="number" value={r.theorExcess ?? ''} onChange={(e) => updateDraft('theorExcess', Number(e.target.value) || 0)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Theoretical Output (override)</label>
                      <input type="number" value={r.theorOutputOverride !== undefined && r.theorOutputOverride !== '' ? r.theorOutputOverride : computeTheoreticalOutput(r)} onChange={(e) => updateDraft('theorOutputOverride', e.target.value === '' ? '' : e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900" placeholder="Computed" />
                      <span className="text-xs text-gray-500">Computed: {computeTheoreticalOutput(r)}</span>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Capacity</label>
                      <div className="w-full border border-gray-200 rounded px-2 py-1.5 bg-gray-50 text-gray-700">{capacityVal}</div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Dough (kg)</label>
                      <div className="w-full border border-gray-200 rounded px-2 py-1.5 bg-gray-50 text-gray-700">{doughVal}</div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Process Time</label>
                      <div className="w-full border border-gray-200 rounded px-2 py-1.5 bg-gray-50 text-gray-700">{procTimeVal}</div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Start Sponge</label>
                      <input type="text" value={r.startSponge ?? ''} onChange={(e) => updateDraft('startSponge', e.target.value)} placeholder="HH:MM" className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">End Dough</label>
                      <div className="w-full border border-gray-200 rounded px-2 py-1.5 bg-gray-50 text-gray-700">{r.endDough ?? '—'}</div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">End Batch</label>
                      <div className="w-full border border-gray-200 rounded px-2 py-1.5 bg-gray-50 text-gray-700">{r.endBatch ?? '—'}</div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Order Batch</label>
                      <div className="w-full border border-gray-200 rounded px-2 py-1.5 bg-gray-50 text-gray-700">{orderBatchMap[r.id] ?? '—'}</div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Line Batch</label>
                      <div className="w-full border border-gray-200 rounded px-2 py-1.5 bg-gray-50 text-gray-700">{lineBatchMap[r.id] ?? '—'}</div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Production Status</label>
                      <div className="w-full border border-gray-200 rounded px-2 py-1.5 bg-gray-50 text-gray-700">
                        {getProductionStatus(r, statusTick)}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button type="button" onClick={cancelEdit} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
              </Dialog.Close>
              <button type="button" onClick={confirmSave} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark">
                Save
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={addBatchModalOpen} onOpenChange={(open) => !open && closeAddBatchModal()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg max-h-[90vh] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white shadow-lg flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <Dialog.Title className="text-lg font-semibold text-gray-900">Add batch</Dialog.Title>
              {/* <Dialog.Description className="text-sm text-gray-600 mt-0.5">
                Set batch start date and time, product, and demand. <strong>Total Quantity</strong> (e.g. 2000) is the total pieces to produce. Theoretical Output = SO-CO Excess + Exchange for LOSS + Excess + Samples (or override). Batches are created automatically based on capacity.
              </Dialog.Description> */}
            </div>
            <div className="p-4 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {addBatchValidationError && (
                <div className="sm:col-span-2 p-2 rounded bg-red-50 border border-red-200 text-red-800 text-xs">
                  {addBatchValidationError}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">Batch start date</label>
                <input
                  type="date"
                  value={addBatchForm.date}
                  onChange={(e) => setAddBatchForm((p) => ({ ...p, date: e.target.value }))}
                  onFocus={() => setAddBatchValidationError('')}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">Start Sponge (time)</label>
                <input
                  type="time"
                  value={addBatchForm.startSponge}
                  onChange={(e) => setAddBatchForm((p) => ({ ...p, startSponge: e.target.value || '00:00' }))}
                  onFocus={() => setAddBatchValidationError('')}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900"
                />
                {/* <p className="text-xs text-gray-500 mt-0.5">When plan date is today, start cannot be in the past. Start must be after existing batch end on this line.</p> */}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">Production line</label>
                <select
                  value={addBatchForm.productionLineId}
                  onChange={(e) => setAddBatchForm((p) => ({ ...p, productionLineId: e.target.value, product: '' }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900"
                >
                  {lines.map((line) => (
                    <option key={line.id} value={line.id}>{line.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">Product</label>
                <select
                  value={addBatchForm.product}
                  onChange={(e) => setAddBatchForm((p) => ({ ...p, product: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900"
                >
                  <option value="">— Select product —</option>
                  {(addBatchForm.productionLineId ? getRecipesForLine(addBatchForm.productionLineId) : recipeOptions).map((r) => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">Sales Order (base qty)</label>
                <input
                  type="number"
                  min={0}
                  value={addBatchForm.salesOrder}
                  onChange={(e) => setAddBatchForm((p) => ({ ...p, salesOrder: e.target.value === '' ? '' : e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900"
                  placeholder="e.g. 1090"
                />
                {/* <p className="text-xs text-gray-500 mt-0.5">Base order quantity. SO-CO Excess is computed as Sales Order − Carry Over Excess.</p> */}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">Total Quantity</label>
                <input
                  type="number"
                  min={0}
                  value={addBatchForm.soQty}
                  onChange={(e) => setAddBatchForm((p) => ({ ...p, soQty: e.target.value === '' ? '' : Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">Carry Over Excess</label>
                <input
                  type="number"
                  min={0}
                  value={addBatchForm.carryOverExcess}
                  onChange={(e) => setAddBatchForm((p) => ({ ...p, carryOverExcess: e.target.value === '' ? '' : Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">SO-CO Excess</label>
                <div className="w-full border border-gray-200 rounded px-2 py-1.5 bg-gray-100 text-gray-800">
                  {Math.max(0, (Number(addBatchForm.salesOrder) || 0) - (Number(addBatchForm.carryOverExcess) || 0))}
                </div>
                {/* <p className="text-xs text-gray-500 mt-0.5">Computed: Sales Order − Carry Over Excess (read-only).</p> */}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">Exchange for LOSS</label>
                <input
                  type="number"
                  value={addBatchForm.exchangeForLoss}
                  onChange={(e) => setAddBatchForm((p) => ({ ...p, exchangeForLoss: e.target.value === '' ? '' : Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">Excess</label>
                <input
                  type="number"
                  min={0}
                  value={addBatchForm.excess}
                  onChange={(e) => setAddBatchForm((p) => ({ ...p, excess: e.target.value === '' ? '' : Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">Samples</label>
                <input
                  type="number"
                  min={0}
                  value={addBatchForm.samples}
                  onChange={(e) => setAddBatchForm((p) => ({ ...p, samples: e.target.value === '' ? '' : Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900"
                />
              </div>
              {(() => {
                const computedSoCo = Math.max(0, (Number(addBatchForm.salesOrder) || 0) - (Number(addBatchForm.carryOverExcess) || 0));
                const computedTheorOutput = addBatchForm.theorOutputOverride !== undefined && addBatchForm.theorOutputOverride !== '' && !Number.isNaN(Number(addBatchForm.theorOutputOverride))
                  ? Number(addBatchForm.theorOutputOverride)
                  : computedSoCo + (Number(addBatchForm.exchangeForLoss) || 0) + (Number(addBatchForm.excess) || 0) + (Number(addBatchForm.samples) || 2);
                const yieldForProduct = addBatchForm.product && addBatchForm.productionLineId
                  ? getYieldForProduct(addBatchForm.product, addBatchForm.productionLineId)
                  : null;
                const capacityForProduct = addBatchForm.product && addBatchForm.productionLineId
                  ? getCapacityForProduct(addBatchForm.product, addBatchForm.productionLineId)
                  : null;
                const totalQty = Number(addBatchForm.soQty) || 0;
                const numBatches = yieldForProduct != null && yieldForProduct > 0 && totalQty > 0
                  ? Math.ceil(totalQty / yieldForProduct)
                  : null;
                const batchQuantities = numBatches != null && numBatches > 0 && yieldForProduct != null
                  ? (() => {
                      const arr = [];
                      let rem = totalQty;
                      for (let i = 0; i < numBatches; i++) {
                        const pc = i < numBatches - 1 ? yieldForProduct : Math.min(yieldForProduct, rem);
                        arr.push(pc);
                        rem -= pc;
                      }
                      return arr;
                    })()
                  : [];
                const selectedBatchIndex = numBatches != null && numBatches > 0
                  ? Math.min(addBatchSelectedBatchIndex, numBatches - 1)
                  : 0;
                const quantityOfBatch = batchQuantities[selectedBatchIndex] ?? '—';
                const canUseTotalQty = totalQty > 0 && yieldForProduct != null && yieldForProduct > 0;
                const batchOrdinal = (n) => {
                  const s = ['th', 'st', 'nd', 'rd'];
                  const v = n % 100;
                  return n + (s[(v - 20) % 10] || s[v] || s[0]);
                };
                return (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Theoretical Yield / Batch</label>
                      <div className="w-full border border-gray-200 rounded px-2 py-1.5 bg-gray-100 text-gray-800">
                        {yieldForProduct != null ? yieldForProduct : '—'}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">From Capacity Profile (Production) for selected product (read-only).</p>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Theoretical Output</label>
                      <input
                        type="number"
                        min={0}
                        value={addBatchForm.theorOutputOverride}
                        onChange={(e) => setAddBatchForm((p) => ({ ...p, theorOutputOverride: e.target.value }))}
                        placeholder={String(Math.max(0, (Number(addBatchForm.salesOrder) || 0) - (Number(addBatchForm.carryOverExcess) || 0)) + (Number(addBatchForm.exchangeForLoss) || 0) + (Number(addBatchForm.excess) || 0) + (Number(addBatchForm.samples) || 2))}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900"
                      />
                      <p className="text-xs text-gray-500 mt-0.5">
                        {canUseTotalQty
                          ? 'Not required when Total Quantity + Yield/Batch are provided (batch splitting uses Total Quantity).'
                          : 'SO-CO Excess + Exchange for LOSS + Excess + Samples. Leave empty to use computed, or type to override.'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Number of batches</label>
                      <select
                        value={selectedBatchIndex}
                        onChange={(e) => setAddBatchSelectedBatchIndex(Number(e.target.value))}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900 bg-white"
                      >
                        {numBatches != null && numBatches > 0
                          ? Array.from({ length: numBatches }, (_, i) => (
                              <option key={i} value={i}>{batchOrdinal(i + 1)} batch</option>
                            ))
                          : <option value={0}>—</option>}
                      </select>
                      {/* <p className="text-xs text-gray-500 mt-0.5">
                        Select which batch to view. Total batches: ceil(Total Quantity ÷ Theoretical Yield / Batch).
                      </p> */}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Quantity of the Batch</label>
                      <div className="w-full border border-gray-200 rounded px-2 py-1.5 bg-gray-100 text-gray-800">
                        {quantityOfBatch}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">Pieces for the selected batch (read-only). This becomes Batch Qty on the saved row.</p>
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button type="button" onClick={closeAddBatchModal} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={handleAddBatchSubmit}
                disabled={(() => {
                  const totalQty = Number(addBatchForm.soQty) || 0;
                  const yieldForProduct = addBatchForm.product && addBatchForm.productionLineId
                    ? getYieldForProduct(addBatchForm.product, addBatchForm.productionLineId)
                    : null;
                  const capacityForProduct = addBatchForm.product && addBatchForm.productionLineId
                    ? getCapacityForProduct(addBatchForm.product, addBatchForm.productionLineId)
                    : null;
                  const computedSoCo = Math.max(0, (Number(addBatchForm.salesOrder) || 0) - (Number(addBatchForm.carryOverExcess) || 0));
                  const computedTheorOutput = addBatchForm.theorOutputOverride !== undefined && addBatchForm.theorOutputOverride !== '' && !Number.isNaN(Number(addBatchForm.theorOutputOverride))
                    ? Number(addBatchForm.theorOutputOverride)
                    : computedSoCo + (Number(addBatchForm.exchangeForLoss) || 0) + (Number(addBatchForm.excess) || 0) + (Number(addBatchForm.samples) || 2);
                  const canUseTotalQty = totalQty > 0 && yieldForProduct != null && yieldForProduct > 0;
                  const canUseTheorOutput = computedTheorOutput > 0 && capacityForProduct != null && capacityForProduct > 0;
                  return !addBatchForm.product || (!canUseTotalQty && !canUseTheorOutput);
                })()}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add batch
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={timeConflictOpen} onOpenChange={setTimeConflictOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[60] w-full max-w-lg max-h-[90vh] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white shadow-lg p-4 flex flex-col">
            <Dialog.Title className="text-lg font-semibold text-gray-900">Time Conflict Affecting Other Batches</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-gray-700">
              The time you entered conflicts with the current schedule. If you proceed, this batch will be snapped to the nearest upcoming slot on this line, and the affected batches from that slot onward will be pushed forward and recalculated.
            </Dialog.Description>
            <div className="mt-3 text-sm text-gray-800">
              {timeConflictInfo?.snappedTo ? (
                <div className="text-xs text-gray-600">
                  Snapped to: <span className="font-medium text-gray-800">{formatTime12h(timeConflictInfo.snappedTo.startSponge)}</span>{' '}
                  <span className="text-gray-500">({formatDateRelative(timeConflictInfo.snappedTo.date)})</span>
                </div>
              ) : null}
              <div className="font-medium">Affected batches: {timeConflictInfo?.affectedRowIds?.length || 0}</div>
              {(() => {
                const ids = timeConflictInfo?.affectedRowIds || [];
                const affected = rows.filter((r) => ids.includes(r.id));
                const preview = affected
                  .slice(0, 5)
                  .map((r) => `${r.product || '—'} • ${formatTime12h(r.startSponge)}–${formatTime12h(r.endBatch)} (${formatDateRelative(r.date)})`);
                return preview.length > 0 ? (
                  <ul className="mt-2 list-disc pl-5 text-xs text-gray-600 space-y-1">
                    {preview.map((t, i) => <li key={i}>{t}</li>)}
                    {affected.length > preview.length ? <li>…and {affected.length - preview.length} more</li> : null}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-gray-600">The schedule will be re-timed from this insertion point onward.</p>
                );
              })()}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                  onClick={() => {
                    setPendingAddBatchPayload(null);
                    setTimeConflictInfo({ affectedRowIds: [], snappedTo: null });
                  }}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={() => {
                  if (!pendingAddBatchPayload) return;
                  const result = typeof insertBatchesWithReflow === 'function'
                    ? insertBatchesWithReflow(pendingAddBatchPayload)
                    : { success: false, error: 'Insert-with-reflow is not available.' };
                  if (result?.success) {
                    setTimeConflictOpen(false);
                    setPendingAddBatchPayload(null);
                    setTimeConflictInfo({ affectedRowIds: [], snappedTo: null });
                    closeAddBatchModal();
                  } else {
                    setAddBatchValidationError(result?.error || 'Could not add batch.');
                    setTimeConflictOpen(false);
                  }
                }}
                disabled={timeConflictCountdown > 0}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {timeConflictCountdown > 0 ? `Proceed & adjust schedule (${timeConflictCountdown})` : 'Proceed & adjust schedule'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={swapConfirmOpen} onOpenChange={setSwapConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[60] w-full max-w-md max-h-[90vh] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white shadow-lg p-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900">This move will shift the schedule</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-gray-700 space-y-2">
              <div>Moving a batch into a different schedule slot can re-time other batches.</div>
              {swapConfirmInfo?.crossDay ? (
                <div><span className="font-medium">Cross-day move:</span> this will move a batch between dates (Today ↔ Tomorrow).</div>
              ) : null}
              <div><span className="font-medium">Batches affected:</span> {swapConfirmInfo?.changedCount ?? '—'}</div>
              {swapConfirmInfo?.affected?.length ? (
                <ul className="mt-2 list-disc pl-5 text-xs text-gray-600 space-y-1">
                  {swapConfirmInfo.affected.slice(0, 5).map((a) => (
                    <li key={a.id}>
                      {a.product || '—'} • {formatTime12h(a.from.startSponge)}–{formatTime12h(a.from.endBatch)} ({formatDateRelative(a.from.date)}) → {formatTime12h(a.to.startSponge)}–{formatTime12h(a.to.endBatch)} ({formatDateRelative(a.to.date)})
                    </li>
                  ))}
                  {swapConfirmInfo.affected.length > 5 ? <li>…and {swapConfirmInfo.affected.length - 5} more</li> : null}
                </ul>
              ) : null}
            </Dialog.Description>
            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                  onClick={() => setSwapConfirmInfo(null)}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={() => {
                  if (!swapConfirmInfo?.rowIdA || !swapConfirmInfo?.rowIdB) return;
                  if (swapHighlightTimeoutRef.current) clearTimeout(swapHighlightTimeoutRef.current);
                  setSwapHighlightRowIds([swapConfirmInfo.rowIdA, swapConfirmInfo.rowIdB]);
                  swapHighlightTimeoutRef.current = setTimeout(() => setSwapHighlightRowIds([]), 4000);
                  setClickedRowId(null);
                  swapOrderBetweenRows(swapConfirmInfo.rowIdA, swapConfirmInfo.rowIdB);
                  showSnackbar?.(`Schedule updated (${swapConfirmInfo.changedCount || 0} batches re-timed)`);
                  setSwapConfirmOpen(false);
                  setSwapConfirmInfo(null);
                }}
                disabled={swapConfirmCountdown > 0}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {swapConfirmCountdown > 0 ? `Proceed & reflow schedule (${swapConfirmCountdown})` : 'Proceed & reflow schedule'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={orderHelpOpen} onOpenChange={setOrderHelpOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[60] w-full max-w-lg max-h-[90vh] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white shadow-lg p-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900">How “Order” (↑/↓) works</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-gray-700 space-y-2">
              <div>
                The ↑/↓ buttons move a batch into a different <span className="font-medium">schedule slot</span> on the same production line.
                This is not just a visual reorder. Meaning, it can change <span className="font-medium">Start Sponge</span>, <span className="font-medium">End Dough</span>, and <span className="font-medium">End Batch</span> times for downstream batches.
              </div>
              <div className="text-sm text-gray-700">
                <div className="font-medium">What changes</div>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li><span className="font-medium">The moved batch</span> takes the target slot’s start time/date.</li>
                  <li><span className="font-medium">Batches after that point</span> are re-timed using your line rule (pipelined stagger or end-batch chaining), including midnight rollover.</li>
                  <li>Moves can cross days (Today ↔ Tomorrow) when the target slot is on a different date.</li>
                </ul>
              </div>
              <div className="text-sm text-gray-700">
                <div className="font-medium">Confirmation</div>
                <div className="mt-1">
                  For big impacts (cross-day or more than 2 batches re-timed), you’ll see a confirmation modal with a before → after preview.
                </div>
              </div>
            </Dialog.Description>
            <div className="mt-4 flex justify-end">
              <Dialog.Close asChild>
                <button type="button" className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark">
                  Got it
                </button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white shadow-lg p-4">
            {(() => {
              const status = deleteTargetRow ? getProductionStatus(deleteTargetRow, statusTick) : null;
              const isInProgress = status === 'In Progress';
              return (
                <>
                  <Dialog.Title className="text-lg font-semibold text-gray-900">
                    {isInProgress ? 'Delete in-progress line?' : 'Delete batch?'}
                  </Dialog.Title>
                  <Dialog.Description className="mt-2 text-sm text-gray-700">
                    <div>
                      {isInProgress ? (
                        <>
                          This production order is currently <span className="font-semibold">In Progress</span>. Deleting it will cancel the remaining progress on this line in the schedule.
                        </>
                      ) : (
                        <>This will permanently delete this batch.</>
                      )}
                    </div>
                    <div className="mt-2">
                      <span className="font-medium">Note:</span> Deleting does <span className="font-semibold">not</span> adjust or re-time other batches. Time slots before and after will stay as-is.
                    </div>
                    {isInProgress ? (
                      <div className="mt-2">
                        To confirm, type <span className="font-mono font-semibold">Delete to Cancel Progress Line</span> below, then click Delete.
                      </div>
                    ) : null}
                  </Dialog.Description>
                  {isInProgress ? (
                    <div className="mt-4">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Confirmation phrase</label>
                      <input
                        type="text"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900 text-sm"
                        placeholder="Delete to Cancel Progress Line"
                      />
                    </div>
                  ) : null}
                  <div className="mt-4 flex justify-end gap-2">
                    <Dialog.Close asChild>
                      <button
                        type="button"
                        className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                        onClick={() => {
                          setDeleteTargetRow(null);
                          setDeleteConfirmText('');
                        }}
                      >
                        Cancel
                      </button>
                    </Dialog.Close>
                    <button
                      type="button"
                      onClick={() => {
                        if (!deleteTargetRow) return;
                        const statusNow = getProductionStatus(deleteTargetRow, statusTick);
                        const needsPhrase = statusNow === 'In Progress';
                        if (needsPhrase && deleteConfirmText !== 'Delete to Cancel Progress Line') return;
                        const result = deleteBatch(deleteTargetRow.id);
                        if (result && !result.success && result.error) showSnackbar?.(result.error);
                        setDeleteConfirmOpen(false);
                        setDeleteTargetRow(null);
                        setDeleteConfirmText('');
                        setSwapHighlightRowIds([]);
                        setClickedRowId(null);
                      }}
                      disabled={(() => {
                        if (!deleteTargetRow) return true;
                        const statusNow = getProductionStatus(deleteTargetRow, statusTick);
                        const needsPhrase = statusNow === 'In Progress';
                        if (deleteConfirmCountdown > 0) return true;
                        return needsPhrase ? deleteConfirmText !== 'Delete to Cancel Progress Line' : false;
                      })()}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleteConfirmCountdown > 0 ? `Delete (${deleteConfirmCountdown})` : 'Delete'}
                    </button>
                  </div>
                </>
              );
            })()}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
