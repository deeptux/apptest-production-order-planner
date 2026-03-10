import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Tabs from '@radix-ui/react-tabs';
import * as Dialog from '@radix-ui/react-dialog';
import { usePlan } from '../context/PlanContext';
import { useSnackbar } from '../context/SnackbarContext';
import StatsCards from './StatsCards';
import SectionTabs, { SECTIONS } from './SectionTabs';
import PlanTable from './PlanTable';
import GanttChart from './GanttChart';
import { OutputByProductChart } from './OutputByProductChart';
import OverrideQueue from './OverrideQueue';

const DEMO_EXPORT_MESSAGE = 'Export (CSV/JSON) is for demo purposes and is not yet included.';
const DEMO_PDF_MESSAGE = 'PDF export is for demo purposes and is not yet included.';

export default function DashboardView() {
  const navigate = useNavigate();
  const { rows, planDate, deleteBatch } = usePlan();
  const { show: showSnackbar } = useSnackbar() ?? {};
  const [section, setSection] = useState('mixing');
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [demoModalMessage, setDemoModalMessage] = useState('');

  const handleDeleteBatch = useCallback(
    (rowId) => {
      const result = deleteBatch(rowId);
      if (result && !result.success && result.error) showSnackbar?.(result.error);
    },
    [deleteBatch, showSnackbar]
  );

  const openDemoModal = useCallback((message) => {
    setDemoModalMessage(message);
    setDemoModalOpen(true);
  }, []);

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-6 max-w-[1600px] xl:max-w-[1920px] 2xl:max-w-[2200px] mx-auto w-full min-w-0">
      <OverrideQueue />
      <StatsCards />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 min-w-0">
        <GanttChart maxRows={4} />
        <OutputByProductChart maxRows={4} />
      </div>
      <section>
        <SectionTabs value={section} onValueChange={setSection}>
          {SECTIONS.map((sec) => (
            <Tabs.Content key={sec.id} value={sec.id}>
              <PlanTable
                sectionId={sec.id}
                onAddBatch={() => navigate('/scheduling')}
                addButtonLabel="See All Schedules"
                onDeleteBatch={handleDeleteBatch}
                onReorder={() => navigate('/scheduling')}
                onExport={() => openDemoModal(DEMO_EXPORT_MESSAGE)}
                onExportPdf={() => openDemoModal(DEMO_PDF_MESSAGE)}
                onLiveView={() => window.open('/live', '_blank')}
                maxRows={4}
              />
            </Tabs.Content>
          ))}
        </SectionTabs>
      </section>

      <Dialog.Root open={demoModalOpen} onOpenChange={setDemoModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
            <Dialog.Title className="text-lg font-semibold text-gray-900">Demo feature</Dialog.Title>
            <Dialog.Description className="text-sm text-gray-600 mt-2">
              {demoModalMessage}
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
