-- Repair product timestamps written by SQL updates using CURRENT_TIMESTAMP.
-- SQLite stores that expression as UTC "YYYY-MM-DD HH:MM:SS", while the
-- public product schema requires ISO 8601. Keep the API read adapter as well
-- so a gradual deployment remains safe if new legacy rows appear.
UPDATE products
SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at)
WHERE created_at GLOB '????-??-?? ??:??:??*'
  AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) IS NOT NULL;

UPDATE products
SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', updated_at)
WHERE updated_at GLOB '????-??-?? ??:??:??*'
  AND strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) IS NOT NULL;
