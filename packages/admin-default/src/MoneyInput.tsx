"use client";

import { useEffect, useState } from "react";
import { formatMoneyInput } from "@aether-commerce/core";

function getSeparators(locale: string) {
  const parts = new Intl.NumberFormat(locale, { style: "decimal", minimumFractionDigits: 2 }).formatToParts(1000.5);
  return {
    decimal: parts.find((part) => part.type === "decimal")?.value ?? "."
  };
}

function sanitize(value: string, currency: string, locale: string) {
  const { decimal } = getSeparators(locale);
  const cleaned = value.replace(/[^0-9.,]/g, "");
  if (!cleaned) return "";

  // COP is a whole-unit currency in the product UI. Keep grouping punctuation
  // in the draft so an entry such as 10.000 remains readable while editing.
  if (currency.toUpperCase() === "COP") return cleaned;

  const alternateDecimal = decimal === "." ? "," : ".";
  const localeDecimalIndex = cleaned.lastIndexOf(decimal);
  const alternateDecimalIndex = cleaned.lastIndexOf(alternateDecimal);
  const decimalIndex = [localeDecimalIndex, alternateDecimalIndex]
    .filter((index) => index >= 0 && cleaned.length - index - 1 <= 2)
    .sort((left, right) => right - left)[0] ?? -1;
  if (decimalIndex === -1) return cleaned;
  const whole = cleaned.slice(0, decimalIndex).replace(/[.,]/g, "");
  const fraction = cleaned.slice(decimalIndex + decimal.length).replace(/[.,]/g, "").slice(0, 2);
  return `${whole}${decimal}${fraction}`;
}

function parseMoneyInput(value: string, currency: string, locale: string): number | null {
  const { decimal } = getSeparators(locale);
  const draft = sanitize(value, currency, locale);
  if (!draft) return null;

  if (currency.toUpperCase() === "COP") {
    const wholeUnits = draft.replace(/[.,]/g, "");
    return wholeUnits ? Math.round(Number(wholeUnits) * 100) : null;
  }

  const decimalIndex = draft.lastIndexOf(decimal);
  const normalized = decimalIndex === -1
    ? draft.replace(/[.,]/g, "")
    : `${draft.slice(0, decimalIndex).replace(/[.,]/g, "")}.${draft.slice(decimalIndex + decimal.length).replace(/[.,]/g, "")}`;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

export function MoneyInput({ value, currency, locale = "en-US", className, onValueChange, onFocus, onBlur }: Readonly<{
  value: number | null;
  currency: string;
  locale?: string;
  className: string;
  onValueChange: (value: number | null) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}>) {
  const [draft, setDraft] = useState(value === null ? "" : formatMoneyInput(value, currency, locale));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (focused) return;
    setDraft(value === null ? "" : formatMoneyInput(value, currency, locale));
  }, [currency, focused, locale, value]);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-ink-subtle">{currency}</span>
      <input
        type="text"
        inputMode="decimal"
        pattern="[0-9.,]*"
        className={`${className} pl-14 tabular-nums`}
        value={draft}
        onFocus={() => { setFocused(true); onFocus?.(); }}
        onChange={(event) => {
          const next = sanitize(event.target.value, currency, locale);
          setDraft(next);
          onValueChange(parseMoneyInput(next, currency, locale));
        }}
        onBlur={() => { setFocused(false); onBlur?.(); }}
      />
    </div>
  );
}
