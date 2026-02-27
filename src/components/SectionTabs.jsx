import * as Tabs from '@radix-ui/react-tabs';

const SECTIONS = [
  { id: 'mixing', label: 'Mixing' },
  { id: 'makeup-dividing', label: 'Makeup Dividing' },
  { id: 'makeup-panning', label: 'Makeup Panning' },
  { id: 'baking', label: 'Baking' },
  { id: 'packaging', label: 'Packaging' },
];

export default function SectionTabs({ value, onValueChange, children }) {
  return (
    <Tabs.Root value={value} onValueChange={onValueChange} className="w-full">
      <Tabs.List className="flex gap-1 border-b border-gray-200 bg-surface-card-warm rounded-t-card overflow-x-auto pt-2 px-2">
        {SECTIONS.map(({ id, label }) => (
          <Tabs.Trigger
            key={id}
            value={id}
            className="px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm md:text-base font-medium rounded-t-lg transition-colors shrink-0 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=inactive]:text-gray-700 data-[state=inactive]:hover:bg-gray-200/50"
          >
            {label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {children}
    </Tabs.Root>
  );
}

export { SECTIONS };
