const bomPageSource = `
function App() {
  const [state, setState] = React.useState({ loading: true, boms: [], bom: null, nodes: [], logs: [], analyses: [], analysis: null, shortageLines: [], projects: {}, customers: {}, materials: {}, error: '' });
  const [tab, setTab] = React.useState('基础资料');
  const [busy, setBusy] = React.useState(false);
  const [plannedQuantity, setPlannedQuantity] = React.useState(1);
  const query = new URLSearchParams(window.location.search);

  async function request(path, options) {
    const response = await fetch('/api/v1' + path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || payload.message || '请求失败');
    return payload;
  }
  async function load(preferredId) {
    try {
      const list = await request('/data/forge_bom?$top=100');
      const boms = list.records || [];
      const id = preferredId || query.get('id') || boms.find(item => item.status === 'active' && item.bom_type === 'project')?.id || boms[0]?.id;
      const bom = boms.find(item => item.id === id) || (id ? (await request('/data/forge_bom/' + id)).record : null);
      if (!bom) return setState(s => ({ ...s, loading: false, boms, error: '暂无 BOM' }));
      const enc = encodeURIComponent(JSON.stringify({ bom_id: bom.id }));
      const [nodeData, logData, analysisData, projectData, customerData, materialData] = await Promise.all([
        request('/data/forge_bom_node?$filter=' + enc + '&$top=100'),
        request('/data/forge_bom_approval_log?$filter=' + enc + '&$top=100'),
        request('/data/forge_bom_shortage_analysis?$filter=' + enc + '&$top=100'),
        bom.project_id ? request('/data/forge_project/' + bom.project_id) : Promise.resolve({}),
        bom.customer_id ? request('/data/forge_customer/' + bom.customer_id) : Promise.resolve({}),
        bom.material_id ? request('/data/forge_material/' + bom.material_id) : Promise.resolve({}),
      ]);
      const projects = bom.project_id ? { [bom.project_id]: projectData.record } : {};
      const customers = bom.customer_id ? { [bom.customer_id]: customerData.record } : {};
      const materials = bom.material_id ? { [bom.material_id]: materialData.record } : {};
      const analyses = (analysisData.records || []).sort((a,b) => String(b.analyzed_at).localeCompare(String(a.analyzed_at)));
      const analysis = analyses[0] || null;
      const shortageLines = analysis ? ((await request('/data/forge_bom_shortage_line?$filter=' + encodeURIComponent(JSON.stringify({ analysis_id: analysis.id })) + '&$top=100')).records || []) : [];
      if (analysis) setPlannedQuantity(Number(analysis.planned_quantity || 1));
      setState({ loading: false, boms, bom, nodes: nodeData.records || [], logs: logData.records || [], analyses, analysis, shortageLines, projects, customers, materials, error: '' });
    } catch (error) { setState(s => ({ ...s, loading: false, error: String(error.message || error) })); }
  }
  React.useEffect(() => { load(); }, []);

  async function runAction(action, params) {
    if (!state.bom) return;
    setBusy(true);
    try {
      await request('/actions/forge_bom/' + action + '/' + state.bom.id, { method: 'POST', body: JSON.stringify({ params: params || {} }) });
      await load(state.bom.id);
    } catch (error) { window.alert(String(error.message || error)); }
    finally { setBusy(false); }
  }
  async function analyzeShortage() {
    const quantity = Number(plannedQuantity);
    if (!(quantity > 0)) return window.alert('计划生产数量必须大于0');
    await runAction('bom_analyze_shortage', { planned_quantity: quantity });
  }
  function primaryAction() {
    const bom = state.bom;
    if (!bom) return null;
    if (bom.status === 'draft') return <button className="primary" disabled={busy} onClick={() => runAction('bom_submit_review')}>提交评审</button>;
    if (bom.status === 'pending_review') return <button className="primary" disabled={busy} onClick={() => { const comment = window.prompt('评审意见'); if (comment) runAction('bom_review', { decision: 'approve', comment }); }}>评审BOM</button>;
    if (bom.status === 'active') return <button className="primary" disabled={busy} onClick={() => { const note = window.prompt('版本变更说明'); if (note) runAction('bom_copy_new_version', { change_note: note }); }}>复制到新版本</button>;
    return null;
  }
  const statusText = { draft: '草稿', pending_review: '待评审', active: '已生效', inactive: '已失效', archived: '已归档' };
  const typeText = { standard: '标准', project: '项目', prototype: '试制' };
  const logText = { submitted: '提交评审', approved: '评审通过', rejected: '评审退回', copied: '复制新版本', invalidated: '失效', created: '创建' };
  const tabs = ['基础资料', 'BOM结构', '缺料分析', '版本历史', '应用/引用', '审批日志', '图纸关联'];
  const bom = state.bom;
  const root = state.nodes.find(node => !node.parent_id);
  const children = state.nodes.filter(node => node.parent_id);
  const fmtDate = value => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';

  const css = \`
  div:has(> .forge-bom){max-width:none!important;margin:0!important}.forge-bom+*{display:none}div:has(> .forge-bom)>div:first-child:not(.forge-bom){display:none}main:has(.forge-bom)>div{padding:0!important}.forge-bom{min-height:100%;background:#f5f6f8;color:#20242b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',sans-serif}.crumb{height:38px;display:flex;align-items:center;gap:8px;padding:0 18px;color:#7b8492;font-size:12px;border-bottom:1px solid #e8ebef;background:#fff}.page-head{background:#fff;padding:12px 18px 0;border-bottom:1px solid #e2e6eb}.head-row{display:flex;justify-content:space-between;gap:18px}.title-line{display:flex;align-items:center;gap:8px}.title-line h1{font-size:16px;line-height:23px;margin:0;font-weight:650}.pill{font-size:11px;padding:2px 7px;border-radius:4px;background:#eef1f4;color:#606a78;white-space:nowrap}.pill.green{background:#e9f7ef;color:#16834b}.meta{display:flex;gap:7px;align-items:center;margin:5px 0 12px;color:#6e7785;font-size:12px}.dot{width:3px;height:3px;border-radius:50%;background:#aab1bb}.actions{display:flex;gap:8px;align-items:flex-start}.actions button,.tabbar button,.switcher button{font:inherit}.actions button{height:32px;border:1px solid #d8dde4;background:#fff;border-radius:4px;padding:0 12px;color:#343b46;cursor:pointer;white-space:nowrap}.actions .primary{background:#1769e0;border-color:#1769e0;color:#fff}.actions button:disabled{opacity:.55}.tabbar{display:flex;gap:26px}.tabbar button{border:0;background:none;padding:10px 1px 11px;color:#5d6674;cursor:pointer;border-bottom:2px solid transparent;font-size:13px}.tabbar button.active{color:#1769e0;border-bottom-color:#1769e0;font-weight:600}.content{display:grid;grid-template-columns:218px minmax(0,1fr);gap:14px;padding:14px 18px 36px}.side,.panel{background:#fff;border:1px solid #e2e6eb;border-radius:5px}.side{padding:10px}.side-title{font-size:12px;color:#8a93a0;margin:2px 8px 8px}.bom-item{width:100%;text-align:left;border:0;background:transparent;border-radius:4px;padding:8px 9px;cursor:pointer}.bom-item.active{background:#eaf2ff;color:#155fc7}.bom-code{font-size:11px;margin-top:3px;color:#8b94a1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.panel{padding:18px 22px;min-height:430px}.section-title{font-size:14px;font-weight:650;margin-bottom:15px;display:flex;justify-content:space-between}.grid{display:grid;grid-template-columns:1fr 1fr;column-gap:34px;row-gap:14px}.field label{display:block;color:#7b8491;font-size:12px;margin-bottom:6px}.value{min-height:32px;border:1px solid #dfe3e8;border-radius:4px;background:#fbfcfd;padding:6px 9px;font-size:13px;box-sizing:border-box}.value.link{color:#1769e0}.wide{grid-column:1/-1}.summary{display:flex;gap:28px;padding:13px 16px;margin-bottom:18px;background:#f7f9fb;border-radius:5px;font-size:13px}.summary strong{font-size:16px;margin-left:5px}.tree{border:1px solid #e1e5ea;border-radius:6px;overflow:hidden}.tree-head,.tree-row{display:grid;grid-template-columns:minmax(250px,1.5fr) 110px 105px 100px 100px;padding:10px 14px;align-items:center}.tree-head{background:#f7f8fa;color:#7b8491;font-size:12px}.tree-row{border-top:1px solid #edf0f3;font-size:13px}.tree-name.child{padding-left:28px}.key{display:inline-block;margin-left:7px;padding:1px 5px;border-radius:3px;background:#fff2dc;color:#a65b00;font-size:11px}.analysis-controls{display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #e8ebef}.analysis-controls label{font-size:12px;color:#6e7785}.analysis-controls input{width:82px;height:32px;border:1px solid #d8dde4;border-radius:4px;padding:0 9px}.analysis-controls button{height:32px;margin-left:auto;border:0;border-radius:4px;padding:0 15px;background:#1769e0;color:#fff;cursor:pointer}.metrics{display:grid;grid-template-columns:repeat(5,minmax(110px,1fr));gap:10px;margin-bottom:14px}.metric{background:#f7f8fa;border-radius:5px;padding:13px;text-align:center}.metric strong{display:block;font-size:19px;color:#20242b}.metric.warn strong{color:#d44931}.metric span{font-size:11px;color:#7b8491}.shortage-table{overflow:auto;border:1px solid #e1e5ea;border-radius:5px}.shortage-table table{border-collapse:collapse;width:100%;min-width:980px;font-size:12px}.shortage-table th,.shortage-table td{padding:9px 10px;border-bottom:1px solid #edf0f3;text-align:left;white-space:nowrap}.shortage-table th{background:#f7f8fa;color:#6d7683;font-weight:500}.shortage-table tr.shortage{background:#fff7f5}.shortage-table td.bad{color:#d44931;font-weight:600}.analysis-time{margin-top:10px;color:#8a93a0;font-size:11px}.empty{text-align:center;color:#9ba3ae;padding:78px 20px}.timeline{position:relative;margin-left:8px}.event{display:grid;grid-template-columns:14px 160px 1fr;gap:10px;padding:0 0 22px}.event-dot{width:9px;height:9px;border-radius:50%;background:#1769e0;margin-top:5px;box-shadow:0 0 0 4px #eaf2ff}.event-title{font-weight:600}.event-note{color:#687280;font-size:13px}.notice{margin:16px 24px;padding:10px 14px;background:#fff3cd;border:1px solid #ffe49a;border-radius:5px;color:#7c5a00}.loading{padding:80px;text-align:center;color:#77808d}@media(max-width:900px){.content{grid-template-columns:1fr}.side{display:none}.grid{grid-template-columns:1fr}.wide{grid-column:auto}.metrics{grid-template-columns:1fr 1fr}.tree-head,.tree-row{grid-template-columns:1fr 80px 80px}.tree-head span:nth-child(n+4),.tree-row span:nth-child(n+4){display:none}}
  \`;
  if (state.loading) return <div className="forge-bom"><style>{css}</style><div className="loading">正在加载 BOM…</div></div>;
  return <div className="forge-bom"><style>{css}</style>
    <div className="crumb"><span>计划与方案设计</span><span>/</span><span>BOM管理</span><span>/</span><b>{bom?.name || 'BOM详情'}</b></div>
    {state.error && <div className="notice">{state.error}</div>}
    {bom && <>
      <div className="page-head"><div className="head-row"><div>
        <div className="title-line"><h1>{bom.name}</h1></div>
        <div className="meta"><span className="pill">{typeText[bom.bom_type] || bom.bom_type}</span><span className={'pill ' + (bom.status === 'active' ? 'green' : '')}>{statusText[bom.status] || bom.status}</span><span>{bom.version}</span><span className="dot"></span><span>{bom.product_name}</span>{bom.source_bom_id && <><span className="dot"></span><span>派生自标准BOM</span></>}</div>
      </div><div className="actions"><button onClick={() => setTab('基础资料')}>基本信息</button><button onClick={() => load(bom.id)}>刷新</button>{bom.status === 'active' && <button onClick={() => { const reason = window.prompt('失效原因'); if (reason) runAction('bom_invalidate', { reason }); }}>失效</button>}{primaryAction()}</div></div>
      <div className="tabbar">{tabs.map(name => <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>{name}</button>)}</div></div>
      <div className="content"><aside className="side"><div className="side-title">BOM 版本</div>{state.boms.map(item => <button key={item.id} className={'bom-item ' + (item.id === bom.id ? 'active' : '')} onClick={() => { setTab('基础资料'); load(item.id); }}><div>{item.name}</div><div className="bom-code">{item.version} · {statusText[item.status]} · {item.code}</div></button>)}</aside>
      <main className="panel">
      {tab === '基础资料' && <><div className="section-title"><span>基础资料</span><span className="pill">基本信息</span></div><div className="grid">
        <div className="field"><label>BOM编号</label><div className="value">{bom.code}</div></div><div className="field"><label>BOM名称</label><div className="value">{bom.name}</div></div>
        <div className="field"><label>产品/设备</label><div className="value">{bom.product_name || '—'}</div></div><div className="field"><label>BOM类型</label><div className="value">{typeText[bom.bom_type]}BOM</div></div>
        <div className="field"><label>成品物料</label><div className="value link">{state.materials[bom.material_id]?.name || '—'}</div></div><div className="field"><label>客户</label><div className="value link">{state.customers[bom.customer_id]?.name || '—'}</div></div>
        <div className="field"><label>适用项目</label><div className="value link">{state.projects[bom.project_id]?.name || '—'}</div></div><div className="field"><label>版本与状态</label><div className="value">{bom.version} · {statusText[bom.status]}</div></div>
        <div className="field wide"><label>备注</label><div className="value">{bom.remarks || '—'}</div></div>
      </div></>}
      {tab === 'BOM结构' && <><div className="section-title"><span>BOM结构</span><span>展开全部</span></div><div className="summary"><span>物料种数<strong>{bom.node_count}</strong></span><span>未税总成本<strong>¥ {Number(bom.total_cost || 0).toLocaleString('zh-CN',{minimumFractionDigits:2})}</strong></span></div><div className="tree"><div className="tree-head"><span>节点/物料</span><span>节点类型</span><span>单机用量</span><span>位号</span><span>关键件</span></div>{root && <div className="tree-row"><span className="tree-name">▾ {root.name}</span><span>根节点</span><span>1</span><span>—</span><span>—</span></div>}{children.map(node => <div className="tree-row" key={node.id}><span className="tree-name child">└ {node.name}{node.is_key_part && <i className="key">关键件</i>}</span><span>{node.node_type}</span><span>{node.quantity}</span><span>{node.position || '—'}</span><span>{node.is_key_part ? '是' : '否'}</span></div>)}</div></>}
      {tab === '缺料分析' && <><div className="analysis-controls"><label>计划生产数量</label><input type="number" min="0.0001" step="1" value={plannedQuantity} onChange={event => setPlannedQuantity(event.target.value)}/><span className={'pill ' + (bom.status === 'active' ? 'green' : '')}>{statusText[bom.status]}</span><button disabled={busy || bom.status !== 'active'} onClick={analyzeShortage}>{state.analysis ? '重新分析' : '开始分析'}</button></div>{!state.analysis ? <div className="empty">设置计划生产数量后，点击“开始分析”<br/>系统将根据 BOM 结构和库存计算物料缺口</div> : <><div className="metrics"><div className={'metric ' + (state.analysis.kit_rate < 100 ? 'warn' : '')}><strong>{state.analysis.kit_rate}%</strong><span>齐套率</span></div><div className="metric"><strong>{state.analysis.component_count}</strong><span>采购件总数</span></div><div className={'metric ' + (state.analysis.shortage_count ? 'warn' : '')}><strong>{state.analysis.shortage_count}</strong><span>缺口项</span></div><div className="metric"><strong>{state.analysis.max_producible_quantity}</strong><span>最大可生产数</span></div><div className="metric warn"><strong>¥{Number(state.analysis.estimated_purchase_amount || 0).toLocaleString('zh-CN',{minimumFractionDigits:2})}</strong><span>预计采购金额</span></div></div><div className="shortage-table"><table><thead><tr><th>物料编码</th><th>名称</th><th>规格</th><th>型号</th><th>单位</th><th>单机用量</th><th>总需求</th><th>库存</th><th>锁定</th><th>可用</th><th>缺口</th><th>供应商</th><th>未税单价</th><th>小计</th></tr></thead><tbody>{state.shortageLines.map(line => <tr key={line.id} className={line.shortage_quantity > 0 ? 'shortage' : ''}><td>{line.item_code}</td><td>{line.name}</td><td>{line.specification}</td><td>{line.model}</td><td>{line.unit_name || '—'}</td><td>{line.required_per_unit}</td><td>{line.total_required}</td><td>{line.on_hand_quantity}</td><td>{line.reserved_quantity}</td><td>{line.available_quantity}</td><td className={line.shortage_quantity > 0 ? 'bad' : ''}>{line.shortage_quantity}</td><td>{line.supplier_id ? '已指定' : '—'}</td><td>¥{Number(line.untaxed_unit_price || 0).toLocaleString('zh-CN',{minimumFractionDigits:2})}</td><td>¥{Number(line.subtotal || 0).toLocaleString('zh-CN',{minimumFractionDigits:2})}</td></tr>)}</tbody></table></div><div className="analysis-time">分析时间：{fmtDate(state.analysis.analyzed_at)}</div></>}</>}
      {tab === '版本历史' && <><div className="section-title">版本历史</div><div className="tree"><div className="tree-head"><span>版本</span><span>状态</span><span>物料数</span><span>成本</span><span>生效时间</span></div>{state.boms.filter(item => item.family_key === bom.family_key || item.id === bom.id || item.source_bom_id === bom.id).map(item => <div className="tree-row" key={item.id}><span>{item.version} · {item.name}</span><span>{statusText[item.status]}</span><span>{item.node_count}</span><span>¥{item.total_cost}</span><span>{fmtDate(item.effective_at)}</span></div>)}</div></>}
      {tab === '审批日志' && <><div className="section-title">审批日志</div><div className="timeline">{state.logs.sort((a,b) => String(a.occurred_at).localeCompare(String(b.occurred_at))).map(log => <div className="event" key={log.id}><span className="event-dot"></span><span><div className="event-title">{logText[log.action] || log.action}</div><div className="event-note">{fmtDate(log.occurred_at)}</div></span><span className="event-note">{log.comment || '—'}<br/>{log.from_status} → {log.to_status}</span></div>)}</div></>}
      {['应用/引用','图纸关联'].includes(tab) && <><div className="section-title">{tab}</div><div className="empty">该页签将按 RISEMAP 实测行为继续实现，当前不计入完成范围。</div></>}
      </main></div></>}
  </div>;
}
export default App;
`;

export const BomWorkspacePage = {
  name: 'page_bom_workspace',
  label: 'BOM管理',
  description: '按 RISEMAP 页面结构实现的正式 BOM 工作台',
  icon: 'git-branch',
  type: 'app' as const,
  kind: 'react' as const,
  source: bomPageSource,
};
