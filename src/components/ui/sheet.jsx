import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

const SheetPortal = (props) => <DialogPrimitive.Portal {...props} />;
SheetPortal.displayName = 'SheetPortal';

const SheetOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 ${className ?? ''}`}
    {...props}
  />
));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

const sheetContentVariants = {
  side: {
    left: 'left-0 top-[var(--header-height)] h-[calc(100vh-var(--header-height))] w-[280px] max-w-[80vw] border-r border-white/10 transition-transform duration-300 ease-out data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0',
    right:
      'right-0 top-[var(--header-height)] h-[calc(100vh-var(--header-height))] w-[280px] max-w-[80vw] border-l border-white/10 transition-transform duration-300 ease-out data-[state=closed]:translate-x-full data-[state=open]:translate-x-0',
    top: 'left-0 right-0 top-0 border-b border-white/10 data-[state=closed]:-translate-y-full data-[state=open]:translate-y-0 transition-transform duration-300',
    bottom:
      'left-0 right-0 bottom-0 border-t border-white/10 data-[state=closed]:translate-y-full data-[state=open]:translate-y-0 transition-transform duration-300',
  },
};

const SheetContent = React.forwardRef(
  ({ side = 'left', className = '', children, ...props }, ref) => (
    <SheetPortal>
      <SheetOverlay className="lg:hidden" />
      <DialogPrimitive.Content
        ref={ref}
        className={`fixed z-40 flex flex-col bg-primary text-white shadow-card ${sheetContentVariants.side[side]} ${className}`}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </SheetPortal>
  )
);
SheetContent.displayName = DialogPrimitive.Content.displayName;

const SheetHeader = ({ className = '', ...props }) => (
  <div className={`flex flex-col space-y-1.5 p-4 ${className}`} {...props} />
);
SheetHeader.displayName = 'SheetHeader';

const SheetTitle = React.forwardRef(({ className = '', ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={`text-lg font-semibold ${className}`}
    {...props}
  />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

const SheetDescription = React.forwardRef(({ className = '', ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={`text-sm text-white/80 ${className}`}
    {...props}
  />
));
SheetDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
};
