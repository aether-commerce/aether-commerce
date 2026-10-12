# Wompi regression tests

Run the focused regression suite with `pnpm test:wompi`. It covers the Wompi checkout URL and integrity signature, transaction status mapping, sandbox API routing, webhook signature verification, approved and declined event handling, duplicate deliveries, environment mismatch rejection, and the SQLite migration that allows Wompi orders.

These tests use mocked Wompi responses and an isolated in-memory database. They run in CI without credentials, without opening a hosted checkout, and without creating transactions, so nobody needs to approve sandbox payments for every pull request.

Do not run a live Sandbox transaction against the production webhook URL. Wompi sends `transaction.updated` to the URL configured for that environment; the Sandbox and Production event URLs must be separate. A live Sandbox checkout smoke test can be enabled after Wompi Sandbox points to a dedicated test Worker and database, so test callbacks cannot create orders in production. Until that isolated callback exists, the deterministic regression suite is the automated payment check.
