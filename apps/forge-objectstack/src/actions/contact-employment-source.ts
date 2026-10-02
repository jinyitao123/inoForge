/** Shared immutable employment snapshot used by native hooks and guarded Actions. */
export const contactEmploymentSnapshotSource = String.raw`
async function appendEmploymentSnapshot(record) {
  const organizationId = String(record.organization_id || ''), ownerId = String(record.owner_id || ''), contactId = String(record.id || '');
  if (!organizationId || !ownerId || !contactId) throw new Error('任职轨迹缺少有效联系人归属');
  const journal = ctx.api.object('forge_contact_employment');
  const revision = Number(record.employment_revision || 0), key = contactId + ':' + revision;
  const prior = await journal.findOne({ where: { change_key: key, organization_id: organizationId } });
  if (prior) return;
  const customer = record.customer_id ? await ctx.api.object('forge_customer').findOne({ where: { id: record.customer_id, organization_id: organizationId } }) : null;
  const company = String(record.current_company_name || customer && customer.name || record.customer_name || '').trim();
  if (!company) throw new Error('任职轨迹缺少公司名称');
  const effectiveOn = String(record.employment_changed_on || record.created_at || new Date().toISOString()).slice(0,10);
  await journal.insert({ name: (company + ' · ' + effectiveOn).slice(0,255), contact_id: contactId, change_key: key,
    company_name: company, customer_id: record.current_customer_id || record.customer_id || null,
    employment_status: record.employment_status || 'active', department: record.department || null,
    job_title: record.job_title || null, effective_on: effectiveOn, note: record.employment_note || null,
    recorded_by: ctx.session && ctx.session.userId || ownerId, owner_id: ownerId, organization_id: organizationId });
}
`;
