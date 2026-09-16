# 城市运营监控中心

面向运营团队的多城市经营监控与专题诊断工具。数据模型覆盖日度经营、补贴投放和渠道留存；看板支持城市/日期筛选、预警识别与分维度诊断。

## 本地运行

```bash
npm run db:load
npm run check
npm run api
```

打开 `http://127.0.0.1:8787`。此模式下前端数据来自 SQLite 数据服务：`/api/daily`、`/api/subsidies`、`/api/retention`。

## 数据模型

- `daily_operations`：城市日度订单、交易、履约与骑手指标
- `subsidy_dimensions`：补贴类型、用户类型、品类维度的补贴明细
- `channel_retention`：渠道活跃、复购、消费与获客成本指标

数据库文件由内置数据快照构建，不随代码提交；可通过 `npm run db:load` 重建。
