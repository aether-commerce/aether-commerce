"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, RotateCcw, Search } from "lucide-react";

export type CategorySelectOption = { id: string; slug: string; name: string; isHidden: boolean };

export function CategorySelect({
  value,
  options,
  loading,
  error,
  onOpen,
  onRetry,
  onValueChange,
  invalid = false,
  labels
}: Readonly<{
  value: string;
  options: CategorySelectOption[];
  loading: boolean;
  error: boolean;
  onOpen: () => void;
  onRetry: () => void;
  onValueChange: (value: string) => void;
  invalid?: boolean;
  labels: {
    placeholder: string;
    search: string;
    loading: string;
    error: string;
    empty: string;
    noResults: string;
    retry: string;
  };
}>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = options.find((option) => option.slug === value);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized ? options.filter((option) => `${option.name} ${option.slug}`.toLocaleLowerCase().includes(normalized)) : options;
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) closeSelect();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSelect({ restoreFocus: true });
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    searchRef.current?.focus();
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function openSelect() {
    if (!open) {
      onOpen();
      setOpen(true);
      setQuery("");
      setActiveIndex(Math.max(0, options.findIndex((option) => option.slug === value)));
    }
  }

  function closeSelect({ restoreFocus = false }: Readonly<{ restoreFocus?: boolean }> = {}) {
    searchRef.current?.blur();
    setOpen(false);
    setQuery("");
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  }

  function selectOption(option: CategorySelectOption) {
    onValueChange(option.slug);
    closeSelect({ restoreFocus: true });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        className="focus-ring flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 text-left text-base text-ink disabled:cursor-not-allowed disabled:opacity-50 lg:text-sm"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="product-category-options"
        aria-invalid={invalid}
        onClick={openSelect}
      >
        <span className={selected ? "truncate" : "truncate text-ink-subtle"}>{selected?.name ?? (value || labels.placeholder)}</span>
        {loading && !open ? <Loader2 size={16} className="shrink-0 animate-spin text-ink-subtle" aria-hidden /> : <ChevronDown size={16} className="shrink-0 text-ink-subtle" aria-hidden />}
      </button>

      {open ? (
        <div id="product-category-options" role="listbox" aria-label={labels.search} className="absolute inset-x-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-md border border-border bg-surface shadow-elevate-sm">
          <div className="border-b border-border p-2">
            <div className="flex items-center gap-2 rounded-md border border-border bg-surface-hover px-2.5">
              <Search size={15} className="shrink-0 text-ink-subtle" aria-hidden />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((current) => Math.min(current + 1, filtered.length - 1)); }
                  if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((current) => Math.max(current - 1, 0)); }
                  if (event.key === "Enter" && !event.nativeEvent.isComposing && filtered[activeIndex]) { event.preventDefault(); selectOption(filtered[activeIndex]); }
                }}
                placeholder={labels.search}
                aria-label={labels.search}
                className="min-h-9 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-subtle lg:text-sm"
              />
            </div>
          </div>
          <div className="max-h-[min(18rem,50svh)] overflow-y-auto p-1">
            {loading ? <p className="flex min-h-11 items-center gap-2 px-3 text-sm text-ink-muted"><Loader2 size={15} className="animate-spin" aria-hidden />{labels.loading}</p> : null}
            {error ? <div className="grid gap-2 px-3 py-3 text-sm text-danger"><p>{labels.error}</p><button type="button" onClick={onRetry} className="focus-ring inline-flex min-h-9 w-fit items-center gap-2 rounded-md border border-border-strong px-2.5 text-xs font-semibold text-ink"><RotateCcw size={13} aria-hidden />{labels.retry}</button></div> : null}
            {!loading && !error && options.length === 0 ? <p className="px-3 py-3 text-sm text-ink-muted">{labels.empty}</p> : null}
            {!loading && !error && options.length > 0 && filtered.length === 0 ? <p className="px-3 py-3 text-sm text-ink-muted">{labels.noResults}</p> : null}
            {!loading && !error ? filtered.map((option, index) => (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={option.slug === value}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(option)}
                className={`focus-ring flex min-h-11 w-full items-center justify-between gap-3 rounded px-3 text-left text-base lg:text-sm ${index === activeIndex ? "bg-surface-hover" : ""}`}
              >
                <span className="min-w-0 truncate"><span className="font-medium text-ink">{option.name}</span><span className="ml-2 text-xs text-ink-subtle">{option.slug}</span></span>
                {option.slug === value ? <Check size={16} className="shrink-0 text-accent" aria-hidden /> : null}
              </button>
            )) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
