import { isFileIdToken } from '@objectstack/spec/data';
import type { Plugin, PluginContext } from '@objectstack/core';
import type { IApprovalService, IObjectQLEngine, IStorageService } from '@objectstack/spec/contracts';
import type { ExecutionContext } from '@objectstack/spec/kernel';

const CONTRACT_OBJECT = 'forge_sales_contract';
const LEDGER_OBJECT = 'forge_sales_contract_revision_material';
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const SYSTEM_CONTEXT: ExecutionContext = { isSystem: true, positions: [], permissions: [] };
export const CONTRACT_REVISION_MATERIAL_SERVICE = 'forge.contract.revision.material';

export interface RevisionFileReference {
  fileId: string;
  name: string;
  sha256: string;
}

export interface ContractRevisionMaterialInput {
  requestId: string;
  returnVersion: string;
  sourceMaterialVersion: string;
  idempotencyKey: string;
  primary: RevisionFileReference;
  attachments: RevisionFileReference[];
}

export interface ContractRevisionBinding {
  bindingId: string;
  returnVersion: string;
  sourceMaterialVersion: string;
  newVersionDigest: string;
  idempotencyKey: string;
  contractId: string;
  requestId: string;
  repeated: boolean;
}

interface VerifiedFile extends RevisionFileReference { bytes: number }
type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const result = value.trim();
  return result && result.length <= max && !result.includes('\0') ? result : undefined;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const object = value as JsonRecord;
  return `{${Object.keys(object).sort().filter((key) => object[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
}

async function digest(value: Uint8Array | string): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const copied = new Uint8Array(bytes.byteLength);
  copied.set(bytes);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', copied.buffer);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function approvalPayloadVersion(value: unknown): Promise<string> {
  if (!record(value)) throw new Error('REVISION_MATERIAL_INVALID: approval payload is unavailable');
  return digest(canonicalJson(value));
}

function parseFile(value: unknown): RevisionFileReference {
  const input = record(value);
  const fileId = text(input?.fileId, 128);
  const name = text(input?.name, 255);
  const sha256 = text(input?.sha256, 64)?.toLowerCase();
  if (!fileId || !isFileIdToken(fileId) || !name || !sha256 || !SHA256.test(sha256)) {
    throw new Error('REVISION_MATERIAL_INVALID: a file reference is incomplete');
  }
  return { fileId, name, sha256 };
}

export function parseContractRevisionMaterialInput(value: unknown): ContractRevisionMaterialInput {
  const input = record(value);
  const requestId = text(input?.requestId, 128);
  const returnVersion = text(input?.returnVersion, 128);
  const sourceMaterialVersion = text(input?.sourceMaterialVersion, 64)?.toLowerCase();
  const idempotencyKey = text(input?.idempotencyKey, 64);
  if (!requestId || !returnVersion || !sourceMaterialVersion || !SHA256.test(sourceMaterialVersion) ||
      !idempotencyKey || !UUID.test(idempotencyKey) || !Array.isArray(input?.attachments) || input.attachments.length > 10) {
    throw new Error('REVISION_MATERIAL_INVALID: revision identity or attachments are invalid');
  }
  const primary = parseFile(input.primary);
  const attachments = input.attachments.map(parseFile);
  const ids = [primary, ...attachments].map((file) => file.fileId);
  if (new Set(ids).size !== ids.length) throw new Error('REVISION_MATERIAL_INVALID: duplicate file reference');
  return { requestId, returnVersion, sourceMaterialVersion, idempotencyKey, primary, attachments };
}

async function verifyFiles(
  engine: IObjectQLEngine, storage: IStorageService, actorId: string, contractId: string,
  files: RevisionFileReference[],
): Promise<VerifiedFile[]> {
  const rows = await engine.find('sys_file', {
    where: { id: { $in: files.map((file) => file.fileId) } },
    fields: ['id', 'key', 'name', 'mime_type', 'size', 'status', 'owner_id', 'ref_object', 'ref_id'],
    limit: files.length,
  }, { context: SYSTEM_CONTEXT });
  const byId = new Map((rows ?? []).map((row) => [String(row.id), row]));
  const verified: VerifiedFile[] = [];
  let total = 0;
  for (const expected of files) {
    const file = byId.get(expected.fileId);
    const hasReference = file && (file.ref_object != null || file.ref_id != null);
    if (!file || file.status !== 'committed' || file.owner_id !== actorId ||
      file.name !== expected.name || file.mime_type !== 'text/plain' ||
      typeof file.key !== 'string' || !Number.isInteger(file.size) || file.size < 0 || file.size > MAX_FILE_BYTES ||
      hasReference && (file.ref_object !== CONTRACT_OBJECT || String(file.ref_id ?? '') !== contractId)) {
      throw new Error('REVISION_MATERIAL_UNAVAILABLE: a file is unavailable to this employee and contract');
    }
    const bytes = await storage.download(file.key);
    if (bytes.length !== file.size || bytes.length > MAX_FILE_BYTES || await digest(bytes) !== expected.sha256) {
      throw new Error('REVISION_MATERIAL_MISMATCH: file bytes differ from the frozen material');
    }
    try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { throw new Error('REVISION_MATERIAL_INVALID: text file is not valid UTF-8'); }
    total += bytes.length;
    if (total > MAX_TOTAL_BYTES) throw new Error('REVISION_MATERIAL_TOO_LARGE: material bundle exceeds the limit');
    verified.push({ ...expected, bytes: bytes.length });
  }
  return verified;
}

export class ContractRevisionMaterialService {
  private readonly approvals: IApprovalService;
  private readonly engine: IObjectQLEngine;
  private readonly storage: IStorageService;

  constructor(
    approvals: IApprovalService,
    engine: IObjectQLEngine,
    storage: IStorageService,
  ) {
    this.approvals = approvals;
    this.engine = engine;
    this.storage = storage;
  }

  async prepare(rawInput: unknown, context: ExecutionContext): Promise<ContractRevisionBinding> {
    const input = parseContractRevisionMaterialInput(rawInput);
    const actorId = text(context.userId, 128);
    if (!actorId) throw new Error('FORBIDDEN: employee identity is required');
    const request = await this.approvals.getRequest(input.requestId, context);
    if (!request || request.status !== 'returned' || request.viewer?.is_submitter !== true ||
        request.submitter_id !== actorId || request.object_name !== CONTRACT_OBJECT || !request.record_id || !record(request.payload)) {
      throw new Error('REVISION_NOT_AVAILABLE: returned approval is not assigned to this employee');
    }
    const actions = await this.approvals.listActions(input.requestId, context);
    const latestReturn = [...actions].reverse().find((action) => action.action === 'revise');
    if (!latestReturn || latestReturn.id !== input.returnVersion ||
        await approvalPayloadVersion(request.payload) !== input.sourceMaterialVersion) {
      throw new Error('REVISION_STALE: approval opinion or source material has changed');
    }
    const current = await this.engine.findOne(CONTRACT_OBJECT, { where: { id: request.record_id } }, { context: SYSTEM_CONTEXT });
    if (!current || current.status !== 'pending_approval') throw new Error('REVISION_STALE: contract state has changed');
    const [primary, ...attachments] = await verifyFiles(this.engine, this.storage, actorId, request.record_id,
      [input.primary, ...input.attachments]);
    const manifest = { primary, attachments };
    const newVersionDigest = await digest(canonicalJson(manifest));
    const savedAt = new Date().toISOString();

    const fromExisting = (existing: JsonRecord): ContractRevisionBinding => {
      if (existing.approval_request_id !== input.requestId || existing.idempotency_key !== input.idempotencyKey ||
          existing.return_version !== input.returnVersion || existing.source_material_version !== input.sourceMaterialVersion ||
          existing.new_version_digest !== newVersionDigest || existing.submitted_by !== actorId) {
        throw new Error('REVISION_CONFLICT: this request key or returned approval already has another material version');
      }
      return {
        bindingId: String(existing.id), returnVersion: input.returnVersion,
        sourceMaterialVersion: input.sourceMaterialVersion, newVersionDigest,
        idempotencyKey: input.idempotencyKey, contractId: request.record_id, requestId: input.requestId,
        repeated: true,
      };
    };

    try {
      return await this.engine.transaction(async (transactionContext) => {
        const scoped = { context: transactionContext };
        const approval = await this.engine.findOne('sys_approval_request', { where: { id: input.requestId } }, scoped);
        if (!approval || approval.status !== 'returned' || approval.object_name !== CONTRACT_OBJECT ||
            approval.record_id !== request.record_id || approval.submitter_id !== actorId ||
            await approvalPayloadVersion(approval.payload) !== input.sourceMaterialVersion) {
          throw new Error('REVISION_STALE: approval changed while material was prepared');
        }
        const existing = await this.engine.findOne(LEDGER_OBJECT, { where: { approval_request_id: input.requestId } }, scoped);
        if (existing) return fromExisting(existing);
        const reusedKey = await this.engine.findOne(LEDGER_OBJECT, { where: { idempotency_key: input.idempotencyKey } }, scoped);
        if (reusedKey) throw new Error('REVISION_CONFLICT: this request key was already used for another approval');
        const bindingId = globalThis.crypto.randomUUID();
        await this.engine.insert(LEDGER_OBJECT, {
          id: bindingId, name: String(current.code || current.name || '合同') + ' 修订材料',
          contract_id: request.record_id, approval_request_id: input.requestId,
          return_version: input.returnVersion, source_material_version: input.sourceMaterialVersion,
          new_version_digest: newVersionDigest, idempotency_key: input.idempotencyKey,
          primary_file_id: primary.fileId, primary_name: primary.name, primary_sha256: primary.sha256,
          attachment_manifest: JSON.stringify(attachments), submitted_by: actorId, submitted_at: savedAt,
        }, scoped);
        return {
          bindingId, returnVersion: input.returnVersion, sourceMaterialVersion: input.sourceMaterialVersion,
          newVersionDigest, idempotencyKey: input.idempotencyKey,
          contractId: request.record_id, requestId: input.requestId, repeated: false,
        };
      }, SYSTEM_CONTEXT, { require: true });
    } catch (error) {
      // A competing transaction may have committed the exact same binding
      // after our read. Query the unique approval key before reporting failure.
      const existing = await this.engine.findOne(LEDGER_OBJECT, { where: { approval_request_id: input.requestId } }, { context: SYSTEM_CONTEXT });
      if (existing) return fromExisting(existing);
      throw error;
    }
  }
}

/** Registers the domain material validator; it does not resume approvals. */
export class ContractRevisionMaterialPlugin implements Plugin {
  name = 'com.inocube.forge.contract-revision-material';
  version = '1.0.0';
  type = 'standard' as const;
  dependencies = ['com.objectstack.service.approvals'];

  init(ctx: PluginContext): void {
    ctx.hook('kernel:ready', () => {
      const approvals = ctx.getService<IApprovalService>('approvals');
      const engine = ctx.getService<IObjectQLEngine>('objectql');
      const storage = ctx.getService<IStorageService>('storage');
      ctx.registerService(CONTRACT_REVISION_MATERIAL_SERVICE,
        new ContractRevisionMaterialService(approvals, engine, storage));
    });
  }
}
