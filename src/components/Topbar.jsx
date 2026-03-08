import { Bell, Settings, User, LogOut, Menu } from 'lucide-react';

export default function Topbar({ onMenuClick }) {
  return (
    <header className="h-[var(--header-height)] bg-primary text-white flex items-center justify-between px-3 sm:px-4 shrink-0 sticky top-0 z-50 shadow-card">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-white/10 transition-colors shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <img
          src="/images/logo.png"
          alt=""
          className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 object-contain shrink-0 block"
          aria-hidden
        />
        <h1 className="text-app-title sm:text-sm-app-title md:text-md-app-title lg:text-lg-app-title font-semibold tracking-tight text-white truncate">
          NPB Loaf Line Production Planner
        </h1>
      </div>
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <button type="button" className="p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="Notifications">
          <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
        <button type="button" className="p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="Settings">
          <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-white/30">
          <User className="w-5 h-5 md:w-6 md:h-6" aria-hidden />
          <span className="text-xs sm:text-sm font-medium">Baker Ben</span>
        </div>
        <a href="#" className="flex items-center gap-2 text-xs sm:text-sm text-white/90 hover:text-white transition-colors ml-1 sm:ml-2" onClick={(e) => e.preventDefault()}>
          <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
          Logout
        </a>
      </div>
    </header>
  );
}
