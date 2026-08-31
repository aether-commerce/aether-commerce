"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@clerk/react";
import { formatMoney } from "@aether-commerce/core";
import { AlertTriangle, Boxes, ChevronDown, Download, History, Mail, PackageCheck, Settings, Shield, TicketPercent, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAdminConfig } from "./AetherAdminProvider";
import { Metric } from "./Metric";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { StatusBadge, type StatusTone } from "./StatusBadge";
import { useAdminLanguage } from "./AdminLanguageProvider";
import { exportOrdersCsv } from "./admin-list-helpers";
import type { AdminDictionary } from "@aether-commerce/i18n";

type ProductSummary = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  lowStockThreshold: number;
  visibility: "draft" | "visible" | "hidden";
};

type OrderSummary = {
  id: string;
  number: string;
  email: string;
  channel: "stripe" | "wompi" | "whatsapp";
  payment_status: "pending" | "paid" | "failed" | "refunded" | "partially_refunded";
  fulfillment_status: "unfulfilled" | "processing" | "shipped" | "delivered" | "cancelled";
  total: number;
  currency: string;
};

type CustomerSummary = {
  id: string;
  source: "registered" | "guest";
  name: string | null;
  email: string;
  status: "active" | "suspended";
  orderCount: number;
};

type Summary = {
  mode: "private" | "demo";
  currency: string;
  revenue: number;
  orders: number;
  // null on the real (private) summary - nothing in this codebase records
  // storefront pageviews/sessions, so there is no real conversion rate to
  // compute. Only ever a number on the demo-mode fallback below, whose
  // figures are illustrative by design.
  conversionRate: number | null;
  lowStock: number;
  notice?: { en: string; es: string };
};

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  locale: string;
  email_status: string | null;
  created_at: string;
};

const demoFallback: Summary = {
  mode: "demo",
  currency: "USD",
  revenue: 1842500,
  orders: 128,
  conversionRate: 4.8,
  lowStock: 7,
  notice: {
    en: "Public demo mode. Changes are disabled.",
    es: "Modo de demostracion publica. Los cambios estan deshabilitados."
  }
};

function money(cents: number, locale: string, currency: string, storeLocale: string) {
  return formatMoney(cents, currency, locale === "es" ? storeLocale : "en-US");
}

const stockTone: Record<"in" | "low" | "out", StatusTone> = {
  in: "success",
  low: "warning",
  out: "error"
};
function stockStatus(product: ProductSummary, t: AdminDictionary): { label: string; tone: StatusTone } {
  if (product.stock <= 0) return { label: t.dashboard.outOfStock, tone: stockTone.out };
  if (product.stock <= product.lowStockThreshold) return { label: t.dashboard.lowStock, tone: stockTone.low };
  return { label: t.dashboard.inStock, tone: stockTone.in };
}

// Shared shape behind the products/orders/customers section subtitles:
// "{count} thing(s)" once the total is known, a fixed fallback string while
// it's still loading (total === null).
function countSubtitle(total: number | null, singular: string, plural: string, fallback: string): string {
  if (total === null) return fallback;
  return (total === 1 ? singular : plural).replace("{count}", String(total));
}

type LoadStatus = "loading" | "ready" | "error";

function ordersSectionBody(status: LoadStatus, orders: OrderSummary[], t: AdminDictionary): ReactNode {
  if (status === "error") return <p className="p-4 text-sm text-ink-muted">{t.dashboard.couldNotLoadOrders}</p>;
  if (status === "loading") {
    return (
      <div className="grid gap-2 p-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="skeleton h-12 rounded-md" />
        ))}
      </div>
    );
  }
  if (orders.length === 0) return <EmptyState title={t.dashboard.noOrdersYetTitle} description={t.dashboard.noOrdersYetDescription} />;
  return orders.map((order) => (
    <div key={order.id} className="grid gap-3 border-b border-border p-4 last:border-b-0 md:grid-cols-[140px_1fr_140px_160px] md:items-center">
      <strong className="text-ink">{order.number}</strong>
      <span className="truncate text-ink-muted">{order.email}</span>
      <span className="text-sm text-ink-muted">
        {t.orderStatus[order.payment_status]} &middot; {t.orderStatus[order.fulfillment_status]}
      </span>
      <a
        href={`/orders/detail/?id=${encodeURIComponent(order.id)}`}
        className="focus-ring inline-flex min-h-9 items-center justify-center rounded-md border border-border-strong px-3 text-sm font-semibold text-ink hover:bg-surface-hover"
      >
        {t.dashboard.openOrder}
      </a>
    </div>
  ));
}

