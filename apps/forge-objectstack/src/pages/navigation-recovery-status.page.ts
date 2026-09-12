const statusPage = (title: string, scope: string, entries: string[]) => `
function App(){
  const entries=${JSON.stringify(entries)};
  const colors={bg:'hsl(var(--background))',card:'hsl(var(--card))',border:'hsl(var(--border))',text:'hsl(var(--foreground))',muted:'hsl(var(--muted-foreground))',accent:'hsl(var(--primary))'};
  return <main style={{minHeight:'100%',background:colors.bg,color:colors.text,padding:'24px'}}>
    <div style={{maxWidth:'1040px',margin:'0 auto'}}>
      <div style={{fontSize:'12px',color:colors.muted,marginBottom:'8px'}}>Forge / ${scope}</div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'16px',marginBottom:'20px'}}>
        <div>
          <h1 style={{fontSize:'24px',fontWeight:650,margin:'0 0 6px'}}>${title}</h1>
          <div style={{fontSize:'13px',color:colors.muted}}>RISEMAP 菜单结构已保留，业务页面尚未进入实现与验收。</div>
        </div>
        <span style={{border:'1px solid '+colors.border,borderRadius:'4px',padding:'6px 10px',fontSize:'12px',color:colors.muted}}>待复刻</span>
      </div>
      <section style={{background:colors.card,border:'1px solid '+colors.border,borderRadius:'6px',padding:'18px'}}>
        <h2 style={{fontSize:'15px',margin:'0 0 14px'}}>RISEMAP 已观察入口</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:'8px'}}>
          {entries.map(entry=><div key={entry} style={{border:'1px solid '+colors.border,borderRadius:'4px',padding:'10px 12px',fontSize:'13px'}}>{entry}</div>)}
        </div>
      </section>
    </div>
  </main>;
}
`;

export const WorkspaceRecoveryStatusPage = {
  name: 'page_workspace_recovery_status',
  label: '工作台复刻状态',
  description: '工作台、AI 广场、引导中心和待办管理的复刻状态',
  icon: 'layout-dashboard',
  type: 'app' as const,
  kind: 'react' as const,
  source: statusPage('工作台复刻状态', '工作台', ['工作台', 'AI 广场', '引导中心', '待办管理']),
};

export const AdministrationRecoveryStatusPage = {
  name: 'page_administration_recovery_status',
  label: '行政复刻状态',
  description: '审批、行政、人事、考勤与流程中心的复刻状态',
  icon: 'building',
  type: 'app' as const,
  kind: 'react' as const,
  source: statusPage('行政复刻状态', '行政', ['审批中心', '行政管理', '人力资源', '考勤假期', '流程中心']),
};
