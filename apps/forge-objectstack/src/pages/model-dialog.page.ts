/** Shared footer for model forms rendered in a portal, using host density tokens. */
export const modelDialogRuntime = `
function ForgeModelDialogFooter({busy,requestClose,onSave,label='保存修改'}){
 const base={height:'var(--ui-control-height,28px)',padding:'0 var(--space-3,12px)',border:'1px solid hsl(var(--border))',borderRadius:'var(--ui-control-radius,5px)',background:'hsl(var(--background))',color:'hsl(var(--foreground))',fontSize:'var(--ui-control-font-size,12px)',cursor:busy?'wait':'pointer',opacity:busy?0.6:1};
 return <div style={{display:'flex',justifyContent:'flex-end',gap:'var(--space-2,8px)'}}><button type="button" disabled={busy} onClick={requestClose} style={base}>取消</button><button type="button" disabled={busy} onClick={onSave} style={{...base,background:'hsl(var(--primary))',borderColor:'hsl(var(--primary))',color:'hsl(var(--primary-foreground))'}}>{busy?'保存中…':label}</button></div>
}
`;
