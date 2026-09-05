export function StickyFormActions({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 mt-6 flex flex-wrap items-center gap-3 border-t border-border bg-surface px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-elevate-md lg:sticky lg:inset-x-auto lg:-mx-6 lg:px-6 lg:col-span-2">
      {children}
    </div>
  );
}
