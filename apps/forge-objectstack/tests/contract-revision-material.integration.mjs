import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { approvalPayloadVersion, ContractRevisionMaterialService } from '../src/plugins/contract-revision-material.ts';

const contractId = 'contract-A';
const requestId = 'approval-returned';
const mainId = '11111111-1111-4111-8111-111111111111';
const attachmentId = '22222222-2222-4222-8222-222222222222';
const requestKey = '33333333-3333-4333-8333-333333333333';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function harness() {
  const oldPayload = { submitted_material_id: 'old-file', submitted_material_sha256: 'a'.repeat(64), name: '原合同' };
  const request = {
    id: requestId, object_name: 'forge_sales_contract', record_id: contractId,
    submitter_id: 'sales-A', status: 'returned', payload: oldPayload,
    viewer: { is_submitter: true },
  };
  const files = new Map([
    [mainId, { id: mainId, key: 'main-key', name: '修订合同.txt', mime_type: 'text/plain', status: 'committed', owner_id: 'sales-A', size: 12, bytes: Buffer.from('修订合同 A', 'utf8') }],
    [attachmentId, { id: attachmentId, key: 'attachment-key', name: '技术附件.txt', mime_type: 'text/plain', status: 'committed', owner_id: 'sales-A', size: 12, bytes: Buffer.from('技术附件 A', 'utf8') }],
  ]);
  for (const file of files.values()) file.size = file.bytes.length;
  const ledger = new Map();
  const engine = {
    async find(name, query) {
      if (name !== 'sys_file') throw new Error(`unexpected collection ${name}`);
      return query.where.id.$in.map((id) => files.get(id)).filter(Boolean);
    },
    async findOne(name, query) {
      if (name === 'forge_sales_contract') return query.where.id === contractId ? { id: contractId, status: 'pending_approval', code: 'HT-A' } : null;
      if (name === 'sys_approval_request') return query.where.id === requestId ? request : null;
      if (name === 'forge_sales_contract_revision_material') {
        if (query.where.approval_request_id) return ledger.get(query.where.approval_request_id) ?? null;
        if (query.where.idempotency_key) return [...ledger.values()].find((row) => row.idempotency_key === query.where.idempotency_key) ?? null;
      }
      return null;
    },
    async transaction(callback, _context, options) {
      assert.equal(options.require, true);
      return callback({ isSystem: true }, { owned: true });
    },
    async insert(name, row) {
      assert.equal(name, 'forge_sales_contract_revision_material');
      if (ledger.has(row.approval_request_id)) throw new Error('unique approval key');
      ledger.set(row.approval_request_id, structuredClone(row));
      return row;
    },
  };
  const approvals = {
    async getRequest(id) { return id === requestId ? request : null; },
    async listActions() { return [{ id: 'return-action-A', action: 'revise', comment: '请修改验收条款' }]; },
  };
  const storage = {
    async download(key) { return Buffer.from([...files.values()].find((file) => file.key === key)?.bytes ?? []); },
  };
  const service = new ContractRevisionMaterialService(approvals, engine, storage);
  const input = {
    requestId, returnVersion: 'return-action-A', sourceMaterialVersion: await approvalPayloadVersion(oldPayload),
    idempotencyKey: requestKey,
    primary: { fileId: mainId, name: files.get(mainId).name, sha256: sha256(files.get(mainId).bytes) },
    attachments: [{ fileId: attachmentId, name: files.get(attachmentId).name, sha256: sha256(files.get(attachmentId).bytes) }],
  };
  return { service, request, files, ledger, input, context: { userId: 'sales-A', positions: [], permissions: [] } };
}

test('returned submitter prepares one exact material version and same request reuses it', async () => {
  const { service, ledger, input, context } = await harness();
  const first = await service.prepare(input, context);
  assert.equal(first.repeated, false);
  assert.equal(first.requestId, requestId);
  assert.match(first.bindingId, /^[0-9a-f-]{36}$/);
  assert.match(first.newVersionDigest, /^[0-9a-f]{64}$/);
  assert.equal(ledger.size, 1);
  const repeated = await service.prepare(input, context);
  assert.equal(repeated.repeated, true);
  assert.equal(repeated.bindingId, first.bindingId);
  assert.equal(ledger.size, 1);
});

test('same returned request cannot bind a different material or a different request key', async () => {
  const { service, ledger, input, context } = await harness();
  await service.prepare(input, context);
  await assert.rejects(service.prepare({ ...input, idempotencyKey: '44444444-4444-4444-8444-444444444444' }, context), /REVISION_CONFLICT/);
  await assert.rejects(service.prepare({ ...input, attachments: [] }, context), /REVISION_CONFLICT/);
  assert.equal(ledger.size, 1);
});

test('foreign owner, changed bytes and stale return decision cannot create a binding', async () => {
  const { service, files, ledger, input, context } = await harness();
  await assert.rejects(service.prepare(input, { ...context, userId: 'other-employee' }), /REVISION_NOT_AVAILABLE/);
  files.get(mainId).owner_id = 'other-employee';
  await assert.rejects(service.prepare(input, context), /REVISION_MATERIAL_UNAVAILABLE/);
  files.get(mainId).owner_id = 'sales-A';
  files.get(mainId).bytes[0] = 0x58;
  await assert.rejects(service.prepare(input, context), /REVISION_MATERIAL_MISMATCH/);
  files.get(mainId).bytes[0] = Buffer.from('修订合同 A', 'utf8')[0];
  await assert.rejects(service.prepare({ ...input, returnVersion: 'older-return' }, context), /REVISION_STALE/);
  assert.equal(ledger.size, 0);
});