function customersSectionBody(status: LoadStatus, customers: CustomerSummary[], t: AdminDictionary): ReactNode {
  if (status === "error") return <p className="p-4 text-sm text-ink-muted">{t.dashboard.couldNotLoadCustomers}</p>;
  if (status === "loading") {
    return (
      <div className="grid gap-2 p-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="skeleton h-12 rounded-md" />
        ))}
      </div>
    );
  }
  if (customers.length === 0) return <EmptyState title={t.dashboard.noCustomersYetTitle} description={t.dashboard.noCustomersYetDescription} />;
  return customers.map((customer) => (
    <div key={customer.id} className="grid gap-3 border-b border-border p-4 last:border-b-0 md:grid-cols-[1fr_140px_100px_160px] md:items-center">
      <span className="text-ink">{customer.name ?? customer.email}</span>
      <span className="text-sm text-ink-muted">{customer.source === "guest" ? t.dashboard.guestCheckout : t.dashboard.registered}</span>
      <StatusBadge tone={customer.status === "suspended" ? "error" : "success"}>{t.customerStatus[customer.status]}</StatusBadge>
      <a
        href={`/customers/detail/?id=${encodeURIComponent(customer.id)}`}
        className="focus-ring inline-flex min-h-9 items-center justify-center rounded-md border border-border-strong px-3 text-sm font-semibold text-ink hover:bg-surface-hover"
      >
        {t.dashboard.openCustomer}
      </a>
    </div>
  ));
}

