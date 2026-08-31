"use client";

export default function NotFoundPage() {
  return (
    <main className="aether-shell grid min-h-[calc(100vh-4rem)] place-items-center py-12">
      <section className="rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">404</p>
        <h1 className="mt-3 text-3xl font-semibold text-zinc-950">Page not found</h1>
        <p className="mt-3 text-zinc-600">The page you requested does not exist.</p>
      </section>
    </main>
  );
}
