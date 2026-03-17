import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Pencil, Trash2, Check, X, Search } from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  getLines,
  getLineById,
  addLine,
  updateLine,
  deleteLine,
  getCapacityProfileForLine,
  addCapacityEntryForLine,
  updateCapacityEntryForLine,
  deleteCapacityEntryForLine,
  getProcessesForLine,
  addProcess,
  updateProcess,
  deleteProcess,
  getMixingProfiles,
  getProfileTotalMinutes,
  addMixingProfile,
  deleteMixingProfile,
  getTagForMixingProfile,
  setTagForMixingProfile,
  getEquipmentForProfile,
  getEquipmentMinutesForProfile,
  setEquipmentMinutesForProfile,
  addEquipmentItemToProfile,
  updateEquipmentItemInProfile,
  deleteEquipmentItemFromProfile,
  getProcessTimesForProfile,
  addProcessTimeToProfile,
  updateProcessTimeInProfile,
  deleteProcessTimeFromProfile,
} from '../store/productionLinesStore';
import { getRecipes } from '../store/recipeStore';
import { getMachines, addMachine, updateMachine, deleteMachine, resetMachinesToDefaults } from '../store/machinesStore';

function MachinesTabContent({ activeTab }) {
  const [machines, setMachinesState] = useState(() => getMachines());
  const [machineSearch, setMachineSearch] = useState('');
  useEffect(() => {
    if (activeTab === 'machines') setMachinesState(getMachines());
  }, [activeTab]);
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const refresh = useCallback(() => setMachinesState(getMachines()), []);
  const handleAdd = useCallback(() => {
    if (!newName.trim()) return;
    addMachine(newName.trim());
    setNewName('');
    refresh();
  }, [newName, refresh]);
  const handleSave = useCallback(() => {
    if (!editId || !editName.trim()) return;
    updateMachine(editId, { name: editName.trim() });
    setEditId(null);
    setEditName('');
    refresh();
  }, [editId, editName, refresh]);
  const handleDelete = useCallback((id) => {
    if (!window.confirm('Remove this machine/equipment from the list?')) return;
    deleteMachine(id);
    refresh();
  }, [refresh]);
  const handleResetToDefaults = useCallback(() => {
    if (!window.confirm('Replace the current machine list with the app’s default list? Any machines added only in the app (not in code) will be removed.')) return;
    resetMachinesToDefaults();
    refresh();
  }, [refresh]);
  const searchLower = machineSearch.trim().toLowerCase();
  const filteredMachines = searchLower
    ? machines.filter((m) => m.name.toLowerCase().includes(searchLower))
    : machines;

  return (
    <div className="p-3 sm:p-4 flex flex-col min-h-0">
      <p className="text-xs sm:text-sm 2xl:text-base text-muted mb-4">
        Maintain a master list of machines and equipment used by process profiles on the Production tab.
      </p>
      <div className="flex flex-col min-w-0 min-h-0 flex-1">
        <div className="flex items-center justify-end gap-2 mb-2">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden />
            <input
              type="text"
              value={machineSearch}
              onChange={(e) => setMachineSearch(e.target.value)}
              placeholder="Search machines..."
              className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm w-48 sm:w-56 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              aria-label="Search machines"
            />
          </div>
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs sm:text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            Reset to defaults
          </button>
        </div>
        <div className="overflow-auto min-h-0 border border-gray-200 rounded-lg" style={{ maxHeight: 'min(60vh, 480px)' }}>
          <table className="w-full border-collapse text-xs sm:text-sm md:text-base 2xl:text-lg min-w-[320px]">
            <thead className="sticky top-0 z-10 bg-surface-card-warm shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-700 whitespace-nowrap bg-surface-card-warm">Machine / equipment</th>
                <th className="text-left py-2 sm:py-3 px-3 sm:px-4 w-24 sm:w-28 whitespace-nowrap bg-surface-card-warm">Actions</th>
              </tr>
            </thead>
            <tbody>
            <tr className="sticky top-12 z-10 border-b border-gray-200 bg-gray-50/95 backdrop-blur-sm shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
              <td className="py-2 sm:py-2.5 px-3 sm:px-4">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Name"
                  className="border border-gray-300 rounded-lg px-2 py-1 w-full max-w-[200px] text-inherit"
                />
              </td>
              <td className="py-2 sm:py-2.5 px-3 sm:px-4">
                <button type="button" onClick={handleAdd} disabled={!newName.trim()} className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-primary text-white text-xs sm:text-sm font-medium disabled:opacity-50">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </td>
            </tr>
            {filteredMachines.map((m) => {
              return (
              <tr key={m.id} className="border-b border-gray-100">
                {editId === m.id ? (
                  <>
                    <td className="py-2 sm:py-2.5 px-3 sm:px-4">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="border border-gray-300 rounded-lg px-2 py-1 w-full max-w-[200px] text-inherit"
                      />
                    </td>
                    <td className="py-2 sm:py-2.5 px-3 sm:px-4">
                      <div className="flex gap-1">
                        <button type="button" onClick={handleSave} className="px-2 py-1 rounded-lg bg-primary text-white text-xs font-medium">Save</button>
                        <button type="button" onClick={() => { setEditId(null); setEditName(''); }} className="px-2 py-1 rounded-lg border border-gray-300 text-xs font-medium">Cancel</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2 sm:py-2.5 px-3 sm:px-4 text-gray-800">{m.name}</td>
                    <td className="py-2 sm:py-2.5 px-3 sm:px-4">
                      <div className="flex gap-1">
                        <button type="button" onClick={() => { setEditId(m.id); setEditName(m.name); }} className="p-1 rounded-lg border border-gray-300 hover:bg-gray-100" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
                        <button type="button" onClick={() => handleDelete(m.id)} className="p-1 rounded-lg border border-gray-300 hover:bg-red-50 text-red-600" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            );})}
          </tbody>
        </table>
        </div>
      </div>
      {machines.length === 0 && (
        <p className="text-xs sm:text-sm text-muted mt-2">No machines yet. Add one in the table above.</p>
      )}
      {machines.length > 0 && filteredMachines.length === 0 && (
        <p className="text-xs sm:text-sm text-muted mt-2">No machines match your search.</p>
      )}
    </div>
  );
}

export default function ProductionView() {
  const [lines, setLinesState] = useState(() => getLines());
  const [selectedLineId, setSelectedLineId] = useState(() => getLines()[0]?.id ?? 'line-loaf');
  const [capacityProfile, setCapacityProfileState] = useState(() => getCapacityProfileForLine(getLines()[0]?.id ?? 'line-loaf'));
  const [capacityEditId, setCapacityEditId] = useState(null);
  const [capacityDraft, setCapacityDraft] = useState(null);
  const [equipmentEdit, setEquipmentEdit] = useState(null);
  const [equipmentDraft, setEquipmentDraft] = useState(null);
  const [newCapacityName, setNewCapacityName] = useState('');
  const [newCapacityProduct, setNewCapacityProduct] = useState('');
  const [newCapacityValue, setNewCapacityValue] = useState('');
  const [newCapacityYield, setNewCapacityYield] = useState('');
  const [newCapacityDoughKg, setNewCapacityDoughKg] = useState('');
  const [newCapacityTotalDoughKg, setNewCapacityTotalDoughKg] = useState('');
  const [newCapacityGrams, setNewCapacityGrams] = useState('');
  const [capacityAddModalOpen, setCapacityAddModalOpen] = useState(false);
  const [capacityDeleteConfirm, setCapacityDeleteConfirm] = useState(null); // { id, capacityName } | null
  const [selectedMachineId, setSelectedMachineId] = useState({}); // key: `${line.id}-${proc.id}` -> machineId for dropdown
  const [newEquipmentMinutes, setNewEquipmentMinutes] = useState({}); // key: `${line.id}-${proc.id}` -> minutes number
  const [equipmentDropdownOpen, setEquipmentDropdownOpen] = useState(null); // null | { type: 'add', key } | { type: 'edit', lineId, sectionId, itemId }
  const [equipmentDropdownSearch, setEquipmentDropdownSearch] = useState('');
  const equipmentDropdownRef = useRef(null);
  const equipmentDropdownPortalRef = useRef(null);
  const [equipmentDropdownBounds, setEquipmentDropdownBounds] = useState(null);
  const [machinesVersion, setMachinesVersion] = useState(0); // bump to re-read machines after assign/unassign
  const [newLineName, setNewLineName] = useState('');
  const [lineEditId, setLineEditId] = useState(null);
  const [lineEditName, setLineEditName] = useState('');
  const [newProcessName, setNewProcessName] = useState('');
  const [processEditId, setProcessEditId] = useState(null);
  const [processEditName, setProcessEditName] = useState('');
  const [newProcessTimeName, setNewProcessTimeName] = useState('');
  const [newProcessTimeMinutes, setNewProcessTimeMinutes] = useState('');
  const [newProcessTimeIsPipelineStagger, setNewProcessTimeIsPipelineStagger] = useState(false);
  const [processTimeEdit, setProcessTimeEdit] = useState(null); // { lineId, processId, processTimeId }
  const [processTimeDraft, setProcessTimeDraft] = useState(null); // { name, minutes, isPipelineStagger }
  const [activeMainTab, setActiveMainTab] = useState('production');
  const [selectedMixingProfileId, setSelectedMixingProfileId] = useState({}); // key: `${line.id}-${proc.id}` -> profileId
  const [processTabValueByLine, setProcessTabValueByLine] = useState({}); // key: line.id -> tab value (proc.id or 'add-process')
  const [processTimeDuplicateNameError, setProcessTimeDuplicateNameError] = useState(false);
  const [stepOrderDuplicateError, setStepOrderDuplicateError] = useState(null);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [tagTarget, setTagTarget] = useState(null); // { lineId, processId, profileId } | null

  const pipelineHelpText = 'Marks a step as a pipelining breakpoint. This enables pipelined batching so multiple batches can be executed within the same process before the previous batch finishes the entire line.';

  const selectedLine = getLineById(selectedLineId) ?? lines[0];
  const processes = selectedLine ? getProcessesForLine(selectedLine.id) : [];
  const recipes = getRecipes();
  const machinesList = getMachines();
  const equipmentDropdownSearchLower = equipmentDropdownSearch.trim().toLowerCase();
  const machinesFilteredForDropdown = equipmentDropdownSearchLower
    ? machinesList.filter((m) => m.name.toLowerCase().includes(equipmentDropdownSearchLower))
    : machinesList;

  const refreshLines = useCallback(() => setLinesState(getLines()), []);
  const refreshMachines = useCallback(() => setMachinesVersion((v) => v + 1), []);
  useEffect(() => {
    if (activeMainTab === 'production') refreshMachines();
  }, [activeMainTab, refreshMachines]);

  // Auto-dismiss duplicate order error after 4s.
  useEffect(() => {
    if (!stepOrderDuplicateError) return undefined;
    const t = setTimeout(() => setStepOrderDuplicateError(null), 4000);
    return () => clearTimeout(t);
  }, [stepOrderDuplicateError]);
  // Default each process's mixing profile dropdown to the first profile when profiles exist and none is selected
  useEffect(() => {
    setSelectedMixingProfileId((prev) => {
      let changed = false;
      const next = { ...prev };
      const lineList = getLines();
      lineList.forEach((line) => {
        getProcessesForLine(line.id).forEach((proc) => {
          const key = `${line.id}-${proc.id}`;
          const profiles = getMixingProfiles(line.id, proc.id);
          if (profiles.length > 0 && !next[key]) {
            next[key] = profiles[0].id;
            changed = true;
          }
        });
      });
      return changed ? next : prev;
    });
  }, [lines]);
  useEffect(() => {
    if (!equipmentDropdownOpen) {
      setEquipmentDropdownBounds(null);
      return;
    }
    const updateBounds = () => {
      if (equipmentDropdownRef.current) {
        const r = equipmentDropdownRef.current.getBoundingClientRect();
        setEquipmentDropdownBounds({ left: r.left, top: r.bottom + 4, width: Math.max(200, r.width) });
      }
    };
    const raf = requestAnimationFrame(updateBounds);
    const onScrollOrResize = () => updateBounds();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [equipmentDropdownOpen]);

  useEffect(() => {
    if (!equipmentDropdownOpen) return;
    const onMouseDown = (e) => {
      const trigger = equipmentDropdownRef.current;
      const panel = equipmentDropdownPortalRef.current;
      if (trigger?.contains(e.target) || panel?.contains(e.target)) return;
      setEquipmentDropdownOpen(null);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [equipmentDropdownOpen]);
  const refreshCapacity = useCallback(() => {
    setCapacityProfileState(getCapacityProfileForLine(selectedLineId));
  }, [selectedLineId]);

  const selectLine = useCallback((id) => {
    setSelectedLineId(id);
    setCapacityProfileState(getCapacityProfileForLine(id));
    setCapacityEditId(null);
    setCapacityDraft(null);
    setCapacityAddModalOpen(false);
    setCapacityDeleteConfirm(null);
    setLineEditId(null);
    setProcessEditId(null);
  }, []);

  const handleAddLine = useCallback(() => {
    const name = newLineName.trim() || 'New Line';
    const added = addLine(name);
    if (added) {
      setLinesState(getLines());
      setNewLineName('');
      selectLine(added.id);
    }
  }, [newLineName, selectLine]);

  const handleUpdateLine = useCallback(() => {
    if (!lineEditId || !lineEditName.trim()) return;
    updateLine(lineEditId, { name: lineEditName.trim() });
    setLinesState(getLines());
    setLineEditId(null);
    setLineEditName('');
  }, [lineEditId, lineEditName]);

  const handleDeleteLine = useCallback((id) => {
    if (lines.length <= 1) return;
    if (!window.confirm('Delete this production line? This cannot be undone.')) return;
    deleteLine(id);
    const next = getLines();
    setLinesState(next);
    if (selectedLineId === id) selectLine(next[0]?.id ?? '');
  }, [lines.length, selectedLineId, selectLine]);

  const handleCapacitySave = useCallback(() => {
    if (!capacityEditId || !capacityDraft || !selectedLineId) return;
    updateCapacityEntryForLine(selectedLineId, capacityEditId, {
      capacityName: capacityDraft.capacityName,
      productName: capacityDraft.productName,
      capacity: capacityDraft.capacity,
      yield: capacityDraft.yield !== undefined && capacityDraft.yield !== '' ? Number(capacityDraft.yield) : null,
      doughWeightKg: capacityDraft.doughWeightKg !== undefined && capacityDraft.doughWeightKg !== '' ? Number(capacityDraft.doughWeightKg) : null,
      totalDoughWeightKg: capacityDraft.totalDoughWeightKg !== undefined && capacityDraft.totalDoughWeightKg !== '' ? Number(capacityDraft.totalDoughWeightKg) : null,
      gramsPerUnit: capacityDraft.gramsPerUnit !== undefined && capacityDraft.gramsPerUnit !== '' ? Number(capacityDraft.gramsPerUnit) : null,
    });
    refreshCapacity();
    setCapacityEditId(null);
    setCapacityDraft(null);
  }, [capacityEditId, capacityDraft, selectedLineId, refreshCapacity]);

  const handleCapacityAdd = useCallback(() => {
    if (!selectedLineId) return;
    addCapacityEntryForLine(selectedLineId, {
      capacityName: newCapacityName.trim(),
      productName: newCapacityProduct.trim(),
      capacity: Number(newCapacityValue) || 0,
      yield: newCapacityYield !== '' ? Number(newCapacityYield) : null,
      doughWeightKg: newCapacityDoughKg !== '' ? Number(newCapacityDoughKg) : null,
      totalDoughWeightKg: newCapacityTotalDoughKg !== '' ? Number(newCapacityTotalDoughKg) : null,
      gramsPerUnit: newCapacityGrams !== '' ? Number(newCapacityGrams) : null,
    });
    refreshCapacity();
    setNewCapacityName('');
    setNewCapacityProduct('');
    setNewCapacityValue('');
    setNewCapacityYield('');
    setNewCapacityDoughKg('');
    setNewCapacityTotalDoughKg('');
    setNewCapacityGrams('');
    setCapacityAddModalOpen(false);
  }, [selectedLineId, newCapacityName, newCapacityProduct, newCapacityValue, newCapacityYield, newCapacityDoughKg, newCapacityTotalDoughKg, newCapacityGrams, refreshCapacity]);

  const handleCapacityDelete = useCallback((entryId) => {
    if (!selectedLineId) return;
    deleteCapacityEntryForLine(selectedLineId, entryId);
    refreshCapacity();
    setCapacityDeleteConfirm(null);
  }, [selectedLineId, refreshCapacity]);

  const handleAddProcess = useCallback(() => {
    if (!selectedLineId || !newProcessName.trim()) return;
    addProcess(selectedLineId, newProcessName.trim());
    setLinesState(getLines());
    setNewProcessName('');
  }, [selectedLineId, newProcessName]);

  const handleUpdateProcess = useCallback(() => {
    if (!selectedLineId || !processEditId || !processEditName.trim()) return;
    updateProcess(selectedLineId, processEditId, { name: processEditName.trim() });
    setLinesState(getLines());
    setProcessEditId(null);
    setProcessEditName('');
  }, [selectedLineId, processEditId, processEditName]);

  const handleDeleteProcess = useCallback((processId) => {
    if (!selectedLineId) return;
    if (!window.confirm('Delete this process and all its equipment?')) return;
    deleteProcess(selectedLineId, processId);
    setLinesState(getLines());
  }, [selectedLineId]);

  const handleEquipmentSave = useCallback(() => {
    if (!equipmentEdit || !equipmentDraft) return;
    const { lineId, sectionId: processId, itemId } = equipmentEdit;
    const key = `${lineId}-${processId}`;
    const profileId = selectedMixingProfileId[key];
    if (!profileId) return;
    deleteEquipmentItemFromProfile(lineId, processId, profileId, itemId);
    if (equipmentDraft.machineId) {
      addEquipmentItemToProfile(lineId, processId, profileId, { id: equipmentDraft.machineId, name: equipmentDraft.name ?? 'Unnamed' });
      const mins = equipmentDraft.minutes !== undefined && equipmentDraft.minutes !== '' ? Number(equipmentDraft.minutes) : 0;
      setEquipmentMinutesForProfile(lineId, processId, profileId, equipmentDraft.machineId, mins);
    }
    setEquipmentEdit(null);
    setEquipmentDraft(null);
    setEquipmentDropdownOpen(null);
    setLinesState(getLines());
  }, [equipmentEdit, equipmentDraft, selectedMixingProfileId]);

  const handleEquipmentAdd = useCallback((lineId, processId, profileId, minutes) => {
    const key = `${lineId}-${processId}`;
    const machineId = selectedMachineId[key];
    if (!machineId || !profileId) return;
    const machine = machinesList.find((m) => m.id === machineId);
    addEquipmentItemToProfile(lineId, processId, profileId, { id: machineId, name: machine?.name ?? 'Unnamed' });
    setEquipmentMinutesForProfile(lineId, processId, profileId, machineId, minutes !== undefined && minutes !== '' && !Number.isNaN(Number(minutes)) ? Number(minutes) : 0);
    setSelectedMachineId((p) => ({ ...p, [key]: '' }));
    setNewEquipmentMinutes((p) => ({ ...p, [key]: '' }));
    setLinesState(getLines());
  }, [selectedMachineId]);

  const handleEquipmentDelete = useCallback((lineId, processId, profileId, machineId) => {
    if (!profileId) return;
    deleteEquipmentItemFromProfile(lineId, processId, profileId, machineId);
    setLinesState(getLines());
  }, []);

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-6 max-w-[1600px] xl:max-w-[1920px] 2xl:max-w-[2200px] mx-auto w-full min-w-0">
      {equipmentDropdownBounds && equipmentDropdownOpen && createPortal(
        <div
          ref={equipmentDropdownPortalRef}
          className="bg-white border border-gray-300 rounded-lg shadow-lg py-2 flex flex-col min-w-[200px] max-h-[min(70vh,400px)]"
          style={{
            position: 'fixed',
            left: equipmentDropdownBounds.left,
            top: equipmentDropdownBounds.top,
            width: equipmentDropdownBounds.width,
            zIndex: 9999,
          }}
        >
          <div className="px-2 pb-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" aria-hidden />
              <input
                type="text"
                value={equipmentDropdownSearch}
                onChange={(e) => setEquipmentDropdownSearch(e.target.value)}
                placeholder="Search..."
                className="w-full pl-7 pr-2 py-1.5 border border-gray-200 rounded text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                autoFocus
                aria-label="Filter machines"
              />
            </div>
          </div>
          <ul
            className="text-xs sm:text-sm overflow-x-hidden overscroll-contain flex-1 min-h-0"
            style={{ maxHeight: '208px', overflowY: 'auto' }}
          >
            {machinesFilteredForDropdown.map((machine) => (
              <li
                key={machine.id}
                onClick={() => {
                  if (equipmentDropdownOpen.type === 'edit') {
                    setEquipmentDraft((p) => (p ? { ...p, name: machine.name, machineId: machine.id } : { name: machine.name, machineId: machine.id }));
                  } else {
                    setSelectedMachineId((p) => ({ ...p, [equipmentDropdownOpen.key]: machine.id }));
                  }
                  setEquipmentDropdownOpen(null);
                }}
                className="px-3 py-1.5 hover:bg-gray-100 cursor-pointer"
              >
                {machine.name}
              </li>
            ))}
            {machinesFilteredForDropdown.length === 0 && (
              <li className="px-3 py-2 text-gray-500">No matches</li>
            )}
          </ul>
        </div>,
        document.body
      )}
      <Tabs.Root value={activeMainTab} onValueChange={setActiveMainTab} className="w-full min-w-0">
        <Tabs.List className="flex gap-1 border-b border-gray-200 bg-surface-card-warm rounded-t-card overflow-x-auto pt-2 px-2 min-w-0 mb-4">
          <Tabs.Trigger
            value="production"
            className="px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm md:text-base font-medium rounded-t-lg transition-colors shrink-0 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=inactive]:text-gray-700 data-[state=inactive]:hover:bg-gray-200/50"
          >
            1) Production
          </Tabs.Trigger>
          <Tabs.Trigger
            value="machines"
            className="px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm md:text-base font-medium rounded-t-lg transition-colors shrink-0 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=inactive]:text-gray-700 data-[state=inactive]:hover:bg-gray-200/50"
          >
            2) Machines/Equipment
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="production" className="mt-0 rounded-b-card border border-gray-200 border-t-0 min-w-0 flex flex-col min-h-0">
      <p className="text-xs sm:text-sm 2xl:text-base text-muted m-3 ml-5 shrink-0">
        Capacity profile and machines/equipment per production line. Each line has its own capacity entries and process structure.
      </p>

      {/* Add production line */}
      <div className="flex flex-wrap gap-2 items-center m-5 shrink-0">
        <input
          type="text"
          value={newLineName}
          onChange={(e) => setNewLineName(e.target.value)}
          placeholder="New line name"
          className="border border-gray-300 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm w-full min-w-0 sm:w-40"
        />
        <button type="button" onClick={handleAddLine} className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark text-xs sm:text-sm transition-colors shrink-0">
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          Add line
        </button>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
      {lines.length === 0 ? (
        <p className="text-xs sm:text-sm 2xl:text-base text-muted">Add a production line above.</p>
      ) : (
        <Tabs.Root value={selectedLineId} onValueChange={selectLine} className="w-full min-w-0 flex flex-col min-h-0 flex-1">
          <Tabs.List className="flex gap-1 border-b border-gray-200 bg-surface-card-warm rounded-t-card overflow-x-auto pt-2 px-2 min-w-0">
            {lines.map((line) => (
              <Tabs.Trigger
                key={line.id}
                value={line.id}
                className="px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm md:text-base font-medium rounded-t-lg transition-colors shrink-0 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=inactive]:text-gray-700 data-[state=inactive]:hover:bg-gray-200/50"
              >
                {line.name}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          {lines.map((line) => (
            <Tabs.Content key={line.id} value={line.id} className="mt-0 rounded-b-card border border-gray-200 border-t-0 bg-surface-card min-w-0 flex flex-col flex-1 min-h-0">
              {selectedLineId === line.id && selectedLine && (
                <>
                  {/* Line toolbar: edit name / delete */}
                  <div className="flex flex-wrap gap-2 items-center p-2 sm:p-3 border-b border-gray-200 bg-surface-card-warm">
                    {lineEditId === line.id ? (
                      <>
                        <input
                          type="text"
                          value={lineEditName}
                          onChange={(e) => setLineEditName(e.target.value)}
                          className="border border-gray-300 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm w-full min-w-0 sm:w-48"
                          placeholder="Line name"
                        />
                        <button type="button" onClick={handleUpdateLine} className="shrink-0 inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg bg-primary text-white text-xs sm:text-sm font-medium" aria-label="Save"><Check className="w-4 h-4" /></button>
                        <button type="button" onClick={() => { setLineEditId(null); setLineEditName(''); }} className="shrink-0 inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg border border-gray-300 text-xs sm:text-sm font-medium" aria-label="Cancel"><X className="w-4 h-4" /></button>
                      </>
                    ) : (
                      <>
                        <span className="text-xs sm:text-sm 2xl:text-base font-medium text-gray-700">Line: {line.name}</span>
                        <button type="button" onClick={() => { setLineEditId(line.id); setLineEditName(line.name); }} className="p-1.5 sm:p-2 rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-600" aria-label="Edit line"><Pencil className="w-4 h-4" /></button>
                        <button type="button" onClick={() => handleDeleteLine(line.id)} disabled={lines.length <= 1} className="p-1.5 sm:p-2 rounded-lg border border-gray-300 hover:bg-red-50 text-red-600 disabled:opacity-40 disabled:cursor-not-allowed" aria-label="Delete line"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>

                  {/* Capacity profile */}
                  <div className="border-b border-gray-100">
                    <h3 className="p-2 sm:p-3 border-b border-gray-200 bg-surface-card-warm text-xs sm:text-sm md:text-base font-semibold text-gray-800">
                      Capacity profile ({line.name})
                    </h3>
                    <div className="p-3 sm:p-4 overflow-x-auto min-w-0">
                      <div
                        className="capacity-profile-table-fluid"
                        style={{ fontSize: 'clamp(0.5rem, 0.5rem + (100vw - 20rem) * 0.0046, 1.125rem)' }}
                      >
                        <table className="w-full border-collapse min-w-[320px]">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 whitespace-nowrap">Capacity Name</th>
                              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold w-20 sm:w-24 whitespace-nowrap">Actions</th>
                              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 whitespace-nowrap">Product</th>
                              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 whitespace-nowrap">Capacity</th>
                              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 whitespace-nowrap">Yield</th>
                              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 whitespace-nowrap">Dough (kg)</th>
                              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 whitespace-nowrap">Total dough (kg)</th>
                              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 whitespace-nowrap">Grams</th>
                              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 whitespace-nowrap">Total grams</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const profileList = selectedLineId === line.id ? capacityProfile : getCapacityProfileForLine(line.id);
                              if (profileList.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={9} className="py-8 px-4 text-center text-gray-500 text-sm">
                                      No capacity profiles. Click Add to create one.
                                    </td>
                                  </tr>
                                );
                              }
                              return profileList.map((entry) => (
                                <tr
                                  key={entry.id}
                                  className="border-b border-gray-100 hover:bg-gray-50/80"
                                  onClick={selectedLineId === line.id ? () => { setCapacityEditId(entry.id); setCapacityDraft({ ...entry }); } : undefined}
                                  role={selectedLineId === line.id ? 'button' : undefined}
                                  tabIndex={selectedLineId === line.id ? 0 : undefined}
                                  onKeyDown={selectedLineId === line.id ? (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setCapacityEditId(entry.id); setCapacityDraft({ ...entry }); } } : undefined}
                                  aria-label={selectedLineId === line.id ? `Edit ${entry.capacityName || 'capacity profile'}` : undefined}
                                >
                                  <td className="py-2 sm:py-2.5 px-2 sm:px-4 whitespace-nowrap text-gray-800">{entry.capacityName || '—'}</td>
                                  <td className="py-2 sm:py-2.5 px-2 sm:px-4 whitespace-nowrap" onClick={(ev) => ev.stopPropagation()}>
                                    {selectedLineId === line.id ? (
                                      <div className="flex gap-1">
                                        <button type="button" onClick={() => { setCapacityEditId(entry.id); setCapacityDraft({ ...entry }); }} className="p-1 rounded-lg border border-gray-300 hover:bg-gray-100" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
                                        <button type="button" onClick={() => setCapacityDeleteConfirm({ id: entry.id, capacityName: entry.capacityName || 'this profile' })} className="p-1 rounded-lg border border-gray-300 hover:bg-red-50 text-red-600" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                                      </div>
                                    ) : null}
                                  </td>
                                  <td className="py-2 sm:py-2.5 px-2 sm:px-4 whitespace-nowrap text-gray-800">{entry.productName || '—'}</td>
                                  <td className="py-2 sm:py-2.5 px-2 sm:px-4 whitespace-nowrap text-gray-800">{entry.capacity ?? '—'}</td>
                                  <td className="py-2 sm:py-2.5 px-2 sm:px-4 whitespace-nowrap text-gray-800">{entry.yield ?? '—'}</td>
                                  <td className="py-2 sm:py-2.5 px-2 sm:px-4 whitespace-nowrap text-gray-800">{entry.doughWeightKg ?? '—'}</td>
                                  <td className="py-2 sm:py-2.5 px-2 sm:px-4 whitespace-nowrap text-gray-800">{entry.totalDoughWeightKg ?? '—'}</td>
                                  <td className="py-2 sm:py-2.5 px-2 sm:px-4 whitespace-nowrap text-gray-800">{entry.gramsPerUnit ?? '—'}</td>
                                  <td className="py-2 sm:py-2.5 px-2 sm:px-4 text-gray-700 whitespace-nowrap">
                                    {entry.totalDoughWeightKg != null && !Number.isNaN(entry.totalDoughWeightKg) ? (entry.totalDoughWeightKg * 1000).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—'}
                                  </td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    {selectedLineId === line.id && (
                      <div className="px-3 sm:px-4 pb-3 sm:pb-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setCapacityAddModalOpen(true)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 sm:py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark shrink-0 text-sm sm:text-base"
                        >
                          <Plus className="w-4 h-4 inline" /> Add
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Add Capacity Profile modal */}
                  {selectedLineId === line.id && (
                    <Dialog.Root open={capacityAddModalOpen} onOpenChange={setCapacityAddModalOpen}>
                      <Dialog.Portal>
                        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
                        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-lg max-h-[90vh] overflow-y-auto">
                          <Dialog.Title className="text-base sm:text-lg font-semibold text-gray-900">Add Capacity Profile</Dialog.Title>
                          <Dialog.Description className="text-sm text-gray-600 mt-0.5">Add a new capacity profile for {line.name}. All fields use the same units as the table.</Dialog.Description>
                          <form
                            className="mt-4 space-y-3"
                            onSubmit={(e) => { e.preventDefault(); if (newCapacityName.trim()) handleCapacityAdd(); }}
                          >
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Capacity name (e.g. 8s)</label>
                              <input
                                type="text"
                                value={newCapacityName}
                                onChange={(e) => setNewCapacityName(e.target.value)}
                                placeholder="Capacity name (e.g. 8s)"
                                className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                              <select
                                value={newCapacityProduct}
                                onChange={(e) => setNewCapacityProduct(e.target.value)}
                                className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                              >
                                <option value="">— Select product —</option>
                                {recipes.map((r) => (
                                  <option key={r.id} value={r.name}>{r.name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                                <input
                                  type="number"
                                  value={newCapacityValue}
                                  onChange={(e) => setNewCapacityValue(e.target.value)}
                                  placeholder="Capacity"
                                  className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Yield</label>
                                <input
                                  type="number"
                                  value={newCapacityYield}
                                  onChange={(e) => setNewCapacityYield(e.target.value)}
                                  placeholder="e.g. 1092"
                                  className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                  title="Pieces per one dough batch"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Dough (kg)</label>
                                <input
                                  type="number"
                                  value={newCapacityDoughKg}
                                  onChange={(e) => setNewCapacityDoughKg(e.target.value)}
                                  placeholder="e.g. 275"
                                  className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Total dough (kg)</label>
                                <input
                                  type="number"
                                  step="any"
                                  value={newCapacityTotalDoughKg}
                                  onChange={(e) => setNewCapacityTotalDoughKg(e.target.value)}
                                  placeholder="e.g. 505.31"
                                  className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Grams</label>
                              <input
                                type="number"
                                value={newCapacityGrams}
                                onChange={(e) => setNewCapacityGrams(e.target.value)}
                                placeholder="e.g. 1000"
                                className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                title="Target weight per unit (g)"
                              />
                            </div>
                            <div className="flex gap-2 pt-2 justify-end">
                              <Dialog.Close asChild>
                                <button type="button" className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
                                  Cancel
                                </button>
                              </Dialog.Close>
                              <button
                                type="submit"
                                disabled={!newCapacityName.trim()}
                                className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50 hover:bg-primary-dark inline-flex items-center gap-1"
                              >
                                <Plus className="w-4 h-4" /> Add
                              </button>
                            </div>
                          </form>
                        </Dialog.Content>
                      </Dialog.Portal>
                    </Dialog.Root>
                  )}

                  {/* Edit Capacity Profile modal */}
                  {selectedLineId === line.id && (
                    <Dialog.Root open={!!capacityEditId && !!capacityDraft} onOpenChange={(open) => { if (!open) { setCapacityEditId(null); setCapacityDraft(null); } }}>
                      <Dialog.Portal>
                        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
                        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-lg max-h-[90vh] overflow-y-auto">
                          <Dialog.Title className="text-base sm:text-lg font-semibold text-gray-900">Edit Capacity Profile</Dialog.Title>
                          <Dialog.Description className="text-sm text-gray-600 mt-0.5">Update the capacity profile for {line.name}.</Dialog.Description>
                          {capacityDraft && (
                            <form
                              className="mt-4 space-y-3"
                              onSubmit={(e) => { e.preventDefault(); if (capacityDraft.capacityName?.trim()) handleCapacitySave(); }}
                            >
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Capacity name (e.g. 8s)</label>
                                <input
                                  type="text"
                                  value={capacityDraft.capacityName ?? ''}
                                  onChange={(ev) => setCapacityDraft((p) => p ? { ...p, capacityName: ev.target.value } : p)}
                                  placeholder="Capacity name (e.g. 8s)"
                                  className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                                <select
                                  value={capacityDraft.productName ?? ''}
                                  onChange={(ev) => setCapacityDraft((p) => p ? { ...p, productName: ev.target.value } : p)}
                                  className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                >
                                  <option value="">— Select product —</option>
                                  {recipes.map((r) => (
                                    <option key={r.id} value={r.name}>{r.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                                  <input
                                    type="number"
                                    value={capacityDraft.capacity ?? ''}
                                    onChange={(ev) => setCapacityDraft((p) => p ? { ...p, capacity: Number(ev.target.value) || 0 } : p)}
                                    placeholder="Capacity"
                                    className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Yield</label>
                                  <input
                                    type="number"
                                    value={capacityDraft.yield ?? ''}
                                    onChange={(ev) => setCapacityDraft((p) => p ? { ...p, yield: ev.target.value === '' ? null : Number(ev.target.value) } : p)}
                                    placeholder="e.g. 1092"
                                    className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                    title="Pieces per one dough batch"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Dough (kg)</label>
                                  <input
                                    type="number"
                                    value={capacityDraft.doughWeightKg ?? ''}
                                    onChange={(ev) => setCapacityDraft((p) => p ? { ...p, doughWeightKg: ev.target.value === '' ? null : Number(ev.target.value) } : p)}
                                    placeholder="e.g. 275"
                                    className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Total dough (kg)</label>
                                  <input
                                    type="number"
                                    step="any"
                                    value={capacityDraft.totalDoughWeightKg ?? ''}
                                    onChange={(ev) => setCapacityDraft((p) => p ? { ...p, totalDoughWeightKg: ev.target.value === '' ? null : Number(ev.target.value) } : p)}
                                    placeholder="e.g. 505.31"
                                    className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Grams</label>
                                <input
                                  type="number"
                                  value={capacityDraft.gramsPerUnit ?? ''}
                                  onChange={(ev) => setCapacityDraft((p) => p ? { ...p, gramsPerUnit: ev.target.value === '' ? null : Number(ev.target.value) } : p)}
                                  placeholder="e.g. 1000"
                                  className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                  title="Target weight per unit (g)"
                                />
                              </div>
                              <div className="flex gap-2 pt-2 justify-end">
                                <Dialog.Close asChild>
                                  <button type="button" className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
                                    Cancel
                                  </button>
                                </Dialog.Close>
                                <button
                                  type="submit"
                                  disabled={!capacityDraft.capacityName?.trim()}
                                  className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50 hover:bg-primary-dark inline-flex items-center gap-1"
                                >
                                  <Check className="w-4 h-4" /> Save
                                </button>
                              </div>
                            </form>
                          )}
                        </Dialog.Content>
                      </Dialog.Portal>
                    </Dialog.Root>
                  )}

                  {/* Delete Capacity Profile confirmation modal */}
                  {selectedLineId === line.id && (
                    <Dialog.Root open={!!capacityDeleteConfirm} onOpenChange={(open) => { if (!open) setCapacityDeleteConfirm(null); }}>
                      <Dialog.Portal>
                        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
                        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-lg">
                          <Dialog.Title className="text-base sm:text-lg font-semibold text-gray-900">Delete capacity profile</Dialog.Title>
                          <Dialog.Description className="text-sm text-gray-600 mt-1">
                            Are you sure you want to delete {capacityDeleteConfirm?.capacityName ?? 'this profile'}?
                          </Dialog.Description>
                          <div className="flex gap-2 pt-4 justify-end">
                            <Dialog.Close asChild>
                              <button type="button" className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
                                Cancel
                              </button>
                            </Dialog.Close>
                            <button
                              type="button"
                              onClick={() => capacityDeleteConfirm && handleCapacityDelete(capacityDeleteConfirm.id)}
                              className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 inline-flex items-center gap-1"
                            >
                              <Trash2 className="w-4 h-4" /> Delete
                            </button>
                          </div>
                        </Dialog.Content>
                      </Dialog.Portal>
                    </Dialog.Root>
                  )}

                  {/* Process line + Machines/Equipment */}
                  <div>
                    <h3 className="p-2 sm:p-3 border-b border-gray-200 bg-surface-card-warm text-xs sm:text-sm md:text-base 2xl:text-lg font-semibold text-gray-800">
                      Process line — {line.name}
                    </h3>
                    <div className="p-3 sm:p-4">
                  {(() => {
                    const procs = getProcessesForLine(line.id);
                    const tabValue = processTabValueByLine[line.id] ?? (procs[0]?.id ?? 'add-process');
                    const setTabValue = (v) => setProcessTabValueByLine((p) => ({ ...p, [line.id]: v }));
                    return (
                      <Tabs.Root
                        value={procs.some((p) => p.id === tabValue) || tabValue === 'add-process' ? tabValue : (procs[0]?.id ?? 'add-process')}
                        onValueChange={setTabValue}
                        key={`${line.id}-process`}
                        className="w-full min-w-0 flex flex-col flex-1 min-h-0"
                      >
                        <p className="text-xs sm:text-sm text-gray-500 mb-1.5" aria-hidden>Process tabs — select a process to view or edit</p>
                        <Tabs.List className="flex gap-1 border-b-2 border-gray-200 bg-gray-100/80 px-2 pt-2 pb-0 overflow-x-auto overflow-y-hidden flex-nowrap min-w-0 rounded-t-lg" role="tablist" aria-label="Process tabs">
                          {procs.map((proc) => (
                            <Tabs.Trigger
                              key={proc.id}
                              value={proc.id}
                              role="tab"
                              className="px-3 py-2 sm:py-2.5 text-xs sm:text-sm md:text-base font-medium rounded-t-lg shrink-0 transition-colors border border-transparent border-b-0 -mb-px data-[state=active]:bg-white data-[state=active]:border data-[state=active]:border-gray-200 data-[state=active]:border-b-white data-[state=active]:text-gray-900 data-[state=active]:font-semibold data-[state=active]:shadow-sm data-[state=inactive]:text-gray-500 data-[state=inactive]:hover:text-gray-700 data-[state=inactive]:hover:bg-gray-200/50"
                            >
                              {proc.name}
                            </Tabs.Trigger>
                          ))}
                          <Tabs.Trigger
                            value="add-process"
                            role="tab"
                            className="px-3 py-2 sm:py-2.5 text-xs sm:text-sm md:text-base font-medium rounded-t-lg shrink-0 transition-colors border border-transparent border-b-0 -mb-px data-[state=active]:bg-white data-[state=active]:border data-[state=active]:border-gray-200 data-[state=active]:border-b-white data-[state=active]:text-gray-900 data-[state=active]:font-semibold data-[state=active]:shadow-sm data-[state=inactive]:text-gray-500 data-[state=inactive]:hover:text-gray-700 data-[state=inactive]:hover:bg-gray-200/50"
                          >
                            + Add Process
                          </Tabs.Trigger>
                        </Tabs.List>

                        {/* Add Process tab content */}
                        <Tabs.Content
                          value="add-process"
                          role="tabpanel"
                          aria-label="Add process"
                          className="p-3 sm:p-4 border border-gray-200 border-t-0 rounded-b-lg bg-white shadow-sm data-[state=inactive]:hidden"
                        >
                          {selectedLineId === line.id ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="text"
                                value={newProcessName}
                                onChange={(e) => setNewProcessName(e.target.value)}
                                placeholder="Process name (e.g. Mixing)"
                                className="border border-gray-300 rounded-lg px-2 py-1.5 sm:py-2 text-xs sm:text-sm w-full min-w-0 sm:w-64"
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (newProcessName.trim()) { handleAddProcess(); setNewProcessName(''); } } }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (newProcessName.trim()) {
                                    handleAddProcess();
                                    setNewProcessName('');
                                  }
                                }}
                                disabled={!newProcessName.trim()}
                                className="inline-flex items-center gap-1 px-3 py-1.5 sm:py-2 rounded-lg bg-primary text-white text-xs sm:text-sm font-medium disabled:opacity-50 shrink-0"
                                aria-label="Confirm add process"
                              >
                                <Check className="w-4 h-4" /> Confirm
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs sm:text-sm text-muted">Select this line to add a process.</p>
                          )}
                        </Tabs.Content>

                        {procs.map((proc) => {
                          const key = `${line.id}-${proc.id}`;
                          const mixingProfiles = getMixingProfiles(line.id, proc.id);
                          const selectedProfileId = selectedMixingProfileId[key];
                          const equipment = selectedProfileId ? getEquipmentForProfile(line.id, proc.id, selectedProfileId) : [];
                          const selectedId = selectedMachineId[key] ?? '';
                          const isEditingProcess = selectedLineId === line.id && processEditId === proc.id;
                          const profileTotalMinutes = selectedProfileId ? getProfileTotalMinutes(line.id, proc.id, selectedProfileId) : 0;
                          return (
                            <Tabs.Content
                              key={proc.id}
                              value={proc.id}
                              forceMount
                              role="tabpanel"
                              aria-label={`${proc.name} process`}
                              className="p-3 sm:p-4 border border-gray-200 border-t-0 rounded-b-lg bg-white shadow-sm min-h-[560px] flex flex-col flex-1 min-w-0 data-[state=inactive]:hidden"
                            >
                              {/* Process edit + Mixing profile: one row, justify-between */}
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 shrink-0">
                                <div className="flex flex-wrap gap-2 items-center">
                                  {isEditingProcess ? (
                                    <>
                                      <input
                                        type="text"
                                        value={processEditName}
                                        onChange={(e) => setProcessEditName(e.target.value)}
                                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs sm:text-sm w-full min-w-0 sm:w-40"
                                      />
                                      <button type="button" onClick={handleUpdateProcess} className="px-2 py-1 rounded-lg bg-primary text-white text-xs sm:text-sm shrink-0">Save</button>
                                      <button type="button" onClick={() => { setProcessEditId(null); setProcessEditName(''); }} className="px-2 py-1 rounded-lg border border-gray-300 text-xs sm:text-sm shrink-0">Cancel</button>
                                    </>
                                  ) : (
                                    selectedLineId === line.id && (
                                      <>
                                        <span className="text-xs sm:text-sm text-gray-600">Process: {proc.name}</span>
                                        <button type="button" onClick={() => { setProcessEditId(proc.id); setProcessEditName(proc.name); }} className="p-1 rounded-lg border border-gray-300 hover:bg-gray-100 text-xs" aria-label="Edit process"><Pencil className="w-4 h-4 inline" /></button>
                                        <button type="button" onClick={() => handleDeleteProcess(proc.id)} className="p-1 rounded-lg border border-gray-300 hover:bg-red-50 text-red-600 text-xs" aria-label="Delete process"><Trash2 className="w-4 h-4 inline" /></button>
                                      </>
                                    )
                                  )}
                                </div>
                                {selectedLineId === line.id && (
                                  <div className="flex flex-wrap gap-2 items-center">
                                    <label className="text-xs sm:text-sm text-gray-600">
                                      {proc.name} profile:
                                    </label>
                                    {selectedProfileId && (
                                      <>
                                        <select
                                          value={getTagForMixingProfile(line.id, proc.id, selectedProfileId) || ''}
                                          onChange={(e) => { setTagForMixingProfile(line.id, proc.id, selectedProfileId, e.target.value); setLinesState(getLines()); }}
                                          className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs sm:text-sm bg-white min-w-[140px]"
                                          title="Tag this process profile"
                                        >
                                          <option value="">— Tag —</option>
                                          {(() => {
                                            const current = getTagForMixingProfile(line.id, proc.id, selectedProfileId) || '';
                                            return current ? <option value={current}>{current}</option> : null;
                                          })()}
                                        </select>
                                        <button
                                          type="button"
                                          onClick={() => { setTagDraft(''); setTagTarget({ lineId: line.id, processId: proc.id, profileId: selectedProfileId }); setTagModalOpen(true); }}
                                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs sm:text-sm font-medium hover:bg-gray-100"
                                        >
                                          <Plus className="w-4 h-4" /> Add tag
                                        </button>
                                      </>
                                    )}
                                    <select
                                      value={selectedProfileId ?? ''}
                                      onChange={(e) => setSelectedMixingProfileId((p) => ({ ...p, [key]: e.target.value || null }))}
                                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs sm:text-sm bg-white min-w-[120px]"
                                    >
                                      <option value="">— Select —</option>
                                      {mixingProfiles.map((mp) => (
                                        <option key={mp.id} value={mp.id}>
                                          {getProfileTotalMinutes(line.id, proc.id, mp.id)} min
                                        </option>
                                      ))}
                                    </select>
                                    {selectedProfileId && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (!window.confirm(`Delete the selected profile (${profileTotalMinutes} min)? This cannot be undone.`)) return;
                                          deleteMixingProfile(line.id, proc.id, selectedProfileId);
                                          setLinesState(getLines());
                                          const remaining = getMixingProfiles(line.id, proc.id);
                                          setSelectedMixingProfileId((p) => ({ ...p, [key]: remaining[0]?.id ?? null }));
                                        }}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-300 bg-red-50 text-red-700 text-xs sm:text-sm font-medium shrink-0 hover:bg-red-100"
                                      >
                                        <Trash2 className="w-4 h-4" /> Delete Process Profile
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const added = addMixingProfile(line.id, proc.id);
                                        if (added?.id) {
                                          setLinesState(getLines());
                                          setSelectedMixingProfileId((p) => ({ ...p, [key]: added.id }));
                                        }
                                      }}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs sm:text-sm font-medium shrink-0"
                                    >
                                      <Plus className="w-4 h-4" /> Add mixing profile
                                    </button>
                                  </div>
                                )}
                              </div>
                              {selectedProfileId ? (
                              <section className="border border-gray-200 rounded-xl bg-gray-50/50 p-3 sm:p-4 mt-2 flex flex-col min-w-0" aria-label={`Mixing profile ${profileTotalMinutes} min`}>
                                <h4 className="text-xs sm:text-sm md:text-base font-semibold text-gray-800 mb-3 shrink-0">Mixing profile — {profileTotalMinutes} min total</h4>
                                {stepOrderDuplicateError && (
                                  <p className="text-xs sm:text-sm text-red-600 mb-2">{stepOrderDuplicateError}</p>
                                )}
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 min-w-0">
                                <section className="border border-gray-200 rounded-lg bg-surface-card overflow-visible min-w-0 text-xs sm:text-sm md:text-sm lg:text-base xl:text-base 2xl:text-lg flex flex-col min-h-0">
                                  <div className="p-2 sm:p-3 border-b border-gray-200 bg-surface-card-warm shrink-0">
                                    <h4 className="font-semibold text-gray-800 text-inherit">Machines / equipment</h4>
                                    <p className="text-muted mt-0.5 text-[0.65rem] sm:text-xs md:text-xs">Add machines and set duration (minutes) for each. Click Edit to change.</p>
                                  </div>
                                  <div className="p-3 sm:p-4 text-inherit">
                              <div className="overflow-x-auto min-w-0">
                              <table className="w-full border-collapse text-inherit">
                                <thead>
                                  <tr className="border-b border-gray-200">
                                    <th className="text-left py-2 px-2 font-semibold text-gray-800 whitespace-nowrap text-[0.7rem] sm:text-xs lg:text-sm">Sequence</th>
                                    <th className="text-left py-2 px-2 font-semibold text-gray-800 text-[0.7rem] sm:text-xs lg:text-sm">Machine Name</th>
                                    <th className="text-left py-2 px-2 font-semibold text-gray-800 whitespace-nowrap text-[0.7rem] sm:text-xs lg:text-sm">Duration</th>
                                    <th className="text-left py-2 px-2 font-semibold text-gray-800 whitespace-nowrap text-[0.7rem] sm:text-xs lg:text-sm">
                                      <Tooltip.Provider delayDuration={200}>
                                        <Tooltip.Root>
                                          <Tooltip.Trigger asChild>
                                            <span className="inline-flex items-center gap-1 cursor-help">
                                              Pipeline <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-gray-300 text-[0.65rem] leading-none text-gray-700">?</span>
                                            </span>
                                          </Tooltip.Trigger>
                                          <Tooltip.Portal>
                                            <Tooltip.Content side="top" sideOffset={6} className="z-50 max-w-[90vw] rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg text-gray-900 text-xs sm:text-sm">
                                              {pipelineHelpText}
                                            </Tooltip.Content>
                                          </Tooltip.Portal>
                                        </Tooltip.Root>
                                      </Tooltip.Provider>
                                    </th>
                                    <th className="text-left py-2 px-2 w-24 sm:w-28 font-semibold text-gray-800 text-[0.7rem] sm:text-xs lg:text-sm">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {selectedLineId === line.id && selectedProfileId && (
                                    <tr className="border-b border-gray-200 bg-gray-50/80">
                                      <td className="py-2 px-2 text-xs text-muted">—</td>
                                      <td className="py-2 px-2">
                                        <div
                                          ref={equipmentDropdownOpen?.type === 'add' && equipmentDropdownOpen.key === key ? equipmentDropdownRef : null}
                                          className="relative min-w-[200px] max-w-[280px]"
                                        >
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEquipmentDropdownOpen({ type: 'add', key });
                                              setEquipmentDropdownSearch('');
                                            }}
                                            className="w-full text-left border border-gray-300 rounded-lg px-2 py-1.5 text-xs sm:text-sm bg-white"
                                          >
                                            {selectedId ? machinesList.find((x) => x.id === selectedId)?.name ?? '—' : '— Select —'}
                                          </button>
                                          {equipmentDropdownOpen?.type === 'add' && equipmentDropdownOpen.key === key && null}
                                        </div>
                                      </td>
                                      <td className="py-2 px-2">
                                        <input
                                          type="number"
                                          min={0}
                                          value={newEquipmentMinutes[key] ?? ''}
                                          onChange={(e) => setNewEquipmentMinutes((p) => ({ ...p, [key]: e.target.value }))}
                                          placeholder="mins."
                                          className="border border-gray-300 rounded-lg px-2 py-1.5 w-16 sm:w-20 text-xs sm:text-sm"
                                          title="Duration (minutes)"
                                        />
                                      </td>
                                      <td className="py-2 px-2 text-xs text-muted">—</td>
                                      <td className="py-2 px-2">
                                        <button
                                          type="button"
                                          onClick={() => handleEquipmentAdd(line.id, proc.id, selectedProfileId, newEquipmentMinutes[key])}
                                          disabled={!selectedId}
                                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs sm:text-sm font-medium shrink-0 disabled:opacity-50"
                                        >
                                          <Plus className="w-4 h-4 inline" /> Add
                                        </button>
                                      </td>
                                    </tr>
                                  )}
                                  {equipment.length === 0 ? (
                                    <tr>
                                      <td colSpan={5} className="py-3 px-2 text-xs sm:text-sm text-muted">No machines added yet. Use the Add row above.</td>
                                    </tr>
                                  ) : (
                                    equipment.map((item) => {
                                    const minutesVal = getEquipmentMinutesForProfile(line.id, proc.id, selectedProfileId, item.id);
                                    return (
                                      <tr key={item.id} className="border-b border-gray-100">
                                        <td className="py-2 px-2">
                                          <input
                                            type="number"
                                            min={1}
                                            value={item.order ?? ''}
                                            onChange={(e) => {
                                              setStepOrderDuplicateError(null);
                                              const nextOrder = e.target.value === '' ? null : Number(e.target.value);
                                              if (nextOrder != null && !Number.isNaN(Number(nextOrder))) {
                                                const eq = getEquipmentForProfile(line.id, proc.id, selectedProfileId);
                                                const pts = getProcessTimesForProfile(line.id, proc.id, selectedProfileId);
                                                const used = new Set([
                                                  ...eq.filter((x) => x.id !== item.id).map((x) => Number(x.order)).filter((n) => !Number.isNaN(n) && n != null),
                                                  ...pts.map((x) => Number(x.order)).filter((n) => !Number.isNaN(n) && n != null),
                                                ]);
                                                if (used.has(Number(nextOrder))) {
                                                  setStepOrderDuplicateError(`Order #${Number(nextOrder)} is already used in this profile. Choose a unique number across Machines/Equipment and Process times.`);
                                                  return;
                                                }
                                              }
                                              updateEquipmentItemInProfile(line.id, proc.id, selectedProfileId, item.id, { order: nextOrder });
                                              setLinesState(getLines());
                                            }}
                                            className="border border-gray-300 rounded-lg px-2 py-1 w-16 text-xs sm:text-sm"
                                            title="Step order (sequence number)"
                                          />
                                        </td>
                                        <td className="py-2 px-2">
                                        {equipmentEdit?.lineId === line.id && equipmentEdit?.sectionId === proc.id && equipmentEdit?.itemId === item.id ? (
                                          <>
                                            <div
                                              ref={equipmentDropdownOpen?.type === 'edit' && equipmentDropdownOpen.itemId === item.id ? equipmentDropdownRef : null}
                                              className="relative min-w-0 max-w-xs"
                                            >
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setEquipmentDropdownOpen({ type: 'edit', lineId: line.id, sectionId: proc.id, itemId: item.id });
                                                  setEquipmentDropdownSearch('');
                                                }}
                                                className="w-full text-left border border-gray-300 rounded-lg px-2 py-1 text-xs sm:text-sm bg-white"
                                              >
                                                {equipmentDraft?.machineId ? machinesList.find((x) => x.id === equipmentDraft.machineId)?.name ?? '—' : '— Select machine / equipment —'}
                                              </button>
                                              {equipmentDropdownOpen?.type === 'edit' && equipmentDropdownOpen.lineId === line.id && equipmentDropdownOpen.sectionId === proc.id && equipmentDropdownOpen.itemId === item.id && null}
                                            </div>
                                          </>
                                        ) : (
                                          <span className="text-gray-800 font-medium text-xs sm:text-sm">{item.name}</span>
                                        )}
                                        </td>
                                        <td className="py-2 px-2">
                                        {equipmentEdit?.lineId === line.id && equipmentEdit?.sectionId === proc.id && equipmentEdit?.itemId === item.id ? (
                                          <>
                                            <input
                                              type="number"
                                              min={0}
                                              value={equipmentDraft?.minutes ?? minutesVal ?? ''}
                                              onChange={(e) => setEquipmentDraft((p) => ({ ...p, minutes: e.target.value === '' ? '' : Number(e.target.value) }))}
                                              placeholder="Min"
                                              className="border border-gray-300 rounded-lg px-2 py-1 w-16 sm:w-20 text-xs sm:text-sm"
                                              title="Duration (minutes)"
                                            />
                                            <button type="button" onClick={handleEquipmentSave} className="ml-1 px-2 py-1 rounded-lg bg-primary text-white text-xs shrink-0">Save</button>
                                            <button type="button" onClick={() => { setEquipmentEdit(null); setEquipmentDraft(null); setEquipmentDropdownOpen(null); }} className="ml-1 px-2 py-1 rounded-lg border border-gray-300 text-xs shrink-0">Cancel</button>
                                          </>
                                        ) : (
                                          <>
                                            <span className="text-muted text-xs sm:text-sm">{minutesVal != null && minutesVal !== '' ? `${minutesVal} min` : '—'}</span>
                                          </>
                                        )}
                                        </td>
                                        <td className="py-2 px-2">
                                          <input
                                            type="checkbox"
                                            checked={!!item.isPipelineStagger}
                                            onChange={(e) => {
                                              updateEquipmentItemInProfile(line.id, proc.id, selectedProfileId, item.id, { isPipelineStagger: e.target.checked });
                                              setLinesState(getLines());
                                            }}
                                            disabled={equipmentEdit?.lineId === line.id && equipmentEdit?.sectionId === proc.id && equipmentEdit?.itemId === item.id}
                                            title="When enabled, pipelined batching uses the cumulative minutes up to this step as the stagger."
                                          />
                                        </td>
                                        <td className="py-2 px-2">
                                        {selectedLineId === line.id && !(equipmentEdit?.lineId === line.id && equipmentEdit?.sectionId === proc.id && equipmentEdit?.itemId === item.id) && (
                                          <>
                                            <button type="button" onClick={() => { setEquipmentEdit({ lineId: line.id, sectionId: proc.id, itemId: item.id }); setEquipmentDraft({ name: item.name, machineId: item.id, minutes: minutesVal ?? '' }); }} className="p-1 rounded-lg border border-gray-300 hover:bg-gray-100" aria-label="Edit"><Pencil className="w-4 h-4 inline" /></button>
                                            <button type="button" onClick={() => handleEquipmentDelete(line.id, proc.id, selectedProfileId, item.id)} className="ml-1 p-1 rounded-lg border border-gray-300 hover:bg-red-50 text-red-600" aria-label="Delete"><Trash2 className="w-4 h-4 inline" /></button>
                                          </>
                                        )}
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                              </table>
                              </div>
                                  </div>
                                </section>

                                <section className="border border-gray-200 rounded-lg bg-surface-card overflow-hidden min-w-0 text-xs sm:text-sm md:text-sm lg:text-base xl:text-base 2xl:text-lg flex flex-col min-h-0">
                                  <div className="p-2 sm:p-3 border-b border-gray-200 bg-surface-card-warm shrink-0">
                                    <h4 className="font-semibold text-gray-800 text-inherit">Process times</h4>
                                    <p className="text-muted mt-0.5 text-[0.65rem] sm:text-xs md:text-xs">Add process time steps (e.g. Gap, Bench Floor Time). Click Edit to change.</p>
                                  </div>
                                  <div className="p-3 sm:p-4 text-inherit">
                              {(() => {
                                const processTimes = getProcessTimesForProfile(line.id, proc.id, selectedProfileId);
                                const isEditingPt = processTimeEdit?.lineId === line.id && processTimeEdit?.processId === proc.id;
                                return (
                                  <>
                                    {processTimeDuplicateNameError && (
                                      <p className="text-xs text-red-600 mb-2">A process time with this name already exists in this profile. Use a different name (e.g. Gap 2).</p>
                                    )}
                                    <div className="overflow-x-auto min-w-0">
                                    <table className="w-full border-collapse text-inherit">
                                      <thead>
                                        <tr className="border-b border-gray-200">
                                          <th className="text-left py-2 px-2 font-semibold text-gray-800 whitespace-nowrap text-[0.7rem] sm:text-xs lg:text-sm">Sequence</th>
                                          <th className="text-left py-2 px-2 font-semibold text-gray-800 text-[0.7rem] sm:text-xs lg:text-sm">Process time name</th>
                                          <th className="text-left py-2 px-2 font-semibold text-gray-800 whitespace-nowrap text-[0.7rem] sm:text-xs lg:text-sm">Duration</th>
                                          <th className="text-left py-2 px-2 font-semibold text-gray-800 whitespace-nowrap text-[0.7rem] sm:text-xs lg:text-sm">
                                            <Tooltip.Provider delayDuration={200}>
                                              <Tooltip.Root>
                                                <Tooltip.Trigger asChild>
                                                  <span className="inline-flex items-center gap-1 cursor-help">
                                                    Pipeline <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-gray-300 text-[0.65rem] leading-none text-gray-700">?</span>
                                                  </span>
                                                </Tooltip.Trigger>
                                                <Tooltip.Portal>
                                                  <Tooltip.Content side="top" sideOffset={6} className="z-50 max-w-[90vw] rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg text-gray-900 text-xs sm:text-sm">
                                                    {pipelineHelpText}
                                                  </Tooltip.Content>
                                                </Tooltip.Portal>
                                              </Tooltip.Root>
                                            </Tooltip.Provider>
                                          </th>
                                          <th className="text-left py-2 px-2 w-24 sm:w-28 font-semibold text-gray-800 text-[0.7rem] sm:text-xs lg:text-sm">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                    {selectedLineId === line.id && selectedProfileId && (
                                      <tr className="border-b border-gray-200 bg-gray-50/80">
                                        <td className="py-2 px-2 text-xs text-muted">—</td>
                                        <td className="py-2 px-2">
                                          <input
                                            type="text"
                                            value={processTimeEdit?.processTimeId ? '' : newProcessTimeName}
                                            onChange={(e) => { setNewProcessTimeName(e.target.value); setProcessTimeDuplicateNameError(false); }}
                                            placeholder="e.g. Gap"
                                            className="border border-gray-300 rounded-lg px-2 py-1.5 w-full min-w-0 text-xs sm:text-sm md:text-base lg:text-base 2xl:text-lg"
                                            style={{ minWidth: 'clamp(4rem, 18vw, 14rem)', maxWidth: '100%' }}
                                            disabled={!!processTimeEdit?.processTimeId}
                                          />
                                        </td>
                                        <td className="py-2 px-2">
                                          <input
                                            type="number"
                                            min={0}
                                            value={processTimeEdit?.processTimeId ? '' : newProcessTimeMinutes}
                                            onChange={(e) => setNewProcessTimeMinutes(e.target.value)}
                                            placeholder="mins."
                                            className="border border-gray-300 rounded-lg px-2 py-1.5 w-20 text-xs sm:text-sm"
                                            disabled={!!processTimeEdit?.processTimeId}
                                          />
                                        </td>
                                        <td className="py-2 px-2">
                                          <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-700">
                                            <input
                                              type="checkbox"
                                              checked={!!newProcessTimeIsPipelineStagger}
                                              onChange={(e) => setNewProcessTimeIsPipelineStagger(e.target.checked)}
                                              disabled={!!processTimeEdit?.processTimeId}
                                            />
                                          </label>
                                        </td>
                                        <td className="py-2 px-2">
                                          <button
                                            type="button"
                                            disabled={!newProcessTimeName.trim()}
                                            onClick={() => {
                                              setProcessTimeDuplicateNameError(false);
                                              const res = addProcessTimeToProfile(line.id, proc.id, selectedProfileId, {
                                                name: newProcessTimeName.trim(),
                                                minutes: newProcessTimeMinutes === '' || Number.isNaN(Number(newProcessTimeMinutes)) ? 0 : Number(newProcessTimeMinutes),
                                                isPipelineStagger: !!newProcessTimeIsPipelineStagger,
                                              });
                                              if (res?.duplicateName) { setProcessTimeDuplicateNameError(true); return; }
                                              setLinesState(getLines());
                                              setNewProcessTimeName('');
                                              setNewProcessTimeMinutes('');
                                              setNewProcessTimeIsPipelineStagger(false);
                                            }}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs sm:text-sm font-medium shrink-0 disabled:opacity-50"
                                          >
                                            <Plus className="w-4 h-4 inline" /> Add
                                          </button>
                                        </td>
                                      </tr>
                                    )}
                                    {processTimes.map((pt) => (
                                      <tr key={pt.id} className="border-b border-gray-100">
                                        <td className="py-2 px-2">
                                          <input
                                            type="number"
                                            min={1}
                                            value={pt.order ?? ''}
                                            onChange={(e) => {
                                              setStepOrderDuplicateError(null);
                                              const nextOrder = e.target.value === '' ? null : Number(e.target.value);
                                              if (nextOrder != null && !Number.isNaN(Number(nextOrder))) {
                                                const eq = getEquipmentForProfile(line.id, proc.id, selectedProfileId);
                                                const pts = getProcessTimesForProfile(line.id, proc.id, selectedProfileId);
                                                const used = new Set([
                                                  ...eq.map((x) => Number(x.order)).filter((n) => !Number.isNaN(n) && n != null),
                                                  ...pts.filter((x) => x.id !== pt.id).map((x) => Number(x.order)).filter((n) => !Number.isNaN(n) && n != null),
                                                ]);
                                                if (used.has(Number(nextOrder))) {
                                                  setStepOrderDuplicateError(`Order #${Number(nextOrder)} is already used in this profile. Choose a unique number across Machines/Equipment and Process times.`);
                                                  return;
                                                }
                                              }
                                              updateProcessTimeInProfile(line.id, proc.id, selectedProfileId, pt.id, { order: nextOrder });
                                              setLinesState(getLines());
                                            }}
                                            className="border border-gray-300 rounded-lg px-2 py-1 w-16 text-xs sm:text-sm"
                                            title="Step order (sequence number)"
                                          />
                                        </td>
                                        <td className="py-2 px-2">
                                          {isEditingPt && processTimeEdit?.processTimeId === pt.id && processTimeDraft ? (
                                            <input
                                              type="text"
                                              value={processTimeDraft.name}
                                              onChange={(e) => { setProcessTimeDraft((p) => (p ? { ...p, name: e.target.value } : { name: e.target.value, minutes: 0, isPipelineStagger: false })); setProcessTimeDuplicateNameError(false); }}
                                              className="border border-gray-300 rounded-lg px-2 py-1 text-xs sm:text-sm min-w-[140px]"
                                              placeholder="Name"
                                            />
                                          ) : (
                                            <span className="text-gray-800 font-medium text-xs sm:text-sm">{pt.name}</span>
                                          )}
                                        </td>
                                        <td className="py-2 px-2">
                                          {isEditingPt && processTimeEdit?.processTimeId === pt.id && processTimeDraft ? (
                                            <>
                                              <input
                                                type="number"
                                                min={0}
                                                value={processTimeDraft.minutes ?? ''}
                                                onChange={(e) => setProcessTimeDraft((p) => (p ? { ...p, minutes: e.target.value === '' ? '' : Number(e.target.value) } : { name: '', minutes: e.target.value }))}
                                                className="border border-gray-300 rounded-lg px-2 py-1 w-16 sm:w-20 text-xs sm:text-sm"
                                                placeholder="Min"
                                              />
                                              <span className="text-xs sm:text-sm text-muted ml-1">min</span>
                                            </>
                                          ) : (
                                            <span className="text-xs sm:text-sm text-muted">{pt.minutes} min</span>
                                          )}
                                        </td>
                                        <td className="py-2 px-2">
                                          <input
                                            type="checkbox"
                                            checked={!!pt.isPipelineStagger}
                                            onChange={(e) => {
                                              updateProcessTimeInProfile(line.id, proc.id, selectedProfileId, pt.id, { isPipelineStagger: e.target.checked });
                                              setLinesState(getLines());
                                            }}
                                            disabled={isEditingPt && processTimeEdit?.processTimeId === pt.id}
                                            title="When enabled, this process time's minutes will be used as the stagger for pipelined batching on this line."
                                          />
                                        </td>
                                        <td className="py-2 px-2">
                                          {isEditingPt && processTimeEdit?.processTimeId === pt.id && processTimeDraft ? (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const res = updateProcessTimeInProfile(line.id, proc.id, selectedProfileId, pt.id, { name: processTimeDraft.name, minutes: processTimeDraft.minutes, isPipelineStagger: !!processTimeDraft.isPipelineStagger });
                                                  if (res?.duplicateName) { setProcessTimeDuplicateNameError(true); return; }
                                                  setProcessTimeDuplicateNameError(false);
                                                  setLinesState(getLines());
                                                  setProcessTimeEdit(null);
                                                  setProcessTimeDraft(null);
                                                }}
                                                className="px-2 py-1 rounded-lg bg-primary text-white text-xs shrink-0"
                                              >
                                                Save
                                              </button>
                                              <button type="button" onClick={() => { setProcessTimeEdit(null); setProcessTimeDraft(null); setProcessTimeDuplicateNameError(false); }} className="ml-1 px-2 py-1 rounded-lg border border-gray-300 text-xs shrink-0">Cancel</button>
                                            </>
                                          ) : (
                                            selectedLineId === line.id && (
                                              <>
                                                <button type="button" onClick={() => { setProcessTimeEdit({ lineId: line.id, processId: proc.id, processTimeId: pt.id }); setProcessTimeDraft({ name: pt.name, minutes: pt.minutes, isPipelineStagger: !!pt.isPipelineStagger }); setProcessTimeDuplicateNameError(false); }} className="p-1 rounded-lg border border-gray-300 hover:bg-gray-100" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
                                                <button type="button" onClick={() => { deleteProcessTimeFromProfile(line.id, proc.id, selectedProfileId, pt.id); setLinesState(getLines()); }} className="ml-1 p-1 rounded-lg border border-gray-300 hover:bg-red-50 text-red-600" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                                              </>
                                            )
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                      </tbody>
                                    </table>
                                    </div>
                                  </>
                                );
                              })()}
                                  </div>
                                </section>
                              </div>
                              <section className="border border-gray-200 rounded-lg bg-surface-card mt-4 p-3 sm:p-4 min-w-0 text-xs sm:text-sm md:text-base">
                                <h4 className="font-semibold text-gray-800 text-inherit">Complex Process times</h4>
                                <p className="text-muted mt-1 text-[0.65rem] sm:text-xs md:text-sm">
                                  Complex process times like Packaging derived from strokes, capacity per hour and batch quantity or Baking&apos;s Rack Loading per rack and quantity per rack would be included in actual development below this section.
                                </p>
                                <p className="mt-2 text-xs sm:text-sm font-medium text-gray-700">Coming soon. Not included in demo</p>
                              </section>
                              </section>
                              ) : (
                                <p className="text-xs sm:text-sm text-muted mt-4">Select or add a mixing profile above to edit machines and process times.</p>
                              )}
                            </Tabs.Content>
                          );
                        })}
                      </Tabs.Root>
                    );
                  })()}
                    </div>
                  </div>
                </>
              )}
            </Tabs.Content>
          ))}
        </Tabs.Root>
      )}
      </div>
        </Tabs.Content>

        <Tabs.Content value="machines" className="mt-0 rounded-b-card border border-gray-200 border-t-0 bg-surface-card min-w-0">
          <MachinesTabContent activeTab={activeMainTab} />
        </Tabs.Content>
      </Tabs.Root>

      <Dialog.Root open={tagModalOpen} onOpenChange={setTagModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-lg">
            <Dialog.Title className="text-base sm:text-lg font-semibold text-gray-900">Add tag</Dialog.Title>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">Tags can be assigned to process profiles for organization and filtering.</p>
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">Tag name</label>
              <input
                type="text"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                placeholder="e.g. EB, WWL, Raisin"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button type="button" className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={() => {
                  const trimmed = tagDraft.trim();
                  if (!trimmed || !tagTarget) return;
                  setTagForMixingProfile(tagTarget.lineId, tagTarget.processId, tagTarget.profileId, trimmed);
                  setLinesState(getLines());
                  setTagModalOpen(false);
                  setTagDraft('');
                  setTagTarget(null);
                }}
                disabled={!tagDraft.trim() || !tagTarget}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
              >
                Save tag
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
