# Wompi regression tests

Run the focused regression suite with `pnpm test:wompi`. It covers the Wompi checkout URL and integrity signature, transaction status mapping, sandbox API routing, webhook signature verification, approved and declined event handling, duplicate deliveries, environment mismatch rejection, and the SQLite migration that allows Wompi orders.

These tests use mocked Wompi responses and an isolated in-memory database. They run in CI without credentials, without opening a hosted checkout, and without creating transactions, so nobody needs to approve sandbox payments for every pull request.

Aether's production deployment is intentionally a demo storefront that showcases the production experience while using Wompi Sandbox credentials. Sandbox payments do not move real money, and the Sandbox event URL is expected to deliver `transaction.updated` callbacks to the production demo API so approved test payments can be reflected in the demo store. Keep development and production Workers, D1 databases, and Wompi event secrets isolated from one another; do not point the development Worker at production D1 or share production bindings with development.

The automated CI suite remains deterministic and does not create live transactions. A live Sandbox end-to-end smoke test may exercise the production demo when explicitly run, but it can create demo orders in production D1. Use clearly identifiable test data and follow the store's normal cleanup process for those demo orders. Never substitute live Wompi credentials or process real-money payments through this demo configuration.
