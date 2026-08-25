"use client";

import { useEffect, useState } from "react";

function sanitize(value: string) {
  const normalized = value.replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const [whole = "", ...decimals] = normalized.split(".");
  return decimals.length ? `${whole}.${decimals.join("").slice(0, 2)}` : whole;
}

export function MoneyInput({ value, currency, className, onValueChange, onFocus, onBlur }: Readonly<{
  value: number | null;
  currency: string;
  className: string;
  onValueChange: (value: number | null) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}>) {
  const [draft, setDraft] = useState(value === null ? "" : (value / 100).toFixed(2));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (focused) return;
    setDraft(value === null ? "" : (value / 100).toFixed(2));
  }, [focused, value]);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-ink-subtle">{currency}</span>
      <input
        type="text"
        inputMode="decimal"
        pattern="[0-9]*[.,]?[0-9]{0,2}"
        className={`${className} pl-14 tabular-nums`}
        value={draft}
        onFocus={() => { setFocused(true); onFocus?.(); }}
        onChange={(event) => {
          const next = sanitize(event.target.value);
          setDraft(next);
          onValueChange(next ? Math.round(Number(next) * 100) : null);
        }}
        onBlur={() => { setFocused(false); onBlur?.(); }}
      />
    </div>
  );
}
