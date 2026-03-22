import { useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePlan } from '../context/PlanContext';
import { PLAN_SYNC_SOURCE } from '../store/planStore';
import AdminRequestsNotificationBar from './AdminRequestsNotificationBar';
import Topbar from './Topbar';
import Sidebar from './Sidebar';
import SidebarDrawer from './SidebarDrawer';
import DashboardView from './DashboardView';
import SchedulingView from './SchedulingView';
import RecipesView from './RecipesView';
import ProductionView from './ProductionView';

const PAGES = { dashboard: 'dashboard', production: 'production', recipes: 'recipes', scheduling: 'scheduling', settings: 'settings', help: 'help' };

export default function PlannerLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { planSyncSource, planCacheStale } = usePlan();
  const page = location.pathname.replace(/^\//, '') || PAGES.dashboard;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const syncBanner =
    planSyncSource === PLAN_SYNC_SOURCE.LOCAL_ONLY
      ? { tone: 'info', text: 'Local-only mode — not connected to a database (safe for dev).' }
      : planCacheStale
        ? {
            tone: 'warn',
            text: 'Showing cached plan — database unavailable; will replace with server data when sync succeeds.',
          }
        : null;

  const onNavigate = useCallback((id) => {
    navigate(`/${id}`);
    setSidebarOpen(false);
  }, [navigate]);

  const renderMain = () => {
    if (page === PAGES.scheduling) return <SchedulingView />;
    if (page === PAGES.dashboard) return <DashboardView />;
    if (page === PAGES.recipes) return <RecipesView />;
    if (page === PAGES.production) return <ProductionView />;
    return (
      <div className="flex-1 p-6 flex items-center justify-center text-muted">
        <p className="text-base sm:text-lg md:text-xl text-muted">{page} — Coming soon</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      {syncBanner && (
        <div
          role="status"
          className={
            syncBanner.tone === 'warn'
              ? 'shrink-0 px-3 py-2 text-sm text-amber-950 bg-amber-100 border-b border-amber-200/80 text-center'
              : 'shrink-0 px-3 py-2 text-sm text-sky-950 bg-sky-100 border-b border-sky-200/80 text-center'
          }
        >
          {syncBanner.text}
        </div>
      )}
      <Topbar onMenuClick={() => setSidebarOpen((o) => !o)} />
      <AdminRequestsNotificationBar />
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
  );
}
