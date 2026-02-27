import { useState, useCallback } from 'react';
import { PlanProvider } from './context/PlanContext';
import Topbar from './components/Topbar';
import Sidebar from './components/Sidebar';
import SidebarDrawer from './components/SidebarDrawer';
import DashboardView from './components/DashboardView';
import SchedulingView from './components/SchedulingView';

const PAGES = { dashboard: 'dashboard', production: 'production', recipes: 'recipes', scheduling: 'scheduling', settings: 'settings', help: 'help' };

export default function App() {
  const [page, setPage] = useState(PAGES.dashboard);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const onNavigate = useCallback((id) => {
    setPage(id);
    setSidebarOpen(false);
  }, []);

  const renderMain = () => {
    if (page === PAGES.scheduling) return <SchedulingView />;
    if (page === PAGES.dashboard) return <DashboardView />;
    return (
      <div className="flex-1 p-6 flex items-center justify-center text-muted">
        <p className="text-base sm:text-lg md:text-xl text-muted">{page} — Coming soon</p>
      </div>
    );
  };

  return (
    <PlanProvider>
      <div className="min-h-screen flex flex-col bg-surface">
        <Topbar onMenuClick={() => setSidebarOpen((o) => !o)} />
        {/* Mobile/tablet: Sheet drawer (shadcn-style). Overlay and positioning handled by Radix Dialog. */}
        <SidebarDrawer
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
          currentPage={page}
          onNavigate={onNavigate}
        />
        <div className="flex flex-1 min-h-0">
          <Sidebar
            currentPage={page}
            onNavigate={onNavigate}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          />
          <main className="flex-1 min-w-0 overflow-auto w-full">
            {renderMain()}
          </main>
        </div>
      </div>
    </PlanProvider>
  );
}