function messagesSectionBody(
  status: "loading" | "ready" | "forbidden" | "error",
  messages: ContactMessage[],
  demo: boolean,
  openMessageId: string | null,
  onToggleMessage: (id: string) => void,
  locale: string,
  t: AdminDictionary
): ReactNode {
  if (status === "forbidden") {
    return <p className="p-4 text-sm text-ink-muted">{demo ? t.dashboard.demoHidesMessages : t.dashboard.noContactPermission}</p>;
  }
  if (status === "error") return <p className="p-4 text-sm text-ink-muted">{t.dashboard.couldNotLoadMessages}</p>;
  if (status === "loading") {
    return (
      <div className="grid gap-2 p-4">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="skeleton h-12 rounded-md" />
        ))}
      </div>
    );
  }
  if (messages.length === 0) return <EmptyState title={t.dashboard.noMessagesYetTitle} description={t.dashboard.noMessagesYetDescription} />;
  return messages.map((entry) => {
    const isOpen = openMessageId === entry.id;
    return (
      <div key={entry.id} className="border-b border-border last:border-b-0">
        <button
          type="button"
          onClick={() => onToggleMessage(entry.id)}
          aria-expanded={isOpen}
          className="focus-ring grid w-full gap-1 p-4 text-left md:grid-cols-[1fr_1fr_180px_24px] md:items-center md:gap-3"
        >
          <span className="font-medium text-ink">{entry.name}</span>
          <span className="truncate text-sm text-ink-muted">{entry.subject}</span>
          <span className="text-xs text-ink-subtle">{new Date(entry.created_at).toLocaleString(locale === "es" ? "es-ES" : "en-US")}</span>
          <ChevronDown size={16} aria-hidden className={`justify-self-end text-ink-subtle transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
        {isOpen ? (
          <div className="grid gap-2 border-t border-border bg-surface-hover p-4 text-sm">
            <p className="flex items-center gap-2 text-ink-muted">
              <Mail size={14} aria-hidden />
              <a href={`mailto:${entry.email}`} className="underline">
                {entry.email}
              </a>
              <span className="text-ink-subtle">&middot; {entry.locale}</span>
            </p>
            <p className="whitespace-pre-wrap text-ink">{entry.message}</p>
          </div>
        ) : null}
      </div>
    );
  });
}

type StatusKey = "statusDemoData" | "statusPrivateAdmin" | "statusPublicDemo" | "statusLivePrivateAdmin" | "statusOfflineDemo";

export function AdminDashboard({ demo = false }: Readonly<{ demo?: boolean }>) {
  const { t, locale } = useAdminLanguage();
  const { apiBaseUrl, config } = useAdminConfig();
  const [summary, setSummary] = useState<Summary | null>(() => (demo ? demoFallback : null));
  const [summaryStatus, setSummaryStatus] = useState<LoadStatus>("loading");
  const [summaryReloadKey, setSummaryReloadKey] = useState(0);
  const [statusKey, setStatusKey] = useState<StatusKey>(demo ? "statusDemoData" : "statusPrivateAdmin");
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [messagesStatus, setMessagesStatus] = useState<"loading" | "ready" | "forbidden" | "error">("loading");
  const [openMessageId, setOpenMessageId] = useState<string | null>(null);
  const [recentProducts, setRecentProducts] = useState<ProductSummary[]>([]);
  const [productsTotal, setProductsTotal] = useState<number | null>(null);
  const [productsStatus, setProductsStatus] = useState<LoadStatus>("loading");
  const [lowStockProducts, setLowStockProducts] = useState<ProductSummary[]>([]);
  const [inventoryStatus, setInventoryStatus] = useState<LoadStatus>("loading");
  const [recentOrders, setRecentOrders] = useState<OrderSummary[]>([]);
  const [ordersTotal, setOrdersTotal] = useState<number | null>(null);
  const [ordersStatus, setOrdersStatus] = useState<LoadStatus>("loading");
  const [recentCustomers, setRecentCustomers] = useState<CustomerSummary[]>([]);
  const [customersTotal, setCustomersTotal] = useState<number | null>(null);
  const [customersStatus, setCustomersStatus] = useState<LoadStatus>("loading");
  const { isLoaded, getToken } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;

    void (async () => {
      const token = await getToken().catch(() => null);
      const headers = token ? { authorization: `Bearer ${token}` } : {};
      const [productsResponse, inventoryResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/api/v1/admin/products?pageSize=3&sort=updated_at`, { headers }).catch(() => null),
        fetch(`${apiBaseUrl}/api/v1/admin/products?stock=low&pageSize=4`, { headers }).catch(() => null)
      ]);
      if (cancelled) return;

      if (productsResponse?.ok) {
        const payload = (await productsResponse.json()) as {
          success: boolean;
          data?: { data: ProductSummary[]; pagination: { total: number } };
        };
        if (payload.success && payload.data) {
          setRecentProducts(payload.data.data);
          setProductsTotal(payload.data.pagination.total);
          setProductsStatus("ready");
        } else {
          setProductsStatus("error");
        }
      } else {
        setProductsStatus("error");
      }

      if (inventoryResponse?.ok) {
        const payload = (await inventoryResponse.json()) as {
          success: boolean;
          data?: { data: ProductSummary[] };
        };
        if (payload.success && payload.data) {
          setLowStockProducts(payload.data.data);
          setInventoryStatus("ready");
        } else {
          setInventoryStatus("error");
        }
      } else {
        setInventoryStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, getToken, apiBaseUrl]);

  useEffect(() => {
    if (!demo && !isLoaded) return;
    let cancelled = false;
    setSummaryStatus("loading");
    setSummary(demo ? demoFallback : null);

    void (async () => {
      try {
        const token = demo ? null : await getToken().catch(() => null);
        const path = demo ? "/api/v1/admin/demo/summary" : "/api/v1/admin/summary";
        const response = await fetch(`${apiBaseUrl}${path}`, {
          headers: token ? { authorization: `Bearer ${token}` } : {}
        });
        if (!response.ok) throw new Error("summary request failed");
        const payload = (await response.json()) as { success: boolean; data?: Summary };
        if (!payload.success || !payload.data) throw new Error("summary payload failed");
        if (cancelled) return;
        setSummary(payload.data);
        setSummaryStatus("ready");
        setStatusKey(payload.data.mode === "demo" ? "statusPublicDemo" : "statusLivePrivateAdmin");
      } catch {
        if (cancelled) return;
        if (demo) {
          setSummary(demoFallback);
          setSummaryStatus("ready");
          setStatusKey("statusOfflineDemo");
        } else {
          setSummary(null);
          setSummaryStatus("error");
          setStatusKey("statusPrivateAdmin");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [demo, isLoaded, getToken, apiBaseUrl, summaryReloadKey]);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;

    void (async () => {
      const token = await getToken().catch(() => null);
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/admin/orders?pageSize=4`, {
          headers: token ? { authorization: `Bearer ${token}` } : {}
        });
        if (cancelled) return;
        const payload = (await response.json()) as {
          success: boolean;
          data?: { data: OrderSummary[]; pagination: { total: number } };
        };
        if (payload.success && payload.data) {
          setRecentOrders(payload.data.data);
          setOrdersTotal(payload.data.pagination.total);
          setOrdersStatus("ready");
        } else {
          setOrdersStatus("error");
        }
      } catch {
        if (!cancelled) setOrdersStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, getToken, apiBaseUrl]);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;

    void (async () => {
      const token = await getToken().catch(() => null);
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/admin/users?pageSize=4`, {
          headers: token ? { authorization: `Bearer ${token}` } : {}
        });
        if (cancelled) return;
        const payload = (await response.json()) as {
          success: boolean;
          data?: { data: CustomerSummary[]; pagination: { total: number } };
        };
        if (payload.success && payload.data) {
          setRecentCustomers(payload.data.data);
          setCustomersTotal(payload.data.pagination.total);
          setCustomersStatus("ready");
        } else {
          setCustomersStatus("error");
        }
      } catch {
        if (!cancelled) setCustomersStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, getToken, apiBaseUrl]);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;

    void (async () => {
      const token = await getToken().catch(() => null);
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/admin/contact-messages`, {
          headers: token ? { authorization: `Bearer ${token}` } : {}
        });
        if (cancelled) return;
        if (response.status === 403) {
          setMessagesStatus("forbidden");
          return;
        }
        const payload = (await response.json()) as { success: boolean; data?: ContactMessage[] };
        if (payload.success && payload.data) {
          setMessages(payload.data);
          setMessagesStatus("ready");
        } else {
          setMessagesStatus("error");
        }
      } catch {
        if (!cancelled) setMessagesStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [demo, isLoaded, getToken, apiBaseUrl]);

  const metrics: Array<[string, string, LucideIcon]> = [
    [t.dashboard.metricRevenue, summary ? money(summary.revenue, locale, summary.currency, config.store.locale) : "—", PackageCheck],
    [t.dashboard.metricOrders, summary ? String(summary.orders) : "—", Boxes],
    [
      t.dashboard.metricConversion,
      summary ? (summary.conversionRate === null ? t.dashboard.metricConversionUnavailable : `${summary.conversionRate}%`) : "—",
      UsersRound
    ],
    [t.dashboard.metricLowStock, summary ? String(summary.lowStock) : "—", AlertTriangle]
  ];

  return (
    <main id="main-content" className="admin-shell py-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          {demo ? <p className="text-sm font-semibold uppercase tracking-wide text-accent-hover">{t.dashboard[statusKey]}</p> : null}
          <h1 className={`${demo ? "mt-1 " : ""}text-3xl font-semibold tracking-tight text-ink`}>{demo ? t.dashboard.publicDemoAdmin : t.dashboard.home}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">{t.dashboard.subtitle}</p>
        </div>
        <button
          type="button"
          disabled={demo}
          onClick={() => void exportOrdersCsv(apiBaseUrl, getToken)}
          className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={17} aria-hidden />
          {t.dashboard.exportOrdersCsv}
        </button>
      </div>

      {summary?.notice ? (
        <section className="mt-5 rounded-lg border border-warning/25 bg-warning-soft p-4 text-sm text-ink">
          <div className="flex gap-3">
            <Shield size={18} aria-hidden className="mt-0.5 shrink-0 text-warning" />
            <p className="font-semibold">{summary.notice[locale]}</p>
          </div>
        </section>
      ) : null}

      {summaryStatus === "error" ? (
        <div className="mt-5">
          <ErrorState
            action={
              <button
                type="button"
                onClick={() => setSummaryReloadKey((current) => current + 1)}
                className="focus-ring mt-2 min-h-9 rounded-md border border-danger/30 px-3 font-semibold hover:bg-danger/10"
              >
                {t.common.retry}
              </button>
            }
          />
        </div>
      ) : null}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label={t.dashboard.metricsLabel}>
        {metrics.map(([label, value, Icon]) => (
          <Metric key={label} label={label} value={value} icon={Icon} loading={summaryStatus === "loading"} />
        ))}
      </section>

      <section id="products" className="mt-6 rounded-lg border border-border bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="text-base font-semibold text-ink">{t.dashboard.productsHeading}</h2>
            <p className="text-sm text-ink-muted">
              {productsStatus === "loading"
                ? t.common.loading
                : countSubtitle(productsTotal, t.dashboard.productsCountOne, t.dashboard.productsCountOther, t.dashboard.productsSubtitleFallback)}
            </p>
          </div>
          <a
            href="/products/"
            className="focus-ring min-h-9 shrink-0 rounded-md border border-border-strong px-3 text-sm font-semibold leading-9 text-ink hover:bg-surface-hover"
          >
            {t.common.viewAll}
          </a>
        </div>
        {productsStatus === "loading" ? (
          <div className="grid gap-2 p-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="skeleton h-12 rounded-md" />
            ))}
          </div>
        ) : productsStatus === "error" ? (
          <p className="p-4 text-sm text-ink-muted">{t.errors.couldNotLoad}</p>
        ) : recentProducts.length === 0 ? (
          <EmptyState title={t.dashboard.noProductsYetTitle} description={t.dashboard.noProductsYetDescription} />
        ) : (
          recentProducts.map((product) => (
            <div key={product.id} className="grid gap-3 border-b border-border p-4 last:border-b-0 md:grid-cols-[1fr_140px_180px] md:items-center">
              <div>
                <h3 className="font-medium text-ink">{product.name}</h3>
                <p className="text-sm text-ink-muted">SKU {product.sku}</p>
              </div>
              <StatusBadge tone={stockStatus(product, t).tone}>{stockStatus(product, t).label}</StatusBadge>
              <a
                href={`/products/edit/?id=${encodeURIComponent(product.id)}`}
                className="focus-ring inline-flex min-h-9 items-center justify-center rounded-md border border-border-strong px-3 text-sm font-semibold text-ink hover:bg-surface-hover"
              >
                {t.dashboard.editProduct}
              </a>
            </div>
          ))
        )}
      </section>

      <section id="inventory" className="mt-6 rounded-lg border border-border bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="text-base font-semibold text-ink">{t.dashboard.inventoryHeading}</h2>
            <p className="text-sm text-ink-muted">
              {summary
                ? (summary.lowStock === 1 ? t.dashboard.inventoryCountOne : t.dashboard.inventoryCountOther).replace("{count}", String(summary.lowStock))
                : summaryStatus === "loading"
                  ? t.common.loading
                  : t.errors.couldNotLoad}
            </p>
          </div>
          <a
            href="/inventory/"
            className="focus-ring min-h-9 shrink-0 rounded-md border border-border-strong px-3 text-sm font-semibold leading-9 text-ink hover:bg-surface-hover"
          >
            {t.common.viewAll}
          </a>
        </div>
        {inventoryStatus === "loading" ? (
          <div className="grid gap-2 p-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="skeleton h-12 rounded-md" />
            ))}
          </div>
        ) : inventoryStatus === "error" ? (
          <p className="p-4 text-sm text-ink-muted">{t.errors.couldNotLoad}</p>
        ) : lowStockProducts.length === 0 ? (
          <EmptyState title={t.dashboard.nothingRunningLowTitle} description={t.dashboard.nothingRunningLowDescription} />
        ) : (
          lowStockProducts.map((product) => (
            <div key={product.id} className="grid gap-3 border-b border-border p-4 last:border-b-0 md:grid-cols-[1fr_140px_180px] md:items-center">
              <div>
                <h3 className="font-medium text-ink">{product.name}</h3>
                <p className="text-sm text-ink-muted">SKU {product.sku}</p>
              </div>
              <span className={`text-sm font-semibold tabular-nums ${product.stock <= 0 ? "text-danger" : "text-warning"}`}>
                {t.dashboard.leftThreshold.replace("{count}", String(product.stock)).replace("{threshold}", String(product.lowStockThreshold))}
              </span>
              <a
                href="/inventory/"
                className="focus-ring inline-flex min-h-9 items-center justify-center rounded-md border border-border-strong px-3 text-sm font-semibold text-ink hover:bg-surface-hover"
              >
                {t.dashboard.adjustStock}
              </a>
            </div>
          ))
        )}
      </section>

      <section id="orders" className="mt-6 rounded-lg border border-border bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="text-base font-semibold text-ink">{t.dashboard.ordersHeading}</h2>
            <p className="text-sm text-ink-muted">
              {countSubtitle(ordersTotal, t.dashboard.ordersCountOne, t.dashboard.ordersCountOther, t.dashboard.ordersSubtitleFallback)}
            </p>
          </div>
          <a
            href="/orders/"
            className="focus-ring min-h-9 shrink-0 rounded-md border border-border-strong px-3 text-sm font-semibold leading-9 text-ink hover:bg-surface-hover"
          >
            {t.common.viewAll}
          </a>
        </div>
        {ordersSectionBody(ordersStatus, recentOrders, t)}
      </section>

      <section id="customers" className="mt-6 rounded-lg border border-border bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="text-base font-semibold text-ink">{t.dashboard.customersHeading}</h2>
            <p className="text-sm text-ink-muted">
              {countSubtitle(customersTotal, t.dashboard.customersCountOne, t.dashboard.customersCountOther, t.dashboard.customersSubtitleFallback)}
            </p>
          </div>
          <a
            href="/customers/"
            className="focus-ring min-h-9 shrink-0 rounded-md border border-border-strong px-3 text-sm font-semibold leading-9 text-ink hover:bg-surface-hover"
          >
            {t.common.viewAll}
          </a>
        </div>
        {customersSectionBody(customersStatus, recentCustomers, t)}
      </section>

      <section id="messages" className="mt-6 rounded-lg border border-border bg-surface">
        <div className="border-b border-border p-4">
          <h2 className="text-base font-semibold text-ink">{t.dashboard.contactMessagesHeading}</h2>
          <p className="text-sm text-ink-muted">{t.dashboard.contactMessagesSubtitle}</p>
        </div>
        {messagesSectionBody(messagesStatus, messages, demo, openMessageId, (id) => setOpenMessageId(openMessageId === id ? null : id), locale, t)}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <a href="/coupons/" className="focus-ring rounded-lg border border-border bg-surface p-5 transition hover:border-border-strong hover:bg-surface-hover">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <TicketPercent size={17} aria-hidden />
            {t.dashboard.couponsHeading}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">{t.dashboard.couponsDescription}</p>
        </a>
        <a href="/reviews/" className="focus-ring rounded-lg border border-border bg-surface p-5 transition hover:border-border-strong hover:bg-surface-hover">
          <h2 className="text-base font-semibold text-ink">{t.dashboard.reviewsHeading}</h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">{t.dashboard.reviewsDescription}</p>
        </a>
        <a href="/activity/" className="focus-ring rounded-lg border border-border bg-surface p-5 transition hover:border-border-strong hover:bg-surface-hover">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <History size={17} aria-hidden />
            {t.dashboard.activityHeading}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">{t.dashboard.activityDescription}</p>
        </a>
        <a href="/settings/" className="focus-ring rounded-lg border border-border bg-surface p-5 transition hover:border-border-strong hover:bg-surface-hover">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <Settings size={17} aria-hidden />
            {t.dashboard.settingsHeading}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">{t.dashboard.settingsDescription}</p>
        </a>
      </section>
    </main>
  );
}
