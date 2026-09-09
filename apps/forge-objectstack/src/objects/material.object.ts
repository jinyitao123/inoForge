import { Field } from '@objectstack/spec/data';
import { master, text, code, reference, choice, owner, remarks, status, money } from '../model.js';

// Prices belong to the SKU, per DP009/2071.
export const Material = master('forge_material', '物料管理', 'package', {
  name: text('物料名称', true), code: code('物料编码'), model: text('物料型号', true), barcode: text('物料条码'),
  category_id: reference('forge_material_category', '物料分类', true), brand: text('品牌'), purchase_category: text('采购分类'),
  unit_id: reference('forge_unit', '单位', true),
  property: choice('物料属性', ['原材料', '半成品', '成品', '贸易商品', '消耗品', '服务', '备件', '包装材料'], '原材料'),
  source_type: choice('来源类型', ['采购', '自制', '外协', '虚拟'], '采购'), status: status(),
  supplier_id: reference('forge_supplier', '默认供应商'), tax_category_code: text('税收分类编码'),
  warehouse_id: reference('forge_warehouse', '默认仓库'), responsible_id: owner(),
  loss_rate: Field.number({ label: '损耗率', defaultValue: 0 }), bom_enabled: Field.boolean({ label: '启用BOM', defaultValue: false }),
  batch_enabled: Field.boolean({ label: '启用批次管理', defaultValue: false }), trace_enabled: Field.boolean({ label: '启用追溯管理', defaultValue: false }),
  tags: text('标签'), remarks: remarks(),
}, ['code', 'name', 'model', 'category_id', 'unit_id', 'property', 'source_type', 'status']);

export const MaterialSku = master('forge_material_sku', '物料规格', 'boxes', {
  name: text('规格', true), code: code('SKU编码'), barcode: text('SKU条码'),
  material_id: reference('forge_material', '物料', true), sale_price: money('含税售价', 4), cost_price: money('含税成本价', 4),
  enabled: Field.boolean({ label: '启用', defaultValue: true }),
}, ['code', 'material_id', 'name', 'sale_price', 'cost_price', 'enabled']);
