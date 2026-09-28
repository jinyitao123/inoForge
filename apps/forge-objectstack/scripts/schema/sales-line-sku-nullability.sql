-- Forward-only compatibility migration for first-class service lines.
-- The current object metadata and sales actions keep material SKU validation;
-- this only relaxes the stale physical NOT NULL constraints in existing DBs.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '30s';

DO $migration$
DECLARE
  line_table text;
BEGIN
  FOREACH line_table IN ARRAY ARRAY['forge_sales_contract_line', 'forge_sales_order_line'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = line_table
        AND column_name = 'sku_id'
    ) THEN
      EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN sku_id DROP NOT NULL', current_schema(), line_table);
    END IF;
  END LOOP;
END
$migration$;

COMMIT;
