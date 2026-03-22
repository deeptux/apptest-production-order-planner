import { LayoutDashboard, Factory, BookOpen, Calendar, Settings, HelpCircle, Wheat } from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'scheduling', label: 'Scheduling', icon: Calendar },
  { id: 'production', label: 'Production', icon: Factory },
  { id: 'recipes', label: 'Recipe', icon: BookOpen },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'help', label: 'Help', icon: HelpCircle },
];

// nav buttons + wheat graphic — desktop sidebar + mobile drawer both use this.
// onClose optional (drawer passes it to slam shut after navigation)
export function NavContent({ currentPage, onNavigate, onClose, collapsed = false }) {
  return (
    <>
      <nav className="flex flex-col py-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = currentPage === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                onNavigate(id);
                onClose?.();
              }}
              className={`flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3 text-left transition-colors min-h-[44px] sm:min-h-[48px] text-sm sm:text-base ${
                isActive ? 'bg-white/20 text-white font-medium rounded-r-lg' : 'text-white/90 hover:bg-white/10'
              } ${collapsed ? 'justify-center px-0' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              title={collapsed ? label : undefined}
            >
              <Icon className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" aria-hidden />
              {!collapsed && <span>{label}</span>}
            </button>
          );
        })}
      </nav>
    </>
  );
}
