import { Bell, Settings, User, LogOut, Menu } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { isSupabaseConfigured } from '../lib/supabase';
import { useOverrideRequests } from '../context/OverrideRequestsContext';

export default function Topbar({ onMenuClick }) {
  const { pending, isLocalOnlyQueue } = useOverrideRequests();
  const db = isSupabaseConfigured();
  const pendingCount = pending.length;

  const scrollToSupervisorStrip = () => {
    document.getElementById('planner-supervisor-requests')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

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
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label={
                pendingCount
                  ? `Supervisor requests, ${pendingCount} pending${isLocalOnlyQueue ? ', this device' : ''}`
                  : 'Supervisor requests'
              }
            >
              <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
              {pendingCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[1.125rem] h-[1.125rem] px-0.5 rounded-full bg-amber-300 text-[10px] font-bold text-amber-950 flex items-center justify-center tabular-nums">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
              {!db && pendingCount === 0 && (
                <span
                  className="absolute top-1 right-1 w-2 h-2 rounded-full bg-sky-200 ring-2 ring-primary"
                  title="No pending requests"
                  aria-hidden
                />
              )}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-[100] min-w-[220px] max-w-[min(100vw-2rem,20rem)] rounded-lg border border-gray-200 bg-white p-2.5 text-sm text-gray-800 shadow-lg"
              sideOffset={6}
              align="end"
            >
              <p className="font-semibold text-gray-900 mb-1.5 text-[13px]">Supervisor requests</p>
              {db ? (
                pendingCount === 0 ? (
                  <p className="text-muted text-[13px] leading-snug">None pending.</p>
                ) : (
                  <>
                    <p className="text-gray-800 text-[13px] mb-1.5">
                      <strong>{pendingCount}</strong> pending — see amber bar under the header.
                    </p>
                    <DropdownMenu.Item
                      className="w-full text-left rounded-md px-2 py-1.5 text-[13px] font-medium text-primary hover:bg-primary/10 outline-none cursor-pointer"
                      onSelect={(e) => {
                        e.preventDefault();
                        scrollToSupervisorStrip();
                      }}
                    >
                      Jump to list
                    </DropdownMenu.Item>
                  </>
                )
              ) : pendingCount === 0 ? (
                <p className="text-muted text-[13px] leading-snug">None pending on this device.</p>
              ) : (
                <>
                  <p className="text-gray-800 text-[13px] mb-1.5">
                    <strong>{pendingCount}</strong> pending (this device).
                  </p>
                  <DropdownMenu.Item
                    className="w-full text-left rounded-md px-2 py-1.5 text-[13px] font-medium text-primary hover:bg-primary/10 outline-none cursor-pointer"
                    onSelect={(e) => {
                      e.preventDefault();
                      scrollToSupervisorStrip();
                    }}
                  >
                    Jump to list
                  </DropdownMenu.Item>
                </>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <button type="button" className="p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="Settings">
          <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-white/30">
          <User className="w-5 h-5 md:w-6 md:w-6" aria-hidden />
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
