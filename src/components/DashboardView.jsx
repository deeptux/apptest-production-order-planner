import { useState, useCallback } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { usePlan } from '../context/PlanContext';
import StatsCards from './StatsCards';
import SectionTabs, { SECTIONS } from './SectionTabs';
import PlanTable from './PlanTable';
import GanttChart from './GanttChart';
import { OutputByProductChart } from './OutputByProductChart';

export default function DashboardView() {
  const { rows, planDate, addBatch } = usePlan();
  const [section, setSection] = useState('mixing');

  const handleExport = useCallback(() => {
    const data = { planDate: planDate?.toISOString?.() ?? planDate, rows };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'plan-export.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }, [rows, planDate]);

  const handleExportCSV = useCallback(() => {
    const headers = ['product', 'soQty', 'theorOutput', 'capacity', 'procTime', 'startSponge', 'endDough', 'endBatch', 'batch'];
    const line = (r) => headers.map((h) => r[h] ?? '').join(',');
    const csv = [headers.join(','), ...rows.map(line)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'plan-export.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }, [rows]);

  const handleExportClick = useCallback(() => {
    handleExportCSV();
    handleExport();
  }, [handleExportCSV, handleExport]);

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-6 max-w-[1600px] xl:max-w-[1920px] 2xl:max-w-[2200px] mx-auto w-full min-w-0">
      <StatsCards />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 min-w-0">
        <GanttChart />
        <OutputByProductChart />
      </div>
      <section>
        <SectionTabs value={section} onValueChange={setSection}>
          {SECTIONS.map((sec) => (
            <Tabs.Content key={sec.id} value={sec.id}>
              <PlanTable
                sectionId={sec.id}
                onAddBatch={addBatch}
                onReorder={() => {}}
                onExport={handleExportClick}
                onExportPdf={() => window.print()}
                onLiveView={() => window.open('/#live', '_blank')}
              />
            </Tabs.Content>
          ))}
        </SectionTabs>
      </section>
    </div>
  );
}
