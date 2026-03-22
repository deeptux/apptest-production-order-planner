import { Bell, Settings, User, LogOut, Menu, Clock, MapPin, ChevronRight } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { isSupabaseConfigured } from '../lib/supabase';
import { useOverrideRequests } from '../context/OverrideRequestsContext';
import {
  formatSupervisorRequestSummary,
  getSupervisorBellCardMeta,
  OPEN_ADMIN_SUPERVISOR_REVIEW_EVENT,
} from '../constants/supervisorRequests';

function BellRequestCard({ req, onOpen }) {
  const summary = formatSupervisorRequestSummary(req);
  const { when, where } = getSupervisorBellCardMeta(req);

  return (
    <DropdownMenu.Item
      className="group cursor-pointer mx-1.5 mb-2 last:mb-1 rounded-xl border border-gray-200/90 bg-gradient-to-b from-white to-gray-50/90 px-0 py-0 text-left shadow-sm outline-none transition-all data-[highlighted]:border-primary/35 data-[highlighted]:from-amber-50/90 data-[highlighted]:to-amber-50/50 data-[highlighted]:shadow-md data-[highlighted]:ring-1 data-[highlighted]:ring-primary/15 data-[state=open]:shadow-md"
      onSelect={(e) => {
        e.preventDefault();
        onOpen(req);
      }}
    >
      <div className="px-3 pt-2.5 pb-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-semibold leading-snug text-gray-900 line-clamp-2 min-w-0">{summary}</p>
          <ChevronRight
            className="h-4 w-4 shrink-0 text-gray-300 transition-colors group-data-[highlighted]:text-primary mt-0.5"
            aria-hidden
          />
        </div>
        {(when || where) ? (
          <div className="mt-2.5 space-y-1.5 border-t border-gray-100/90 pt-2.5">
            {when ? (
              <div className="flex items-start gap-2 min-w-0">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500">
                  <Clock className="h-3 w-3" aria-hidden />
                </span>
                <p className="min-w-0 text-[12px] leading-snug text-gray-600 pt-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Submitted:</span>{' '}
                  <span className="text-gray-700">{when}</span>
                </p>
              </div>
            ) : null}
            {where ? (
              <div className="flex items-start gap-2 min-w-0">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500">
                  <MapPin className="h-3 w-3" aria-hidden />
                </span>
                <p className="min-w-0 text-[12px] leading-snug text-gray-600 pt-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Where:</span>{' '}
                  <span className="text-gray-700">{where}</span>
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </DropdownMenu.Item>
  );
}

export default function Topbar({ onMenuClick }) {
  const { pending, isLocalOnlyQueue } = useOverrideRequests();
  const db = isSupabaseConfigured();
  const pendingCount = pending.length;

  const openReviewFromBell = (req) => {
    window.dispatchEvent(new CustomEvent(OPEN_ADMIN_SUPERVISOR_REVIEW_EVENT, { detail: { request: req } }));
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
                  ? `Supervisor requests, ${pendingCount} pending${isLocalOnlyQueue ? ', this browser' : ''}`
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
              className="z-[100] flex w-[min(100vw-1rem,26rem)] max-w-[26rem] max-h-[min(75vh,24rem)] flex-col overflow-hidden rounded-xl border border-gray-200/95 bg-gray-50/80 py-2 text-sm text-gray-800 shadow-xl"
              sideOffset={6}
              align="end"
            >
              <div className="shrink-0 px-3 pb-2 border-b border-gray-200/80 bg-white/60">
                <p className="font-semibold text-gray-900 text-[14px] tracking-tight">Supervisor requests</p>
                {pendingCount === 0 ? (
                  <p className="text-muted text-[12px] mt-1 leading-snug">None pending.</p>
                ) : (
                  <p className="text-[12px] text-gray-600 mt-1 leading-snug">
                    <strong className="text-gray-800">{pendingCount}</strong> pending. Select a card to review.
                  </p>
                )}
              </div>
              {pendingCount > 0 && (
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pt-2 pb-1">
                  {pending.map((req) => (
                    <BellRequestCard key={req.id} req={req} onOpen={openReviewFromBell} />
                  ))}
                </div>
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
