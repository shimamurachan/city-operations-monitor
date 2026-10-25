# 城市运营监控中心

面向运营团队的多城市经营监控与专题诊断工具。数据模型覆盖日度经营、补贴投放和渠道留存；看板支持城市/日期筛选、预警识别与分维度诊断。

## 本地运行

```bash
npm run db:load
npm run check
npm run api
```

打开 `http://127.0.0.1:8787`。此模式下前端数据来自 SQLite 数据服务：`/api/daily`、`/api/subsidies`、`/api/retention`。

## 在线展示

`dist/` 可发布到 GitHub Pages，提供使用脱敏聚合数据的静态看板。GitHub Pages 不运行 Node.js 与 SQLite，因此在线展示页不提供 Excel 上传或本地 API；这两项功能仍在本地运行模式下使用。

## 更新业务数据

1. 先运行 `npm run api`，打开 `http://127.0.0.1:8787/data.html`。
2. 上传未加密、15 MB 以内的 `.xlsx` 工作簿。
3. 工作簿必须包含：`订单明细`、`用户表`、`日度经营汇总`、`补贴汇总明细` 四个工作表，并保留页面列出的关键字段。

系统会校验工作簿结构、订单 ID、日期和指标边界；校验通过后，生成看板聚合数据并重建本地 SQLite 数据库。原始 Excel 不会被改写或保存到项目中。线上静态展示页仅用于查看，不能上传业务数据。

## 数据模型

- `daily_operations`：城市日度订单、交易、履约与骑手指标
- `subsidy_dimensions`：补贴类型、用户类型、品类维度的补贴明细
- `channel_retention`：渠道活跃、复购、消费与获客成本指标

数据库文件由内置数据快照构建，不随代码提交；可通过 `npm run db:load` 重建。
