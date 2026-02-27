import { Sheet, SheetContent } from './ui/sheet';
import { NavContent } from './NavContent';

/**
 * Mobile/tablet only: drawer (Sheet) that opens from the left.
 * Uses theme: bg-primary, text white, same nav items as desktop Sidebar.
 * Hidden on lg+ via SheetContent className.
 */
export default function SidebarDrawer({ open, onOpenChange, currentPage, onNavigate }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="lg:hidden flex flex-col p-0 gap-0"
        aria-describedby={undefined}
        aria-label="Main navigation"
      >
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <NavContent
            currentPage={currentPage}
            onNavigate={onNavigate}
            onClose={() => onOpenChange(false)}
            collapsed={false}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
