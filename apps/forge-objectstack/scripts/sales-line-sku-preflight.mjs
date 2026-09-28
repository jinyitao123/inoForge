import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SqlDriver } from '@objectstack/driver-sql';

const tables = ['forge_sales_contract_line', 'forge_sales_order_line'];
const migration = new URL('./schema/sales-line-sku-nullability.sql', import.meta.url);

// The object metadata already makes sku_id optional so service lines remain
// first-class scope. Older PostgreSQL tables retained NOT NULL from an earlier
// schema; widen those legacy columns before the app accepts business writes.
export async function prepareSalesLineSkuNullability(databaseUrl) {
  if (!databaseUrl || !/^postgres(?:ql)?:\/\//.test(databaseUrl)) {
    throw Object.assign(new Error('PostgreSQL is required for the deployment preflight.'), { code: 'FORGE_DATABASE_REQUIRED' });
  }

  const driver = new SqlDriver({ client: 'pg', connection: databaseUrl, pool: { min: 0, max: 1 } });
  try {
    await driver.connect();
    const before = [];
    for (const table of tables) {
      const result = await driver.execute(`SELECT data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = '${table}'
          AND column_name = 'sku_id'`);
      const column = result.rows[0];
      if (!column) continue; // Fresh installs get nullable columns from current metadata at app boot.
      if (!['character varying', 'text'].includes(column.data_type)) {
        throw Object.assign(new Error('Unexpected sales line SKU column type.'), { code: 'FORGE_SALES_LINE_SKU_SCHEMA_UNSUPPORTED' });
      }
      before.push({ table, nullable: column.is_nullable === 'YES' });
    }

    const changed = before.some(row => !row.nullable);
    if (changed) await driver.execute(await readFile(migration, 'utf8'));

    const verified = [];
    for (const { table } of before) {
      const result = await driver.execute(`SELECT is_nullable
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = '${table}'
          AND column_name = 'sku_id'`);
      if (result.rows[0]?.is_nullable !== 'YES') {
        throw Object.assign(new Error('Sales line SKU nullability verification failed.'), { code: 'FORGE_SALES_LINE_SKU_SCHEMA_INVALID' });
      }
      verified.push(table);
    }

    return { changed, tables: verified };
  } finally {
    await driver.disconnect();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = await prepareSalesLineSkuNullability(process.env.OS_DATABASE_URL);
    console.log(`Forge sales line SKU nullability ${result.changed ? 'migrated and verified' : 'verified'}.`);
  } catch (error) {
    // Do not print a connection URL, driver stack, or SQL containing credentials.
    const code = typeof error?.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) ? error.code : 'PREFLIGHT_FAILED';
    console.error(`Forge sales line SKU preflight failed (${code}); application was not started.`);
    process.exitCode = 1;
  }
}
