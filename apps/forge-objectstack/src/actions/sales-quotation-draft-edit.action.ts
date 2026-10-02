import { defineAction } from '@objectstack/spec';

/**
 * Update only the editable header fields of the caller's own draft quotation.
 * This is deliberately a separate action from quote creation and line pricing:
 * the action gate remains `sales_quotation_draft_create`, and actor/organization ownership is checked explicitly before trusted writes.
 */
export const SalesQuotationDraftUpdateHeader = defineAction({
  name: 'sales_quotation_draft_update_header',
  label: '修改报价草稿信息',
  objectName: 'forge_quotation',
  icon: 'pencil',
  locations: [],
  visible: `record.status == 'draft'`,
  refreshAfter: true,
  requiredPermissions: ['sales_quotation_draft_create'],
  successMessage: '报价草稿已更新',
  params: [
    { name: 'expected_updated_at', label: '报价版本', type: 'text', required: true },
    { name: 'name', label: '报价名称', type: 'text' },
    { name: 'valid_until', label: '有效期至', type: 'text' },
    { name: 'payment_term', label: '付款条件', type: 'text' },
    { name: 'remarks', label: '备注', type: 'text' },
  ],
  body: {
    language: 'js',
    capabilities: ['api.read', 'api.write', 'api.transaction'],
    source: `
const id = String(ctx.recordId || (ctx.record && ctx.record.id) || '').trim();
const actor = String(ctx.session && ctx.session.userId || '').trim();
const organizationId = String(ctx.session && ctx.session.organizationId || '').trim();
if (ctx.recordLoadDenied === true) throw new Error('当前员工无权读取这份报价');
if (!id || !ctx.record || String(ctx.record.id || '') !== id) throw new Error('本次报价修改缺少可校验的目标记录');
if (!actor) throw new Error('无法识别当前销售员工');
if (!organizationId) throw new Error('无法确认当前销售组织，请重新登录后再试');

const params = ctx.input || {};
const editableKeys = ['name', 'valid_until', 'payment_term', 'remarks'];
const allowedKeys = ['expected_updated_at', ...editableKeys, 'objectName', 'recordId'];
for (const key of Object.keys(params)) {
  if (!allowedKeys.includes(key)) throw new Error('报价草稿修改包含未授权字段');
}
if (Object.prototype.hasOwnProperty.call(params, 'objectName') && params.objectName !== 'forge_quotation') throw new Error('报价修改对象与本次授权不一致');
if (Object.prototype.hasOwnProperty.call(params, 'recordId') && String(params.recordId) !== id) throw new Error('报价修改记录与本次授权不一致');
if (!Object.prototype.hasOwnProperty.call(params, 'expected_updated_at')) throw new Error('报价版本缺失，请刷新报价后重试');

const normalizeInstant = value => {
  let raw;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    raw = value.toISOString();
  } else if (typeof value === 'string') {
    raw = value.trim();
  } else {
    return null;
  }
  const match = /^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2}):(\\d{2})(?:\\.(\\d{1,9}))?(Z|[+-]\\d{2}:\\d{2})$/.exec(raw);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, , zone] = match;
  const calendarDate = year + '-' + month + '-' + day;
  const parsedDay = new Date(calendarDate + 'T00:00:00.000Z');
  if (Number.isNaN(parsedDay.getTime()) || parsedDay.toISOString().slice(0, 10) !== calendarDate) return null;
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null;
  if (zone !== 'Z') {
    const offset = /[+-](\\d{2}):(\\d{2})$/.exec(zone);
    if (!offset || Number(offset[1]) > 23 || Number(offset[2]) > 59) return null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};
const expectedUpdatedAt = normalizeInstant(params.expected_updated_at);
if (!expectedUpdatedAt) throw new Error('报价版本格式无效，请刷新报价后重试');

const has = key => Object.prototype.hasOwnProperty.call(params, key);
const optionalText = (key, label, maxLength) => {
  if (!has(key)) return { present: false };
  const raw = params[key];
  if (raw !== null && typeof raw !== 'string') throw new Error(label + '格式无效');
  const value = raw === null ? '' : raw.trim();
  if (value.length > maxLength) throw new Error(label + '长度不能超过' + maxLength + '个字符');
  return { present: true, value: value || null };
};
const patch = {};
const requestedName = optionalText('name', '报价名称', 255);
if (requestedName.present) {
  if (!requestedName.value) throw new Error('报价名称不能为空');
  patch.name = requestedName.value;
}
if (has('valid_until')) {
  if (typeof params.valid_until !== 'string') throw new Error('有效期至不能为空');
  const value = params.valid_until.trim();
  const match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(value);
  const parsed = match ? new Date(value + 'T00:00:00.000Z') : null;
  if (!match || !parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('有效期至必须是有效的 YYYY-MM-DD 日期');
  }
  patch.valid_until = value;
}
const requestedPaymentTerm = optionalText('payment_term', '付款条件', 255);
if (requestedPaymentTerm.present) patch.payment_term = requestedPaymentTerm.value;
const requestedRemarks = optionalText('remarks', '备注', 4000);
if (requestedRemarks.present) patch.remarks = requestedRemarks.value;
if (Object.keys(patch).length === 0) throw new Error('请至少修改报价名称、有效期、付款条件或备注中的一项');

const quotationObject = ctx.api.object('forge_quotation');
const readFields = [
  'id', 'organization_id', 'owner_id', 'responsible_id', 'status', 'updated_at',
  'name', 'quotation_date', 'valid_until', 'payment_term', 'remarks',
  'customer_id', 'contact_id', 'opportunity_id', 'pricing_version',
];
const normalizeDateOnly = value => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value == null ? '' : value).slice(0, 10);
};
const isCalendarDate = value => {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

return await ctx.api.transaction(async () => {
  const quote = await quotationObject.findOne({ where: { id }, fields: readFields });
  if (!quote || String(quote.organization_id || '') !== organizationId ||
      String(quote.owner_id || '') !== actor || String(quote.responsible_id || '') !== actor) {
    throw new Error('当前报价不存在或不可访问');
  }
  if (quote.status !== 'draft') throw new Error('仅本人负责的草稿报价可以修改');

  const currentUpdatedAt = normalizeInstant(quote.updated_at);
  if (!currentUpdatedAt) throw new Error('报价缺少有效的最后修改时间，不能安全保存');
  if (currentUpdatedAt !== expectedUpdatedAt) throw new Error('报价已被修改，请刷新后重新核对');
  const pricingVersion = quote.pricing_version == null ? null : Number(quote.pricing_version);
  if (pricingVersion !== null && !Number.isFinite(pricingVersion)) throw new Error('报价核价版本无效，不能安全保存');

  if (Object.prototype.hasOwnProperty.call(patch, 'valid_until')) {
    const quotationDate = normalizeDateOnly(quote.quotation_date);
    if (!isCalendarDate(quotationDate)) throw new Error('原报价日期无效，请先核对报价记录');
    if (patch.valid_until < quotationDate) throw new Error('有效期至不得早于报价日期');
  }

  // The Action context exposes the trusted ObjectQL API, not REST's
  // UpdateDataRequest.expectedVersion. Use the supported predicate-update path:
  // a payload without an id plus multi:true makes ObjectQL send one
  // conditional UPDATE whose WHERE includes the version bucket and the read
  // snapshot. updated_at may be materialized at millisecond precision while
  // PostgreSQL stores microseconds, so use the token's 1 ms interval and also
  // pin every mutable header value plus pricing_version in the same predicate.
  const expectedMs = Date.parse(expectedUpdatedAt);
  const updatedAtStart = new Date(expectedMs).toISOString();
  const updatedAtEnd = new Date(expectedMs + 1).toISOString();
  const compareWhere = {
    id,
    organization_id: organizationId,
    owner_id: actor,
    responsible_id: actor,
    status: 'draft',
    updated_at: { $gte: updatedAtStart, $lt: updatedAtEnd },
    name: quote.name == null ? null : quote.name,
    quotation_date: quote.quotation_date == null ? null : quote.quotation_date,
    valid_until: quote.valid_until == null ? null : quote.valid_until,
    payment_term: quote.payment_term == null ? null : quote.payment_term,
    remarks: quote.remarks == null ? null : quote.remarks,
    customer_id: quote.customer_id == null ? null : quote.customer_id,
    contact_id: quote.contact_id == null ? null : quote.contact_id,
    opportunity_id: quote.opportunity_id == null ? null : quote.opportunity_id,
    pricing_version: pricingVersion,
  };
  const affected = await quotationObject.update(patch, { multi: true, where: compareWhere });
  if (typeof affected !== 'number' || !Number.isFinite(affected)) {
    throw new Error('报价版本校验未返回受影响记录数；本次修改已取消，请刷新后重试');
  }
  if (affected !== 1) throw new Error('报价版本已变化，请刷新报价后重新核对');

  const updated = await quotationObject.findOne({ where: { id }, fields: readFields });
  if (!updated || String(updated.organization_id || '') !== organizationId ||
      String(updated.owner_id || '') !== actor || String(updated.responsible_id || '') !== actor ||
      updated.status !== 'draft') {
    throw new Error('报价保存后无法确认仍属于本人草稿；本次修改已取消');
  }
  const updatedAt = normalizeInstant(updated.updated_at);
  if (!updatedAt || updatedAt === currentUpdatedAt) {
    throw new Error('报价最后修改时间未推进，无法确认新版本；本次修改已取消，请稍后重试');
  }
  return {
    id,
    name: updated.name,
    valid_until: normalizeDateOnly(updated.valid_until),
    payment_term: updated.payment_term || null,
    remarks: updated.remarks || null,
    updated_at: updated.updated_at,
    pricing_version: updated.pricing_version == null ? null : updated.pricing_version,
  };
});
`,
  },
});
