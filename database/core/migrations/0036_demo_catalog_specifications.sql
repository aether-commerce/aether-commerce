-- Replace catalog placeholders only when the product still has the seeded value.
-- This keeps administrator edits made before deployment intact.
UPDATE products
SET details_json = json_set(
      details_json,
      '$.specs.Potencia', CASE WHEN json_extract(details_json, '$.specs.Potencia') = 'Ver nombre del modelo' THEN '30 W' ELSE json_extract(details_json, '$.specs.Potencia') END,
      '$.highlights[0]', CASE WHEN json_extract(details_json, '$.highlights[0]') = 'Potencia: Ver nombre del modelo' THEN 'Potencia: 30 W' ELSE json_extract(details_json, '$.highlights[0]') END
    ),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'cargador-gan-30w'
  AND (json_extract(details_json, '$.specs.Potencia') = 'Ver nombre del modelo'
    OR json_extract(details_json, '$.highlights[0]') = 'Potencia: Ver nombre del modelo');

UPDATE products
SET details_json = json_set(
      details_json,
      '$.specs.Potencia', CASE WHEN json_extract(details_json, '$.specs.Potencia') = 'Ver nombre del modelo' THEN '45 W' ELSE json_extract(details_json, '$.specs.Potencia') END,
      '$.highlights[0]', CASE WHEN json_extract(details_json, '$.highlights[0]') = 'Potencia: Ver nombre del modelo' THEN 'Potencia: 45 W' ELSE json_extract(details_json, '$.highlights[0]') END
    ),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'cargador-dual-usb-c-45w'
  AND (json_extract(details_json, '$.specs.Potencia') = 'Ver nombre del modelo'
    OR json_extract(details_json, '$.highlights[0]') = 'Potencia: Ver nombre del modelo');

UPDATE products
SET details_json = json_set(
      details_json,
      '$.specs.Potencia', CASE WHEN json_extract(details_json, '$.specs.Potencia') = 'Ver nombre del modelo' THEN '15 W' ELSE json_extract(details_json, '$.specs.Potencia') END,
      '$.highlights[0]', CASE WHEN json_extract(details_json, '$.highlights[0]') = 'Potencia: Ver nombre del modelo' THEN 'Potencia: 15 W' ELSE json_extract(details_json, '$.highlights[0]') END
    ),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'cargador-inalambrico-15w'
  AND (json_extract(details_json, '$.specs.Potencia') = 'Ver nombre del modelo'
    OR json_extract(details_json, '$.highlights[0]') = 'Potencia: Ver nombre del modelo');

UPDATE products
SET details_json = json_set(
      details_json,
      '$.specs.Potencia', CASE WHEN json_extract(details_json, '$.specs.Potencia') = 'Ver nombre del modelo' THEN '20 W' ELSE json_extract(details_json, '$.specs.Potencia') END,
      '$.highlights[0]', CASE WHEN json_extract(details_json, '$.highlights[0]') = 'Potencia: Ver nombre del modelo' THEN 'Potencia: 20 W' ELSE json_extract(details_json, '$.highlights[0]') END
    ),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'cargador-de-auto-20w'
  AND (json_extract(details_json, '$.specs.Potencia') = 'Ver nombre del modelo'
    OR json_extract(details_json, '$.highlights[0]') = 'Potencia: Ver nombre del modelo');

UPDATE products
SET details_json = json_set(
      details_json,
      '$.specs.Potencia', CASE WHEN json_extract(details_json, '$.specs.Potencia') = 'Ver nombre del modelo' THEN '65 W' ELSE json_extract(details_json, '$.specs.Potencia') END,
      '$.highlights[0]', CASE WHEN json_extract(details_json, '$.highlights[0]') = 'Potencia: Ver nombre del modelo' THEN 'Potencia: 65 W' ELSE json_extract(details_json, '$.highlights[0]') END
    ),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'cargador-gan-65w'
  AND (json_extract(details_json, '$.specs.Potencia') = 'Ver nombre del modelo'
    OR json_extract(details_json, '$.highlights[0]') = 'Potencia: Ver nombre del modelo');

