import { ChevronLeft, ChevronRight } from 'lucide-react';
import { NavContent } from './NavContent';

/**
 * Desktop only (lg+): sticky sidebar with collapse and circular chevron.
 * Theme: primary background, white text. Not shown on mobile/tablet.
 */
export default function Sidebar({ currentPage, onNavigate, collapsed, onToggleCollapse }) {
  return (
    <aside
      className={`
        hidden lg:flex relative bg-primary text-white flex-col shrink-0 transition-[width] duration-200 ease-out
        sticky left-0 z-40 self-start
        top-14 h-[calc(100vh-3.5rem)]
        ${collapsed ? 'w-[72px]' : 'w-56'}
      `}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <NavContent
          currentPage={currentPage}
          onNavigate={onNavigate}
          onClose={undefined}
          collapsed={collapsed}
        />
      </div>
      <button
        type="button"
        onClick={onToggleCollapse}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-8 h-8 rounded-full bg-primary-dark border-2 border-white/30 text-white flex items-center justify-center shadow-lg hover:bg-primary-light hover:border-white/50 transition-colors z-50"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
