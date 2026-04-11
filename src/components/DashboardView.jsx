import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Tabs from '@radix-ui/react-tabs';
import * as Dialog from '@radix-ui/react-dialog';
import StatsCards from './StatsCards';
import SectionTabs from './SectionTabs';
import PlanTable from './PlanTable';
import GanttChart from './GanttChart';
import { OutputByProductChart } from './OutputByProductChart';
import { DEMO_APP_NOTICE_TITLE, DEMO_APP_NOTICE_BODY } from '../constants/demoNotice';
import { useLinesList } from '../hooks/useConfigStores';

export default function DashboardView() {
  const navigate = useNavigate();
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [demoModalMessage, setDemoModalMessage] = useState('');

  // Same-tab edits, other tabs (storage → hydrate in PlanSync), and Supabase Realtime all bump the lines store.
  const lines = useLinesList();

  // Initial line is applied in useEffect once `lines` from the store is available (avoid stale getLines import).
  const [selectedLineId, setSelectedLineId] = useState('');

  useEffect(() => {
    if (lines.length === 0) return;
    if (!lines.some((l) => l.id === selectedLineId)) {
      setSelectedLineId(lines[0].id);
    }
  }, [lines, selectedLineId]);

  const selectedLine = useMemo(
    () => lines.find((l) => l.id === selectedLineId) ?? lines[0],
    [lines, selectedLineId]
  );

  const sortedProcesses = useMemo(() => {
    const procs = selectedLine?.processes ?? [];
    return [...procs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [selectedLine]);

  const tabSections = useMemo(
    () => sortedProcesses.map((p) => ({ id: p.id, label: p.name || p.id })),
    [sortedProcesses]
  );

  const [section, setSection] = useState(() => sortedProcesses[0]?.id ?? 'mixing');

  useEffect(() => {
    if (sortedProcesses.length === 0) return;
    if (!sortedProcesses.some((p) => p.id === section)) {
      setSection(sortedProcesses[0].id);
    }
  }, [sortedProcesses, section]);

  const handleLineChange = useCallback(
    (e) => {
      const id = e.target.value;
      setSelectedLineId(id);
      const line = lines.find((l) => l.id === id);
      const procs = [...(line?.processes ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      if (procs[0]) setSection(procs[0].id);
    },
    [lines]
  );

  const openDemoModal = useCallback((message) => {
    setDemoModalMessage(message);
    setDemoModalOpen(true);
  }, []);

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-6 max-w-[1600px] xl:max-w-[1920px] 2xl:max-w-[2200px] mx-auto w-full min-w-0">
      <StatsCards filterProductionLineId={selectedLineId} />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 min-w-0">
        <GanttChart maxRows={4} filterProductionLineId={selectedLineId} sortedProcesses={sortedProcesses} />
        <OutputByProductChart maxRows={4} filterProductionLineId={selectedLineId} />
      </div>
      <section className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <label htmlFor="dashboard-line-profile" className="text-sm font-semibold text-gray-800 shrink-0">
            Production Line Profile
          </label>
          <select
            id="dashboard-line-profile"
            value={selectedLineId}
            onChange={handleLineChange}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white max-w-md w-full sm:w-auto min-w-[12rem]"
          >
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name || l.id}
              </option>
            ))}
          </select>
        </div>

        {sortedProcesses.length === 0 ? (
          <div className="bg-surface-card rounded-card border border-gray-200 p-6 text-sm text-gray-600 shadow-card">
            No <strong className="text-gray-800">Process Chain</strong> steps for this line yet. Add them under{' '}
            <strong className="text-gray-800">Production</strong> (same line profile: Loaf, Bun, etc.).
          </div>
        ) : (
          <SectionTabs value={section} onValueChange={setSection} sections={tabSections}>
            {sortedProcesses.map((sec) => (
              <Tabs.Content key={sec.id} value={sec.id}>
                <PlanTable
                  sectionId={sec.id}
                  sortedProcesses={sortedProcesses}
                  filterProductionLineId={selectedLineId}
                  scheduleAlignedDisplay
                  sortRowsByScheduleStart
                  statusColumnLabel="Status"
                  onAddBatch={() => navigate('/scheduling')}
                  addButtonLabel="See All Schedules"
                  onExport={() => openDemoModal(DEMO_APP_NOTICE_BODY)}
                  onExportPdf={() => openDemoModal(DEMO_APP_NOTICE_BODY)}
                  onLiveView={() =>
                    navigate(
                      `/live/line/${encodeURIComponent(selectedLineId)}/process/${encodeURIComponent(sec.id)}`,
                    )
                  }
                  maxRows={4}
                />
              </Tabs.Content>
            ))}
          </SectionTabs>
        )}
      </section>

      <Dialog.Root open={demoModalOpen} onOpenChange={setDemoModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
            <Dialog.Title className="text-lg font-semibold text-gray-900">{DEMO_APP_NOTICE_TITLE}</Dialog.Title>
            <Dialog.Description className="text-sm text-gray-600 mt-2">
              {demoModalMessage || DEMO_APP_NOTICE_BODY}
            </Dialog.Description>
            <div className="mt-4 flex justify-end">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark"
                >
                  OK
                </button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
