"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { Gauge } from "lucide-react";
import { useAdminConfig } from "./AetherAdminProvider";
import { RequireAdminAuth } from "./RequireAdminAuth";
import { PageHeader } from "./PageHeader";
import { FormSection } from "./FormSection";
import { useAdminLanguage } from "./AdminLanguageProvider";
import { loadSettings } from "./admin-list-helpers";

type LimitSetting =
  | { mode: "deployment" }
  | { mode: "unlimited" }
  | { mode: "custom"; limit: number };

type AssistantLimits = {
  messagesPerMinute: LimitSetting;
  messagesPerHour: LimitSetting;
  anonymousMessagesPerDay: LimitSetting;
  dailyRequestBudget: LimitSetting;
  maxConcurrentRequests: LimitSetting;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

const DEFAULT_LIMITS: AssistantLimits = {
  messagesPerMinute: { mode: "deployment" },
  messagesPerHour: { mode: "deployment" },
  anonymousMessagesPerDay: { mode: "deployment" },
  dailyRequestBudget: { mode: "deployment" },
  maxConcurrentRequests: { mode: "deployment" }
};

const FIELDS = [
  { key: "messagesPerMinute", title: "messagesPerMinute", description: "messagesPerMinuteDescription", maximum: 1_000_000 },
  { key: "messagesPerHour", title: "messagesPerHour", description: "messagesPerHourDescription", maximum: 1_000_000 },
  { key: "anonymousMessagesPerDay", title: "anonymousMessagesPerDay", description: "anonymousMessagesPerDayDescription", maximum: 1_000_000 },
  { key: "dailyRequestBudget", title: "dailyRequestBudget", description: "dailyRequestBudgetDescription", maximum: 1_000_000 },
  { key: "maxConcurrentRequests", title: "maxConcurrentRequests", description: "maxConcurrentRequestsDescription", maximum: 1_000 }
] as const;

export function SettingsAssistantLimitsPage() {
  const { apiBaseUrl } = useAdminConfig();
  const { getToken } = useAuth();
  const { t } = useAdminLanguage();
  const [limits, setLimits] = useState<AssistantLimits>(DEFAULT_LIMITS);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "forbidden" | "error">("loading");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const load = useCallback(async () => {
    setLoadStatus("loading");
    const token = await getToken().catch(() => null);
    await loadSettings<AssistantLimits>(
      `${apiBaseUrl}/api/v1/admin/assistant-limits`,
      token ? { authorization: `Bearer ${token}` } : {},
      () => setLoadStatus("forbidden"),
      (data) => {
        setLimits(data);
        setLoadStatus("ready");
      },
      () => setLoadStatus("error")
    );
  }, [apiBaseUrl, getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaveStatus("saving");
    const token = await getToken().catch(() => null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/admin/assistant-limits`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(limits)
      });
      const payload = (await response.json()) as { success: boolean; data?: AssistantLimits };
      if (!response.ok || !payload.success || !payload.data) {
        setSaveStatus("error");
        return;
      }
      setLimits(payload.data);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }

  function updateLimit(key: keyof AssistantLimits, mode: LimitSetting["mode"]) {
    setLimits((current) => ({
      ...current,
      [key]: mode === "custom" ? { mode, limit: current[key].mode === "custom" ? current[key].limit : 1 } : { mode }
    }));
    setSaveStatus("idle");
  }

  function updateLimitValue(key: keyof AssistantLimits, value: string) {
    const parsed = Number(value);
    setLimits((current) => ({
      ...current,
      [key]: { mode: "custom", limit: value.trim() === "" ? 0 : parsed }
    }));
    setSaveStatus("idle");
  }

  const hasInvalidLimit = FIELDS.some(({ key, maximum }) => {
    const setting = limits[key];
    return setting.mode === "custom" && (!Number.isSafeInteger(setting.limit) || setting.limit < 1 || setting.limit > maximum);
  });

  return (
    <RequireAdminAuth>
      <main id="main-content" className="admin-shell py-8">
        <PageHeader title={t.assistantLimitsPage.title} description={t.assistantLimitsPage.description} />
        {loadStatus === "loading" ? <p role="status" className="py-8 text-sm text-ink-muted">{t.common.loading}</p> : null}
        {loadStatus === "error" ? (
          <div className="flex items-center gap-3 py-8">
            <p role="alert" className="text-sm text-danger">{t.assistantLimitsPage.loadError}</p>
            <button type="button" onClick={() => void load()} className="focus-ring min-h-10 rounded-md border border-border-strong px-3 text-sm font-semibold text-ink">{t.common.retry}</button>
          </div>
        ) : null}
        {loadStatus === "forbidden" ? <p role="alert" className="py-8 text-sm text-danger">{t.assistantLimitsPage.forbidden}</p> : null}
        {loadStatus === "ready" ? (
          <div className="grid gap-5">
            <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-ink-muted">{t.assistantLimitsPage.scopeNote}</p>
            {FIELDS.map(({ key, title, description, maximum }) => {
              const setting = limits[key];
              const invalidValue = setting.mode === "custom" && (!Number.isSafeInteger(setting.limit) || setting.limit < 1 || setting.limit > maximum);
              return (
                <FormSection key={key} title={<><Gauge size={16} aria-hidden />{t.assistantLimitsPage[title]}</>} description={t.assistantLimitsPage[description]}>
                  <div className="grid gap-3 sm:grid-cols-[minmax(12rem,1fr)_minmax(12rem,16rem)] sm:items-end">
                    <label className="grid gap-1 text-sm">
                      <span className="font-medium text-ink-muted">{t.assistantLimitsPage[title]}</span>
                      <select
                        aria-label={t.assistantLimitsPage[title]}
                        value={setting.mode}
                        onChange={(event) => updateLimit(key, event.target.value as LimitSetting["mode"])}
                        className="focus-ring min-h-10 rounded-md border border-border bg-surface px-3 text-ink"
                      >
                        <option value="deployment">{t.assistantLimitsPage.deployment}</option>
                        <option value="custom">{t.assistantLimitsPage.custom}</option>
                        <option value="unlimited">{t.assistantLimitsPage.unlimited}</option>
                      </select>
                    </label>
                    {setting.mode === "custom" ? (
                      <label className="grid gap-1 text-sm">
                        <span className="font-medium text-ink-muted">{t.assistantLimitsPage.limitValue}</span>
                        <input
                          type="number"
                          min={1}
                          max={maximum}
                          step={1}
                          value={setting.limit || ""}
                          onChange={(event) => updateLimitValue(key, event.target.value)}
                          aria-invalid={invalidValue}
                          aria-describedby={invalidValue ? `${key}-limit-error` : undefined}
                          className="focus-ring min-h-10 rounded-md border border-border bg-surface px-3 text-ink tabular-nums"
                        />
                        {invalidValue ? <span id={`${key}-limit-error`} role="alert" className="text-xs text-danger">{t.assistantLimitsPage.invalidLimit}</span> : null}
                      </label>
                    ) : null}
                  </div>
                </FormSection>
              );
            })}
            <div className="flex min-h-11 items-center gap-3">
              <button
                type="button"
                disabled={saveStatus === "saving" || hasInvalidLimit}
                onClick={() => void save()}
                className="focus-ring min-h-10 rounded-md bg-primary px-4 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saveStatus === "saving" ? t.assistantLimitsPage.saving : t.assistantLimitsPage.save}
              </button>
              {saveStatus === "saved" ? <span role="status" className="text-sm text-success">{t.assistantLimitsPage.saved}</span> : null}
              {saveStatus === "error" ? <span role="alert" className="text-sm text-danger">{t.assistantLimitsPage.saveError}</span> : null}
            </div>
          </div>
        ) : null}
      </main>
    </RequireAdminAuth>
  );
}
