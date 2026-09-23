# 逐页交付合同与验收记录模板

2026-09-23 起按 Forge 业务目标验收，外部产品仅作参考。占位内容不构成证据。本模板的新 JSON 为待实现的 schemaVersion 3 契约，现有机器门禁仍只实现旧版本；见[交付标准](../forge-page-delivery-standard.md)。

## 批次和范围

- 功能编号 / 所属应用及包 / 业务链 / 维护负责人 / 独立复核者：
- 起始提交 / 分支 / 工作树 / FORGE_URL / 持久数据库类型与标识：
- 范围来源：岗位任务、导航、页面、内部跳转、Action、设置及结果使用者。
- 本批要求、前置条件、依赖应用、排除项与依据、下一步：
- 当前分类：需求待明确 / 未实现 / 入口缺失 / 流程断开 / 数据权限错误 / 仅缺证据。

## 逐页设计

- surfaceType（object/dashboard/report/component/action/page）/ 目标对象、视图或定义 / pageId（仅自定义 Page 必填）/ 应用及旧新入口 / 旧收藏、通知与详情链接兼容：
- 岗位 / 主任务 / 主单据 / 正式来源 / 下一岗位及结果：
- 需求来源：用户目标 / 客户规则 / Forge 决策 / 可选外部参考（日期、采用内容及限制）：
- 主原型 / Forge 设计基线版本、截图与材料 / 首屏顺序 / 主操作：
- 字段、筛选、分页、金额/数量口径、状态、阻断、异常和恢复：
- 依赖设置：维护方、组织范围、权限、生效版本、实际消费者与在途业务：
- 桌面/侧栏展开/窄屏、有数据/空态/错误/受限/提交中/弹窗；长文本与最多动作的几何检查：
- 性能：冷打开、刷新、切页、关键请求数、体积、重复读取及重挂载：

| 要求编号 | 来源与明确决定 | 区域/控件及实现 | 操作步骤 | 预期结果 | 实际结果与证据 | 状态/缺口 |
| --- | --- | --- | --- | --- | --- | --- |
| REQ-001 | 待填写 | | | | | pending |

不以隐藏控件删除已采用要求。只读或无表单页面可说明具体不适用项，需提供职责依据并经复核。

## 验收与交接

- requirements / visual / interaction / business / permissions / persistence / performance 分别记录结果。
- 正常路径、关键异常、角色、独立回读、API 辅助、同一持久数据库重启、工程检查：
- 业务设置修改保存、独立/重启读回、实际生效、无权拒绝与旧单版本：
- 独立复核者、日期、复现和退回缺陷；未发生如实写待复核。
- 已证明、未证明、复用证据与理由、阻塞和下一动作；耗时/费用无可靠来源写未知。

## 拟实施的结构化记录

待 schemaVersion 3 门禁及测试实现后才能用于机器 accepted。当前可以先记录 Markdown 人工审查和部分证据，manifest 保持 review_required，不能改成 schemaVersion 2 并伪造双侧截图。

```json
{
  "schemaVersion": 3,
  "featureId": "REPLACE",
  "app": "REPLACE",
  "surfaceType": "page",
  "target": "REPLACE",
  "pageId": "page_REPLACE",
  "archetype": "task_workspace",
  "reviewedRevision": "",
  "subjectFiles": {},
  "environment": { "forgeUrl": "", "databaseType": "", "database": "", "materials": "" },
  "designBaseline": { "revision": "", "evidence": [] },
  "referenceEvidence": [],
  "checks": {
    "requirements": { "status": "pending", "evidence": [] },
    "visual": { "status": "pending", "evidence": [] },
    "interaction": { "status": "pending", "evidence": [] },
    "business": { "status": "pending", "evidence": [] },
    "permissions": { "status": "pending", "evidence": [] },
    "persistence": { "status": "pending", "evidence": [] },
    "performance": { "status": "pending", "evidence": [] }
  },
  "requirements": [],
  "settingsConsumers": [],
  "review": { "implementer": "", "reviewer": "", "reviewedAt": "", "status": "pending", "evidence": [] }
}
```

记录真实提交和受验文件摘要，覆盖页面、依赖组件、对象/动作、导航、设置消费者和基线。页面改动后重验影响维度，不把证据文件自身放进 subjectFiles 造成循环。文件路径真实存在、内容非空、敏感信息脱敏。证据版本变化不会自动更新旧页面状态。
