# 体育赛事管理系统

一套面向中小学校的体育赛事管理系统：管理员维护年级 / 班级 / 赛程并录入比分，系统按各运动项目的积分规则自动生成 **单项排行榜** 与 **年级总排行榜**，学生和家长无需登录即可在最新的赛程与排名中实时查看。

> 默认品牌色为校徽红 `#b91c1c`，支持超级管理员自定义主题色。

## ✨ 功能特性

### 前台（公开访问，无需登录）

- 📢 **公告栏**：支持 Markdown 与图片，超管随时更新
- 🔍 **三级筛选**：年级 → 项目 → 周次 联动查询赛程
- 🏀 **赛程展示**：主客队、比分、状态（未开始 / 进行中 / 已结束）、胜负结果
- 🏆 **排行榜**：单项榜（胜 / 负 / 平 / 积分）与年级总积分榜一键切换
- 🎨 **主题色**：全站品牌色由超级管理员统一配置

### 管理后台（邮箱密码登录）

- **结果录入**：按筛选定位比赛，弹窗录入比分，保存后自动判定胜负平并重算排行榜
- **赛程管理**：单场增删改、行内编辑、批量导入（JSON / CSV，含模板下载）、导出（JSON / CSV）、批量删除（删除前自动备份）
- **项目积分**：每个运动项目独立配置 胜 / 平 / 负 分值，可关闭「允许平局」（如篮球、排球）
- **年级班级**：年级与班级的增删维护，删除时自动检查引用，防止产生孤立数据
- **公告设置**：Markdown 编辑器，编辑 / 预览双模式
- **使用说明**：面向管理员的在线操作手册（Markdown）

### 超级管理员专属

- **邀请码管理**：查看 / 修改管理员注册邀请码，修改自动记入操作日志
- **页脚设置**：自定义前台页脚文案
- **操作日志**：16 类管理操作全量审计，支持按操作人 / 操作类型筛选

## 🛠 技术栈

| 层面 | 技术 |
|---|---|
| 前端框架 | React 18 + TypeScript 5（严格模式） |
| 构建工具 | Vite 5 |
| 样式 | Tailwind CSS 3（自定义 brand 主题色） |
| 路由 | React Router 6 |
| Markdown | marked |
| 后端 | Supabase（PostgreSQL + Auth + Edge Functions） |
| 部署 | Cloudflare Pages |

## 🏗 架构说明

纯前端 SPA + Supabase BaaS 的无服务器架构，读写严格分离：

```
┌─────────────┐   anon key 只读（RLS 公开读策略）
│  React SPA  │ ────────────────────────────────▶ grades / sports / classes
│ (本仓库)     │                                    matches / rankings 等表
│             │
│             │   所有写入走 Edge Function
│             │ ────────────────────────────────▶ 9 个 Edge Functions
└─────────────┘   （函数内校验登录与权限，          （service_role 写库）
                    再操作数据库）
```

- **公开读**：赛程、排行榜、基础数据通过 anon key 直接查询，依赖数据库 RLS 公开读策略，无需登录；
- **写入收敛**：录入比分、赛程管理、系统设置等所有写操作一律经 Edge Function，服务端二次校验登录与超管权限；
- **超管判定**：基于 JWT 中的 `app_metadata.role === 'super_admin'`（服务端写入，客户端无法伪造）；
- **邀请码**：注册校验在服务端完成，前端全程不接触真实邀请码；
- **审计**：所有管理操作写入 `admin_logs`，仅超管可查。

## 🚀 快速开始

### 环境要求

- Node.js ≥ 18
- 一个 Supabase 项目（提供数据库、Auth 与 Edge Functions）

### 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的 Supabase 项目地址与 anon key：
#   VITE_SUPABASE_URL=https://<your-project>.supabase.co
#   VITE_SUPABASE_ANON_KEY=<your-anon-key>

# 3. 启动开发服务器
npm run dev

# 4. 构建生产版本（含 TypeScript 类型检查）
npm run build

# 5. 本地预览构建产物
npm run preview
```

> 环境变量缺失时应用会在启动时直接报错并给出明确提示，避免部署后难以排查。

### 部署到 Cloudflare Pages

1. 将仓库推送到 GitHub，在 Cloudflare Pages 中「连接 Git 仓库」；
2. 构建命令：`npm run build`，输出目录：`dist`；
3. 在「设置 → 环境变量」中添加 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_ANON_KEY`；
4. 仓库已内置 `public/_redirects`（`/* → /index.html 200`），前端路由刷新不会 404。

## 🗄 后端配置（Supabase 侧）

> ⚠️ 本仓库仅包含前端代码。系统正常运行还需要在 Supabase 侧完成以下配置：

### 数据库表

