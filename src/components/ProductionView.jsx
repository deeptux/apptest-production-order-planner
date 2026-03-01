import { useState, useCallback, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, Check, X, Search } from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';
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
} from '../store/productionLinesStore';
import { getRecipes } from '../store/recipeStore';
import { getMachines, addMachine, updateMachine, deleteMachine, getMachinesForLineAndProcess } from '../store/machinesStore';

function MachinesTabContent({ activeTab }) {
  const [machines, setMachinesState] = useState(() => getMachines());
  const [machineSearch, setMachineSearch] = useState('');
  useEffect(() => {
    if (activeTab === 'machines') setMachinesState(getMachines());
  }, [activeTab]);
  const [newName, setNewName] = useState('');
  const [newProductionLineId, setNewProductionLineId] = useState('');
  const [newProcessId, setNewProcessId] = useState('');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editProductionLineId, setEditProductionLineId] = useState('');
  const [editProcessId, setEditProcessId] = useState('');
  const lines = getLines();
  const refresh = useCallback(() => setMachinesState(getMachines()), []);
  const handleAdd = useCallback(() => {
    if (!newName.trim()) return;
    addMachine({
      name: newName.trim(),
      productionLineId: newProductionLineId || null,
      processId: newProcessId || null,
    });
    setNewName('');
    setNewProductionLineId('');
    setNewProcessId('');
    refresh();
  }, [newName, newProductionLineId, newProcessId, refresh]);
  const handleSave = useCallback(() => {
    if (!editId || !editName.trim()) return;
    updateMachine(editId, {
      name: editName.trim(),
      productionLineId: editProductionLineId || null,
      processId: editProcessId || null,
    });
    setEditId(null);
    setEditName('');
    setEditProductionLineId('');
    setEditProcessId('');
    refresh();
  }, [editId, editName, editProductionLineId, editProcessId, refresh]);
  const handleDelete = useCallback((id) => {
    if (!window.confirm('Remove this machine/equipment from the list?')) return;
    deleteMachine(id);
    refresh();
  }, [refresh]);
  const lineName = (id) => (id ? (getLineById(id)?.name ?? id) : '—');
  const processName = (lineId, processId) => {
    if (!lineId || !processId) return '—';
    const procs = getProcessesForLine(lineId);
    return procs.find((p) => p.id === processId)?.name ?? '—';
  };
  const searchLower = machineSearch.trim().toLowerCase();
  const filteredMachines = searchLower
    ? machines.filter((m) => m.name.toLowerCase().includes(searchLower))
    : machines;

  return (
    <div className="p-3 sm:p-4 flex flex-col min-h-0">
      <p className="text-xs sm:text-sm 2xl:text-base text-muted mb-4">
        Assign machines to a production line and process (optional). When assigned, they appear under that line’s process in the Production tab.
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
        </div>
        <div className="overflow-auto min-h-0 border border-gray-200 rounded-lg" style={{ maxHeight: 'min(60vh, 480px)' }}>
          <table className="w-full border-collapse text-xs sm:text-sm md:text-base 2xl:text-lg min-w-[320px]">
            <thead className="sticky top-0 z-10 bg-surface-card-warm shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-700 whitespace-nowrap bg-surface-card-warm">Machine / equipment</th>
                <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-700 whitespace-nowrap bg-surface-card-warm">Production Line</th>
                <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-700 whitespace-nowrap bg-surface-card-warm">Process Line</th>
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
                <select
                  value={newProductionLineId}
                  onChange={(e) => { setNewProductionLineId(e.target.value); setNewProcessId(''); }}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-inherit max-w-[180px]"
                >
                  <option value="">—</option>
                  {lines.map((line) => (
                    <option key={line.id} value={line.id}>{line.name}</option>
                  ))}
                </select>
              </td>
              <td className="py-2 sm:py-2.5 px-3 sm:px-4">
                <select
                  value={newProcessId}
                  onChange={(e) => setNewProcessId(e.target.value)}
                  disabled={!newProductionLineId}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-inherit max-w-[180px] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">—</option>
                  {newProductionLineId ? getProcessesForLine(newProductionLineId).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  )) : null}
                </select>
              </td>
              <td className="py-2 sm:py-2.5 px-3 sm:px-4">
                <button type="button" onClick={handleAdd} disabled={!newName.trim()} className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-primary text-white text-xs sm:text-sm font-medium disabled:opacity-50">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </td>
            </tr>
            {filteredMachines.map((m) => {
              const procsForEdit = editProductionLineId ? getProcessesForLine(editProductionLineId) : [];
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
                      <select
                        value={editProductionLineId}
                        onChange={(e) => { setEditProductionLineId(e.target.value); setEditProcessId(''); }}
                        className="border border-gray-300 rounded-lg px-2 py-1 text-inherit max-w-[180px]"
                      >
                        <option value="">—</option>
                        {lines.map((line) => (
                          <option key={line.id} value={line.id}>{line.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 sm:py-2.5 px-3 sm:px-4">
                      <select
                        value={editProcessId}
                        onChange={(e) => setEditProcessId(e.target.value)}
                        disabled={!editProductionLineId}
                        className="border border-gray-300 rounded-lg px-2 py-1 text-inherit max-w-[180px] disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <option value="">—</option>
                        {procsForEdit.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 sm:py-2.5 px-3 sm:px-4">
                      <div className="flex gap-1">
                        <button type="button" onClick={handleSave} className="px-2 py-1 rounded-lg bg-primary text-white text-xs font-medium">Save</button>
                        <button type="button" onClick={() => { setEditId(null); setEditName(''); setEditProductionLineId(''); setEditProcessId(''); }} className="px-2 py-1 rounded-lg border border-gray-300 text-xs font-medium">Cancel</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2 sm:py-2.5 px-3 sm:px-4 text-gray-800">{m.name}</td>
                    <td className="py-2 sm:py-2.5 px-3 sm:px-4 text-gray-600">{lineName(m.productionLineId)}</td>
                    <td className="py-2 sm:py-2.5 px-3 sm:px-4 text-gray-600">{processName(m.productionLineId, m.processId)}</td>
                    <td className="py-2 sm:py-2.5 px-3 sm:px-4">
                      <div className="flex gap-1">
                        <button type="button" onClick={() => { setEditId(m.id); setEditName(m.name); setEditProductionLineId(m.productionLineId || ''); setEditProcessId(m.processId || ''); }} className="p-1 rounded-lg border border-gray-300 hover:bg-gray-100" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
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
  const [selectedMachineId, setSelectedMachineId] = useState({}); // key: `${line.id}-${proc.id}` -> machineId for dropdown
  const [equipmentDropdownOpen, setEquipmentDropdownOpen] = useState(null); // null | { type: 'add', key } | { type: 'edit', lineId, sectionId, itemId }
  const [equipmentDropdownSearch, setEquipmentDropdownSearch] = useState('');
  const equipmentDropdownRef = useRef(null);
  const [machinesVersion, setMachinesVersion] = useState(0); // bump to re-read machines after assign/unassign
  const [newLineName, setNewLineName] = useState('');
  const [lineEditId, setLineEditId] = useState(null);
  const [lineEditName, setLineEditName] = useState('');
  const [newProcessName, setNewProcessName] = useState('');
  const [processEditId, setProcessEditId] = useState(null);
  const [processEditName, setProcessEditName] = useState('');
  const [activeMainTab, setActiveMainTab] = useState('production');

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
  useEffect(() => {
    if (!equipmentDropdownOpen) return;
    const onMouseDown = (e) => {
      if (equipmentDropdownRef.current && !equipmentDropdownRef.current.contains(e.target)) {
        setEquipmentDropdownOpen(null);
      }
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
    });
    refreshCapacity();
    setNewCapacityName('');
    setNewCapacityProduct('');
    setNewCapacityValue('');
  }, [selectedLineId, newCapacityName, newCapacityProduct, newCapacityValue, refreshCapacity]);

  const handleCapacityDelete = useCallback((entryId) => {
    if (!selectedLineId) return;
    deleteCapacityEntryForLine(selectedLineId, entryId);
    refreshCapacity();
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
    updateMachine(itemId, { productionLineId: null, processId: null });
    if (equipmentDraft.machineId) {
      updateMachine(equipmentDraft.machineId, { productionLineId: lineId, processId });
    }
    setEquipmentEdit(null);
    setEquipmentDraft(null);
    refreshMachines();
  }, [equipmentEdit, equipmentDraft, refreshMachines]);

  const handleEquipmentAdd = useCallback((lineId, processId) => {
    const key = `${lineId}-${processId}`;
    const machineId = selectedMachineId[key];
    if (!machineId) return;
    updateMachine(machineId, { productionLineId: lineId, processId });
    setSelectedMachineId((p) => ({ ...p, [key]: '' }));
    refreshMachines();
  }, [selectedMachineId, refreshMachines]);

  const handleEquipmentDelete = useCallback((lineId, processId, machineId) => {
    updateMachine(machineId, { productionLineId: null, processId: null });
    refreshMachines();
  }, [refreshMachines]);

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-6 max-w-[1600px] xl:max-w-[1920px] 2xl:max-w-[2200px] mx-auto w-full min-w-0">
      <Tabs.Root value={activeMainTab} onValueChange={setActiveMainTab} className="w-full min-w-0">
        <Tabs.List className="flex gap-1 border-b border-gray-200 bg-surface-card-warm rounded-t-card overflow-x-auto pt-2 px-2 min-w-0 mb-4">
          <Tabs.Trigger
            value="production"
            className="px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm md:text-base font-medium rounded-t-lg transition-colors shrink-0 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=inactive]:text-gray-700 data-[state=inactive]:hover:bg-gray-200/50"
          >
            Production
          </Tabs.Trigger>
          <Tabs.Trigger
            value="machines"
            className="px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm md:text-base font-medium rounded-t-lg transition-colors shrink-0 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=inactive]:text-gray-700 data-[state=inactive]:hover:bg-gray-200/50"
          >
            Machines
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="production" className="mt-0 rounded-b-card border border-gray-200 border-t-0 min-w-0">
      <p className="text-xs sm:text-sm 2xl:text-base text-muted m-3 ml-5">
        Capacity profile and machines/equipment per production line. Each line has its own capacity entries and process structure.
      </p>

      {/* Add production line */}
      <div className="flex flex-wrap gap-2 items-center m-5">
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

      {lines.length === 0 ? (
        <p className="text-xs sm:text-sm 2xl:text-base text-muted">Add a production line above.</p>
      ) : (
        <Tabs.Root value={selectedLineId} onValueChange={selectLine} className="w-full min-w-0">
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
            <Tabs.Content key={line.id} value={line.id} className="mt-0 rounded-b-card border border-gray-200 border-t-0 bg-surface-card min-w-0">
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
                    <h3 className="p-2 sm:p-3 border-b border-gray-200 bg-surface-card-warm text-xs sm:text-sm md:text-base 2xl:text-lg font-semibold text-gray-800">
                      Capacity profile ({line.name})
                    </h3>
                    <div className="p-3 sm:p-4 overflow-x-auto min-w-0">
                      <table className="w-full border-collapse text-xs sm:text-sm md:text-base 2xl:text-lg min-w-[320px]">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-700 whitespace-nowrap">Capacity Name</th>
                            <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-700 whitespace-nowrap">Product</th>
                            <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-700 whitespace-nowrap">Capacity</th>
                            <th className="text-left py-2 sm:py-3 px-3 sm:px-4 w-20 sm:w-24 whitespace-nowrap">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedLineId === line.id ? capacityProfile : getCapacityProfileForLine(line.id)).map((entry) => {
                            const isEditing = selectedLineId === line.id && capacityEditId === entry.id;
                            const e = isEditing && capacityDraft ? capacityDraft : entry;
                            return (
                              <tr key={entry.id} className="border-b border-gray-100">
                                <td className="py-2 sm:py-2.5 px-3 sm:px-4">
                                  <input
                                    type="text"
                                    value={e.capacityName}
                                    onChange={(ev) => setCapacityDraft((p) => p ? { ...p, capacityName: ev.target.value } : { ...entry, capacityName: ev.target.value })}
                                    disabled={!isEditing}
                                    className="border border-gray-300 rounded-lg px-2 py-1 w-full max-w-[120px] sm:max-w-[140px] text-inherit disabled:bg-gray-50 disabled:cursor-not-allowed"
                                  />
                                </td>
                                <td className="py-2 sm:py-2.5 px-3 sm:px-4">
                                  {isEditing ? (
                                    <select
                                      value={e.productName}
                                      onChange={(ev) => setCapacityDraft((p) => p ? { ...p, productName: ev.target.value } : { ...entry, productName: ev.target.value })}
                                      className="border border-gray-300 rounded-lg px-2 py-1 max-w-[140px] sm:max-w-[180px] text-inherit"
                                    >
                                      <option value="">— Select product —</option>
                                      {recipes.map((r) => (
                                        <option key={r.id} value={r.name}>{r.name}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="text-gray-800">{e.productName || '—'}</span>
                                  )}
                                </td>
                                <td className="py-2 sm:py-2.5 px-3 sm:px-4">
                                  <input
                                    type="number"
                                    value={e.capacity}
                                    onChange={(ev) => setCapacityDraft((p) => p ? { ...p, capacity: Number(ev.target.value) || 0 } : { ...entry, capacity: Number(ev.target.value) || 0 })}
                                    disabled={!isEditing}
                                    className="border border-gray-300 rounded-lg px-2 py-1 w-20 sm:w-24 text-inherit disabled:bg-gray-50 disabled:cursor-not-allowed"
                                  />
                                </td>
                                <td className="py-2 sm:py-2.5 px-3 sm:px-4">
                                  {isEditing ? (
                                    <div className="flex flex-wrap gap-1">
                                      <button type="button" onClick={handleCapacitySave} className="px-2 py-1 rounded-lg bg-primary text-white text-xs font-medium">Save</button>
                                      <button type="button" onClick={() => { setCapacityEditId(null); setCapacityDraft(null); }} className="px-2 py-1 rounded-lg border border-gray-300 text-xs font-medium">Cancel</button>
                                    </div>
                                  ) : selectedLineId === line.id ? (
                                    <div className="flex gap-1">
                                      <button type="button" onClick={() => { setCapacityEditId(entry.id); setCapacityDraft({ ...entry }); }} className="p-1 rounded-lg border border-gray-300 hover:bg-gray-100" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
                                      <button type="button" onClick={() => handleCapacityDelete(entry.id)} className="p-1 rounded-lg border border-gray-300 hover:bg-red-50 text-red-600" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                  ) : null}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {selectedLineId === line.id && (
                        <div className="flex flex-wrap gap-2 mt-3 items-center">
                          <input
                            type="text"
                            value={newCapacityName}
                            onChange={(e) => setNewCapacityName(e.target.value)}
                            placeholder="Capacity name (e.g. 8s)"
                            className="border border-gray-300 rounded-lg px-2 py-1.5 sm:py-2 text-xs sm:text-sm w-28 sm:w-32"
                          />
                          <select
                            value={newCapacityProduct}
                            onChange={(e) => setNewCapacityProduct(e.target.value)}
                            className="border border-gray-300 rounded-lg px-2 py-1.5 sm:py-2 text-xs sm:text-sm max-w-[160px] sm:max-w-[200px]"
                          >
                            <option value="">— Select product —</option>
                            {recipes.map((r) => (
                              <option key={r.id} value={r.name}>{r.name}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            value={newCapacityValue}
                            onChange={(e) => setNewCapacityValue(e.target.value)}
                            placeholder="Capacity"
                            className="border border-gray-300 rounded-lg px-2 py-1.5 sm:py-2 text-xs sm:text-sm w-20 sm:w-28"
                          />
                          <button type="button" onClick={handleCapacityAdd} disabled={!newCapacityName.trim()} className="inline-flex items-center gap-1 px-3 py-1.5 sm:py-2 rounded-lg bg-primary text-white text-xs sm:text-sm font-medium disabled:opacity-50 shrink-0">
                            <Plus className="w-4 h-4 inline" /> Add
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Process line + Machines/Equipment */}
                  <div>
                    <h3 className="p-2 sm:p-3 border-b border-gray-200 bg-surface-card-warm text-xs sm:text-sm md:text-base 2xl:text-lg font-semibold text-gray-800">
                      Process line — {line.name}
                    </h3>
                    <div className="p-3 sm:p-4">
                      {selectedLineId === line.id && (
                        <div className="flex flex-wrap gap-2 items-center mb-3 sm:mb-4">
                          <input
                            type="text"
                            value={newProcessName}
                            onChange={(e) => setNewProcessName(e.target.value)}
                            placeholder="Process name (e.g. Mixing)"
                            className="border border-gray-300 rounded-lg px-2 py-1.5 sm:py-2 text-xs sm:text-sm w-full min-w-0 sm:w-40"
                          />
                          <button type="button" onClick={handleAddProcess} disabled={!newProcessName.trim()} className="inline-flex items-center gap-1 px-3 py-1.5 sm:py-2 rounded-lg bg-primary text-white text-xs sm:text-sm font-medium disabled:opacity-50 shrink-0">
                            <Plus className="w-4 h-4 inline" /> Add process
                          </button>
                        </div>
                      )}
                  {(() => {
                    const procs = getProcessesForLine(line.id);
                    if (procs.length === 0) return <p className="text-xs sm:text-sm 2xl:text-base text-muted">No processes yet. Add a process above.</p>;
                    return (
                      <Tabs.Root defaultValue={procs[0]?.id} key={`${line.id}-process`} className="w-full min-w-0">
                        <Tabs.List className="flex gap-1 border-b border-gray-200 bg-gray-50 px-2 pt-2 overflow-x-auto min-w-0">
                          {procs.map((proc) => (
                            <Tabs.Trigger
                              key={proc.id}
                              value={proc.id}
                              className="px-3 py-2 sm:py-2.5 text-xs sm:text-sm md:text-base font-medium rounded-t-lg shrink-0 transition-colors data-[state=active]:bg-white data-[state=active]:border data-[state=active]:border-b-0 data-[state=active]:border-gray-200 data-[state=inactive]:text-gray-600"
                            >
                              {proc.name}
                            </Tabs.Trigger>
                          ))}
                        </Tabs.List>
                        {procs.map((proc) => {
                          const equipment = getMachinesForLineAndProcess(line.id, proc.id);
                          const key = `${line.id}-${proc.id}`;
                          const selectedId = selectedMachineId[key] ?? '';
                          const isEditingProcess = selectedLineId === line.id && processEditId === proc.id;
                          return (
                            <Tabs.Content key={proc.id} value={proc.id} className="p-3 sm:p-4 border border-gray-200 border-t-0 rounded-b-lg">
                              <div className="flex flex-wrap gap-2 items-center mb-7">
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
                              <p className="text-xs sm:text-sm text-muted mb-2 mt-7 font-extrabold">Machines / equipment</p>
                              <ul className="list-disc list-inside space-y-2 pl-4">
                                {equipment.map((item) => {
                                  const isEditing = equipmentEdit?.lineId === line.id && equipmentEdit?.sectionId === proc.id && equipmentEdit?.itemId === item.id;
                                  const name = isEditing && equipmentDraft ? equipmentDraft.name : item.name;
                                  const selectedMachineIdForEdit = isEditing && equipmentDraft ? (equipmentDraft.machineId ?? '') : '';
                                  return (
                                    <li key={item.id} className="flex flex-wrap items-center gap-2 py-1">
                                      {isEditing ? (
                                        <>
                                          <div
                                            ref={equipmentDropdownOpen?.type === 'edit' && equipmentDropdownOpen.itemId === item.id ? equipmentDropdownRef : null}
                                            className="relative flex-1 min-w-0 max-w-xs"
                                          >
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEquipmentDropdownOpen({ type: 'edit', lineId: line.id, sectionId: proc.id, itemId: item.id });
                                                setEquipmentDropdownSearch('');
                                              }}
                                              className="w-full text-left border border-gray-300 rounded-lg px-2 py-1 flex-1 min-w-0 text-xs sm:text-sm bg-white"
                                            >
                                              {selectedMachineIdForEdit ? machinesList.find((x) => x.id === selectedMachineIdForEdit)?.name ?? '—' : '— Select machine / equipment —'}
                                            </button>
                                            {equipmentDropdownOpen?.type === 'edit' && equipmentDropdownOpen.lineId === line.id && equipmentDropdownOpen.sectionId === proc.id && equipmentDropdownOpen.itemId === item.id && (
                                              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-gray-300 rounded-lg shadow-lg py-2 min-w-[200px]">
                                                <div className="px-2 pb-2">
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
                                                <ul className="max-h-48 overflow-auto text-xs sm:text-sm">
                                                  {machinesFilteredForDropdown.map((machine) => (
                                                    <li
                                                      key={machine.id}
                                                      onClick={() => {
                                                        setEquipmentDraft((p) => (p ? { ...p, name: machine.name, machineId: machine.id } : { name: machine.name, machineId: machine.id }));
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
                                              </div>
                                            )}
                                          </div>
                                          <button type="button" onClick={handleEquipmentSave} className="px-2 py-1 rounded-lg bg-primary text-white text-xs shrink-0">Save</button>
                                          <button type="button" onClick={() => { setEquipmentEdit(null); setEquipmentDraft(null); setEquipmentDropdownOpen(null); }} className="px-2 py-1 rounded-lg border border-gray-300 text-xs shrink-0">Cancel</button>
                                        </>
                                      ) : (
                                        <>
                                          <span className="text-gray-800 text-xs sm:text-sm">{item.name}</span>
                                          {selectedLineId === line.id && (
                                            <>
                                              <button type="button" onClick={() => { setEquipmentEdit({ lineId: line.id, sectionId: proc.id, itemId: item.id }); setEquipmentDraft({ name: item.name, machineId: item.id }); }} className="p-1 rounded-lg border border-gray-300 hover:bg-gray-100" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
                                              <button type="button" onClick={() => handleEquipmentDelete(line.id, proc.id, item.id)} className="p-1 rounded-lg border border-gray-300 hover:bg-red-50 text-red-600" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                                            </>
                                          )}
                                        </>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                              {selectedLineId === line.id && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                  <div
                                    ref={equipmentDropdownOpen?.type === 'add' && equipmentDropdownOpen.key === key ? equipmentDropdownRef : null}
                                    className="relative flex-1 min-w-0 max-w-xs"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEquipmentDropdownOpen({ type: 'add', key });
                                        setEquipmentDropdownSearch('');
                                      }}
                                      className="w-full text-left border border-gray-300 rounded-lg px-2 py-1.5 flex-1 min-w-0 text-xs sm:text-sm bg-white"
                                    >
                                      {selectedId ? machinesList.find((x) => x.id === selectedId)?.name ?? '—' : '— Select machine / equipment —'}
                                    </button>
                                    {equipmentDropdownOpen?.type === 'add' && equipmentDropdownOpen.key === key && (
                                      <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-gray-300 rounded-lg shadow-lg py-2 min-w-[200px]">
                                        <div className="px-2 pb-2">
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
                                        <ul className="max-h-48 overflow-auto text-xs sm:text-sm">
                                          {machinesFilteredForDropdown.map((machine) => (
                                            <li
                                              key={machine.id}
                                              onClick={() => {
                                                setSelectedMachineId((p) => ({ ...p, [key]: machine.id }));
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
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleEquipmentAdd(line.id, proc.id)}
                                    disabled={!selectedId}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs sm:text-sm font-medium shrink-0 disabled:opacity-50"
                                  >
                                    <Plus className="w-4 h-4 inline" /> Add
                                  </button>
                                </div>
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
        </Tabs.Content>

        <Tabs.Content value="machines" className="mt-0 rounded-b-card border border-gray-200 border-t-0 bg-surface-card min-w-0">
          <MachinesTabContent activeTab={activeMainTab} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