UPDATE products
SET details_json = json_set(
      details_json,
      '$.specs.Potencia', CASE WHEN json_extract(details_json, '$.specs.Potencia') = 'Ver nombre del modelo' THEN '10 W' ELSE json_extract(details_json, '$.specs.Potencia') END,
      '$.highlights[0]', CASE WHEN json_extract(details_json, '$.highlights[0]') = 'Potencia: Ver nombre del modelo' THEN 'Potencia: 10 W' ELSE json_extract(details_json, '$.highlights[0]') END
    ),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'cargador-inalambrico-stand-10w'
  AND (json_extract(details_json, '$.specs.Potencia') = 'Ver nombre del modelo'
    OR json_extract(details_json, '$.highlights[0]') = 'Potencia: Ver nombre del modelo');

UPDATE products
SET details_json = json_set(
      details_json,
      '$.specs.Capacidad', CASE WHEN json_extract(details_json, '$.specs.Capacidad') = 'Ver nombre del modelo' THEN '10.000 mAh' ELSE json_extract(details_json, '$.specs.Capacidad') END,
      '$.highlights[0]', CASE WHEN json_extract(details_json, '$.highlights[0]') = 'Capacidad: Ver nombre del modelo' THEN 'Capacidad: 10.000 mAh' ELSE json_extract(details_json, '$.highlights[0]') END
    ),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'power-bank-10000mah'
  AND (json_extract(details_json, '$.specs.Capacidad') = 'Ver nombre del modelo'
    OR json_extract(details_json, '$.highlights[0]') = 'Capacidad: Ver nombre del modelo');

UPDATE products
SET details_json = json_set(
      details_json,
      '$.specs.Capacidad', CASE WHEN json_extract(details_json, '$.specs.Capacidad') = 'Ver nombre del modelo' THEN '20.000 mAh' ELSE json_extract(details_json, '$.specs.Capacidad') END,
      '$.highlights[0]', CASE WHEN json_extract(details_json, '$.highlights[0]') = 'Capacidad: Ver nombre del modelo' THEN 'Capacidad: 20.000 mAh' ELSE json_extract(details_json, '$.highlights[0]') END
    ),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'power-bank-20000mah'
  AND (json_extract(details_json, '$.specs.Capacidad') = 'Ver nombre del modelo'
    OR json_extract(details_json, '$.highlights[0]') = 'Capacidad: Ver nombre del modelo');

UPDATE products
SET details_json = json_set(
      details_json,
      '$.specs.Capacidad', CASE WHEN json_extract(details_json, '$.specs.Capacidad') = 'Ver nombre del modelo' THEN '5.000 mAh' ELSE json_extract(details_json, '$.specs.Capacidad') END,
      '$.highlights[0]', CASE WHEN json_extract(details_json, '$.highlights[0]') = 'Capacidad: Ver nombre del modelo' THEN 'Capacidad: 5.000 mAh' ELSE json_extract(details_json, '$.highlights[0]') END
    ),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'power-bank-slim-5000mah'
  AND (json_extract(details_json, '$.specs.Capacidad') = 'Ver nombre del modelo'
    OR json_extract(details_json, '$.highlights[0]') = 'Capacidad: Ver nombre del modelo');

UPDATE products
SET details_json = json_set(
      details_json,
      '$.specs.Capacidad', CASE WHEN json_extract(details_json, '$.specs.Capacidad') = 'Ver nombre del modelo' THEN '15.000 mAh' ELSE json_extract(details_json, '$.specs.Capacidad') END,
      '$.highlights[0]', CASE WHEN json_extract(details_json, '$.highlights[0]') = 'Capacidad: Ver nombre del modelo' THEN 'Capacidad: 15.000 mAh' ELSE json_extract(details_json, '$.highlights[0]') END
    ),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'power-bank-solar-15000mah'
  AND (json_extract(details_json, '$.specs.Capacidad') = 'Ver nombre del modelo'
    OR json_extract(details_json, '$.highlights[0]') = 'Capacidad: Ver nombre del modelo');

UPDATE products
SET details_json = json_set(
      details_json,
      '$.specs.Capacidad', CASE WHEN json_extract(details_json, '$.specs.Capacidad') = 'Ver nombre del modelo' THEN '5.000 mAh' ELSE json_extract(details_json, '$.specs.Capacidad') END,
      '$.highlights[0]', CASE WHEN json_extract(details_json, '$.highlights[0]') = 'Capacidad: Ver nombre del modelo' THEN 'Capacidad: 5.000 mAh' ELSE json_extract(details_json, '$.highlights[0]') END
    ),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'power-bank-magsafe-5000mah'
  AND (json_extract(details_json, '$.specs.Capacidad') = 'Ver nombre del modelo'
    OR json_extract(details_json, '$.highlights[0]') = 'Capacidad: Ver nombre del modelo');