| 表 | 用途 |
|---|---|
| `grades` | 年级（id, name, display_order） |
| `classes` | 班级（id, name, grade_id） |
| `sports` | 运动项目（id, name, scoring_rules JSONB：win/draw/loss/allow_draw） |
| `matches` | 比赛（grade_id, sport_id, week, home/away_class_id, home/away_score, result, status） |
| `sport_rankings` | 单项排行榜（grade_id, sport_id, class_id, points, wins, losses, draws） |
| `total_rankings` | 年级总排行榜（grade_id, class_id, total_points） |
| `admin_logs` | 操作日志（actor_email, action_type, detail JSONB） |
| `settings` | 系统设置（公告 / 使用说明 / 页脚 / 邀请码 / 主题色） |

`result` 取值：`pending / home_win / away_win / draw`；`status` 取值：`pending / in_progress / completed`。

### RLS 策略

- 基础数据、赛程、排行榜表：**公开读**（`SELECT` 对 `anon` 放开），**禁止 anon 写入**；
- `settings`、`admin_logs`：不对 anon 开放，读写全部经 Edge Function。

### Edge Functions 清单

| 函数 | 用途 |
|---|---|
| `update-match-result` | 录入比分（自动判定胜负平、联动重算排行榜） |
| `manage-matches` | 比赛 增 / 改 / 删 |
| `batch-import-matches` | 批量导入，返回成功条数 |
| `calculate-rankings` | 按积分规则重算排行榜（可指定年级） |
| `admin-settings` | 公告 / 使用说明 / 页脚 / 邀请码 / 主题色 的读写 |
| `sports-settings` | 项目积分规则更新（保存后自动重算） |
| `manage-taxonomy` | 年级 / 班级增删改（含引用检查） |
| `admin-logs` | 操作日志查询（仅超管） |
| `verify-invite` | 注册邀请码服务端校验 |

### 创建第一个超级管理员

由于注册需要邀请码，首个账号需手动创建：

1. 在 Supabase Dashboard → Authentication 中直接添加用户（邮箱 + 密码）并完成邮箱确认；
2. 在 `auth.users` 表中将该用户的 `app_metadata` 设置为：

```json
{ "role": "super_admin" }
```

3. 在 `settings` 表中写入初始邀请码与主题色；
4. 此后其他管理员即可通过登录页注册（需向超管索取邀请码），新管理员默认为普通权限。

## 📖 使用流程

```
超管：创建年级 → 添加班级 → （首次）设置邀请码 / 主题色 / 页脚
      ↓
管理员：登录后台 → 赛程管理中排定对抗赛（主客队 + 周次）
      ↓
比赛结束后：后台首页录入比分 → 系统自动判定结果并重算排行榜
      ↓
前台：师生随时查看公告、赛程与实时排名
```

## 📁 目录结构

```
src/
├── App.tsx                 # 路由表 + 登录/超管路由守卫
├── main.tsx                # 入口
├── index.css               # Tailwind 与 Markdown 排版样式
├── components/
│   ├── AdminLayout.tsx     # 后台通用布局与导航
│   ├── Filters.tsx         # 年级/项目/周次三级筛选器
│   ├── Markdown.tsx        # Markdown 渲染 + 带预览编辑器
│   └── ui.tsx              # Button / Spinner / Badge / Toast 等基础组件
├── lib/
│   ├── api.ts              # 统一数据访问层（公开读直查 + 写操作走 Edge Function）
│   ├── auth.tsx            # 认证上下文（会话与超管判定）
│   ├── supabase.ts         # Supabase 客户端
│   ├── theme.ts            # 主题色应用（CSS 变量 → 全站生效）
│   ├── types.ts            # 与数据库表结构对应的类型定义
│   └── useToast.tsx        # 全局消息提示
└── pages/
    ├── HomePage.tsx            # 前台首页
    ├── AdminLoginPage.tsx      # 管理员登录 / 注册（邀请码）
    ├── AdminDashboard.tsx      # 结果录入 + 公告/页脚/邀请码/主题色设置
    ├── ScheduleManagement.tsx  # 赛程管理（增删改 / 批量导入导出）
    ├── SportSettings.tsx       # 项目积分规则
    ├── GradeClassSettings.tsx  # 年级班级管理
    ├── AdminGuide.tsx          # 使用说明
    └── AdminLogs.tsx           # 操作日志（仅超管）
```

## 🔒 安全设计

- 数据库 RLS 收紧写入权限，anon key 仅能公开读；
- 全部写操作经 Edge Function 服务端鉴权（登录 + 超管），前端守卫仅做体验层拦截；
- 超管标识存于 JWT `app_metadata`，客户端不可伪造；
- 注册邀请码仅服务端比对，前端不接触真实值；
- 年级 / 班级删除前校验引用关系，防止孤立数据；
- 管理操作全量写入审计日志。

## 📄 License

仅供校内使用，未设置开源许可证。
