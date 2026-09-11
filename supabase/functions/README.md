# Edge Functions 源码归档

本目录是 Supabase 线上 Edge Functions 的源码快照（版本备份），**不是部署源**。
实际部署通过 Supabase MCP 完成；本目录仅供追溯与灾难恢复。

项目 ref：`apmbycvjiabnuqfmfnml`；归档日期：2026-09-11（更新时间为北京时间 UTC+8）。

## 函数清单

| 函数 | 版本 | verify_jwt | 更新时间 | 说明 |
|---|---|---|---|---|
| manage-matches | 9 | true | 2026-09-11 21:06 | 创建/更新/重置/删除比赛；淘汰赛 TBD 与晋级来源校验、改判保护 |
| update-match-result | 7 | true | 2026-09-11 21:07 | 录入比分、判定胜负、淘汰赛晋级联动，并触发重算 |
| calculate-rankings | 6 | true | 2026-09-11 21:07 | 重算排行榜（登录校验后转发 `recalc_rankings` RPC） |
| sports-settings | 5 | true | 2026-09-11 21:07 | 体育项目与计分规则（win/draw/loss/allow_draw）管理 |
| batch-import-matches | 7 | true | 2026-09-11 21:07 | 批量导入小组赛（中文名称自动转 ID、校验、重算） |
| admin-settings | 3 | false | 2026-07-07 23:49 | 公告/页脚/使用说明/邀请码的读写（前台匿名读取公告） |
| admin-logs | 2 | true | 2026-07-07 22:51 | 操作日志查询（仅超管，可按操作人/类型筛选） |
| verify-invite | 2 | false | 2026-07-07 22:51 | 注册前邀请码校验（公开调用） |
| manage-taxonomy | 2 | true | 2026-07-07 22:52 | 年级与班级的增删改（删除前做引用检查） |
| import-matches | 4 | true | 2026-07-07 22:53 | 历史遗留，已废弃（固定返回 410） |
| create-admin-user | 4 | true | 2026-07-07 22:53 | 历史遗留，已禁用（固定返回 410） |
| get-schedule | 5 | true | 2026-03-06 21:16 | 历史遗留，旧版赛程查询接口 |

## 注意事项

- `admin-settings` 与 `verify-invite` 的 verify_jwt 为 **false**（前者供前台匿名读取公告，后者供注册时校验邀请码）。若未来改用 Supabase CLI 部署，必须在 config.toml 中显式声明 `verify_jwt = false`，否则这两个功能会坏。
- `import-matches`、`create-admin-user`、`get-schedule` 三个函数前端已无引用（历史遗留），保留归档但不要删除线上版本。
- 源码统一使用 `jsr:@supabase/supabase-js@2` 直引，无 import map。
- 数据库函数 `recalc_rankings(grade_id)` 承担排行榜计算（管理各函数均通过 RPC 调用它），相关 SQL 在 Supabase migrations 中。
