import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { prepareSalesLineSkuNullability } from '../sales-line-sku-preflight.mjs';

const databaseUrl = process.env.FORGE_SALES_LINE_TEST_DATABASE_URL;
const tables = ['forge_sales_contract_line', 'forge_sales_order_line'];

test('sales line preflight relaxes only legacy sku_id nullability and is repeatable', { skip: !databaseUrl }, async () => {
  const target = new URL(databaseUrl);
  assert.ok(['localhost', '127.0.0.1'].includes(target.hostname));
  assert.match(target.pathname, /^\/forge_sales_line_preflight_[a-z0-9_]+$/);

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    for (const table of tables) await client.query(`DROP TABLE IF EXISTS ${table}`);

    const empty = await prepareSalesLineSkuNullability(databaseUrl);
    assert.deepEqual(empty, { changed: false, tables: [] }, 'fresh installs have no sales-line table to alter');

    for (const table of tables) {
      await client.query(`CREATE TABLE ${table} (
        id text PRIMARY KEY,
        line_type varchar(32) NOT NULL,
        sku_id varchar(128) NOT NULL
      )`);
      await client.query(`INSERT INTO ${table} (id, line_type, sku_id) VALUES ('existing-material', 'material', 'sku-existing')`);
    }

    const migrated = await prepareSalesLineSkuNullability(databaseUrl);
    assert.equal(migrated.changed, true);
    assert.deepEqual(migrated.tables.sort(), [...tables].sort());

    const columns = (await client.query(`SELECT table_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = ANY($1::text[])
        AND column_name = 'sku_id'
      ORDER BY table_name`, [tables])).rows;
    assert.equal(columns.length, 2);
    assert.ok(columns.every(column => column.is_nullable === 'YES'));

    const preserved = await Promise.all(tables.map(async table => {
      const rows = await client.query(`SELECT id, line_type, sku_id FROM ${table} WHERE id = 'existing-material'`);
      return rows.rows[0];
    }));
    assert.deepEqual(preserved, tables.map(() => ({ id: 'existing-material', line_type: 'material', sku_id: 'sku-existing' })));

    for (const table of tables) {
      await client.query(`INSERT INTO ${table} (id, line_type, sku_id) VALUES ('service-row', 'service', NULL)`);
      const service = await client.query(`SELECT line_type, sku_id FROM ${table} WHERE id = 'service-row'`);
      assert.deepEqual(service.rows[0], { line_type: 'service', sku_id: null });
    }

    assert.deepEqual(await prepareSalesLineSkuNullability(databaseUrl), {
      changed: false,
      tables: [...tables],
    }, 'a second boot preflight must be a no-op');
  } finally {
    for (const table of tables) await client.query(`DROP TABLE IF EXISTS ${table}`);
    await client.end();
  }
});

test('the image starts both schema preflights before the serving process', async () => {
  const start = await readFile(new URL('../start-with-migrations.sh', import.meta.url), 'utf8');
  const dockerfile = await readFile(new URL('../../Dockerfile', import.meta.url), 'utf8');
  const migrationCall = start.indexOf('sales-line-sku-preflight.mjs');
  const serverExec = start.indexOf('exec "$@"');
  assert.ok(migrationCall >= 0 && migrationCall < serverExec, 'sales line migration must finish before serving');
  assert.match(dockerfile, /scripts\/sales-line-sku-preflight\.mjs/);
  assert.match(dockerfile, /scripts\/schema\/sales-line-sku-nullability\.sql/);
});
