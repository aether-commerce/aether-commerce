"use client";

import { useEffect, useMemo, useState } from "react";
import { useStorefrontConfig } from "./AetherStorefrontProvider";
import { useAetherAuth } from "./AetherAuthProvider";

type ConfirmState = "idle" | "confirming" | "created" | "existing" | "missing-session" | "error";

export function CheckoutSuccessClient() {
  const { apiBaseUrl } = useStorefrontConfig();
  const { getToken, isLoaded, isSignedIn } = useAetherAuth();
  const [state, setState] = useState<ConfirmState>("idle");
  const [orderNumber, setOrderNumber] = useState<string>("");

  // Stripe returns session_id (from the {CHECKOUT_SESSION_ID} template in the
  // success_url); Wompi's checkout redirect appends the transaction id as
  // `id` (or `transaction_id` on some integrations) instead. /checkout/confirm
  // only needs *a* provider-specific session identifier - it resolves which
  // provider is active server-side, so this page never needs to know which
  // one ran.
  const sessionId = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    const params = new URLSearchParams(window.location.search);
    return params.get("session_id") ?? params.get("id") ?? params.get("transaction_id") ?? "";
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (!sessionId) {
      setState("missing-session");
      return;
    }
    if (!isSignedIn) {
      setState("error");
      return;
    }

    let active = true;
    setState("confirming");
    getToken()
      .then((token) =>
        fetch(`${apiBaseUrl}/api/v1/checkout/confirm`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(token ? { authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ sessionId })
        })
      )
      .then((response) => response.json() as Promise<{ success?: boolean; data?: { created?: boolean; order?: { number?: string } } }>)
      .then((payload) => {
        if (!active) {
          return;
        }
        if (!payload.success) {
          setState("error");
          return;
        }
        setOrderNumber(payload.data?.order?.number ?? "");
        setState(payload.data?.created ? "created" : "existing");
      })
      .catch(() => {
        if (active) {
          setState("error");
        }
      });

    return () => {
      active = false;
    };
  }, [getToken, isLoaded, isSignedIn, sessionId, apiBaseUrl]);

  const label =
    state === "confirming"
      ? "Checking payment"
      : state === "created"
        ? "Order created"
        : state === "existing"
          ? "Order already confirmed"
          : state === "missing-session"
          ? "Unable to verify payment"
            : state === "error"
              ? "Payment not confirmed"
              : "Checkout status";

  const body =
    state === "confirming"
      ? "We are checking the payment and saving your order."
      : state === "created"
        ? `Your order${orderNumber ? ` ${orderNumber}` : ""} was saved successfully.`
        : state === "existing"
          ? `Your order${orderNumber ? ` ${orderNumber}` : ""} was already saved.`
          : state === "missing-session"
            ? "The payment provider returned without a transaction ID. Check your order history before trying again."
            : state === "error"
              ? "We could not verify the payment or save the order. Check your order history before trying again."
              : "Your order status will appear here after the payment provider returns.";

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6">
      <p className="text-sm font-semibold uppercase text-cyan-300">{label}</p>
      <h1 className="mt-2 text-4xl font-semibold">Checkout status</h1>
      <p className="mt-4 text-zinc-600">{body}</p>
    </section>
  );
}
