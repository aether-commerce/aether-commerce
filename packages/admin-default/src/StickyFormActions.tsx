export function StickyFormActions({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-6 flex flex-wrap items-center gap-3 border-t border-border bg-surface/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-sm sm:-mx-6 sm:px-6 lg:col-span-2">
      {children}
    </div>
  );
}
