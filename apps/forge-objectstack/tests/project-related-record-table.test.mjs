import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {transformSync}=createRequire(require.resolve('@objectstack/cli'))('esbuild');
import vm from 'node:vm';
import test from 'node:test';
import {ProjectCenterPage} from '../src/pages/project-center.page.ts';
const code=transformSync(ProjectCenterPage.source.replace('export default App;','export default ProjectRelatedRecordTable;'),{loader:'jsx',format:'cjs'}).code;
test('project related rows preserve action cells and page the complete visible dataset',()=>{
 let page=1;const React={Children:{toArray:children=>children},createElement:(type,props,...children)=>({type,props:{...props,children:children.flat()}}),useState:()=>[page,next=>{page=next}]};const module={exports:{}};
 vm.runInNewContext(code,{React,module,exports:module.exports,RecordTable:'RecordTable'});
 const marker={type:'button',props:{children:['Open record']}},rows=Array.from({length:23},(_,index)=>({key:'r'+index,props:{children:[{props:{children:'Record '+index}},{props:{children:marker}}]}}));
 function table(){const tree=module.exports.default({headers:['Name','Actions'],rows});return tree.props.children.find(child=>child.type==='RecordTable').props.schema}
 let schema=table();assert.equal(schema.rowCount,23);assert.equal(schema.data.length,10);assert.equal(schema.columns[1].cell(null,schema.data[0]),marker);schema.onPageChange(3);schema=table();assert.equal(schema.page,3);assert.equal(schema.data.length,3);assert.equal(schema.columns[0].cell(null,schema.data[0]),'Record 20');
});
