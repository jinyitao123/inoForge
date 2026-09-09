import { Field } from '@objectstack/spec/data';
import { master, text, code, reference, choice, remarks, required } from '../model.js';

// DP014/2085 rejected an unnamed root; 2089-2092 establish persisted draft structure.
export const Bom = master('forge_bom', 'BOM管理', 'git-branch', {
  name: text('BOM名称', true), code: code('BOM编号'), product_name: text('产品/设备'),
  material_id: reference('forge_material', '成品物料'), bom_type: choice('BOM类型', ['标准', '项目', '试制'], '标准'),
  version: { ...text('当前版本'), defaultValue: 'V1.0' },
  status: { ...choice('状态', ['草稿'], '草稿'), readonly: true }, remarks: remarks(),
}, ['code', 'name', 'product_name', 'bom_type', 'version', 'status']);

export const BomNode = master('forge_bom_node', 'BOM结构', 'network', {
  name: text('节点名称', true), bom_id: reference('forge_bom', 'BOM', true),
  parent_id: reference('forge_bom_node', '父节点'), sku_id: reference('forge_material_sku', '物料规格'),
  node_type: choice('节点类型', ['根节点', '物料', '分组', '子BOM'], '物料'),
  quantity: Field.number({ label: '单机用量', defaultValue: 1, ...required }), position: text('位号'),
  loss_rate: Field.number({ label: '损耗率', defaultValue: 0 }),
  is_key_part: Field.boolean({ label: '是否关键件', defaultValue: false }), is_leaf: Field.boolean({ label: '是否末级件', defaultValue: true }),
  sort_order: Field.number({ label: '排序', defaultValue: 0 }), remarks: remarks(),
}, ['name', 'bom_id', 'parent_id', 'sku_id', 'node_type', 'quantity', 'position', 'is_key_part']);
