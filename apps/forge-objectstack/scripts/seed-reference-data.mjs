import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { connect } from './api-client.mjs';

export const snapshotPath = fileURLToPath(new URL('../../../docs/standard-test-data/risemap-oem-v0.1-observed-master-data.json', import.meta.url));
export async function seedReferenceData() {
  const fixture = JSON.parse(await readFile(snapshotPath, 'utf8'));
  const api = await connect();
  const ids = { operator: api.userId };
  const results = [];
  for (const entry of fixture.records) {
    const data = Object.fromEntries(Object.entries(entry.data).map(([field, value]) => {
      if (value && typeof value === 'object' && '$ref' in value) {
        if (!ids[value.$ref]) throw new Error(`Missing fixture dependency: ${value.$ref}`);
        return [field, ids[value.$ref]];
      }
      return [field, value];
    }));
    const query = new URLSearchParams({ $filter: JSON.stringify({ [entry.matchField]: data[entry.matchField] }), $top: '100' });
    const list = await api.request(`/data/${entry.object}?${query}`);
    if (list.status !== 200) throw new Error(`Read failed ${entry.object}: ${JSON.stringify(list)}`);
    const matches = list.value.records.filter(record => record[entry.matchField] === data[entry.matchField]);
    if (matches.length > 1) throw new Error(`Duplicate fixture key ${entry.key}`);
    const result = matches.length
      ? await api.request(`/data/${entry.object}/${matches[0].id}`, 'PATCH', data)
      : await api.request(`/data/${entry.object}`, 'POST', data);
    if (result.status < 200 || result.status >= 300) throw new Error(`Write failed ${entry.key}: ${JSON.stringify(result)}`);
    ids[entry.key] = result.value.id || result.value.record?.id || result.value.data?.id || result.value.data?.record?.id || matches[0]?.id;
    if (!ids[entry.key]) throw new Error(`Missing saved ID: ${entry.key}`);
    results.push({ key: entry.key, object: entry.object, id: ids[entry.key], evidence: entry.evidence, operation: matches.length ? 'update' : 'create' });
  }
  await mkdir('.objectstack/acceptance', { recursive: true });
  await writeFile('.objectstack/acceptance/reference-data.json', JSON.stringify({ fixtureId: fixture.fixtureId, seededAt: new Date().toISOString(), results }, null, 2));
  return { api, fixture, ids, results };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { results } = await seedReferenceData();
  console.log(`Reference data saved: ${results.length} linked records. IDs saved locally; no credentials written.`);
}
