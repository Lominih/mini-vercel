# Mini Vercel 项目介绍

> 一个自托管的前端部署平台，灵感来源于 Vercel，支持自动构建、预览部署、自定义域名、SSL 证书、Edge Functions 和实时分析。

---

## 一句话简介

**Mini Vercel** 是一个基于 Node.js + TypeScript 构建的自托管前端部署平台，通过 Webhook 驱动的自动化构建流水线，实现从代码提交到生产部署的全流程管理，支持 10 种主流前端框架的自动检测与构建。

---

## 项目背景

现代前端开发中，从代码提交到生产环境上线的部署流程往往涉及多个环节：代码拉取、依赖安装、框架构建、产物压缩、域名绑定、SSL 配置等。Vercel 等平台极大地简化了这一流程，但它们以 SaaS 形式提供服务，存在数据安全、网络延迟和成本等方面的限制。

Mini Vercel 旨在提供一个完全自主可控的替代方案：

- **数据自主**：所有构建产物、环境变量（AES-256-GCM 加密存储）、部署记录均存储在自托管数据库中
- **灵活部署**：支持 Docker Compose 一键部署，也可直接在服务器上运行
- **框架无关**：自动检测 10 种前端框架，提供开箱即用的构建配置
- **Git 集成**：通过 GitHub/GitLab Webhook 实现 push-to-deploy 的自动化体验
- **安全可控**：内置 JWT 认证、速率限制、Helmet 安全头、CORS 策略等多重安全机制

---

## 核心功能（8 个模块）

### 1. 构建系统（Build System）

项目的核心能力，负责将源代码自动编译为可部署的静态产物。

- **框架自动检测**：通过分析 `package.json` 中的依赖和项目根目录的配置文件，自动识别 10 种前端框架
- **构建流水线**：`queued → building → deploying → ready/failed` 完整状态机
- **构建缓存**：基于 commit SHA 的缓存机制，相同代码不重复构建
- **实时日志**：通过 SSE（Server-Sent Events）推送构建日志到客户端
- **构建取消**：支持在构建过程中随时终止，释放系统资源
- **超时保护**：10 分钟构建超时，防止进程挂起
- **构建缓存**：`buildCache` 服务缓存已成功的构建结果，加速重复部署

### 2. CLI 命令行工具

独立的 CLI 工具（`cli/src/index.ts`），提供与平台交互的命令行界面。

- 基于 `commander` 构建，支持 `chalk` 彩色输出和 `ora` 加载动画
- 本地配置存储在 `.mini-vercel.json`，全局配置存储在 `~/.mini-vercel/config.json`
- 支持项目初始化、登录认证、部署触发、环境变量管理、域名管理、日志查看等 7 个核心命令

### 3. Edge Functions

基于 Node.js `vm` 模块的轻量级 Serverless 运行时。

- 在 V8 沙箱中执行用户代码，提供 `console`、`fetch`、`localStorage`、`crypto` 等 Web API 模拟
- 冷启动追踪与指标收集
- 每个函数独立的日志系统（最多保留 1000 条）
- 10 秒执行超时和 128MB 内存限制
- 环境变量自动注入（AES-256-GCM 解密后传入沙箱）

### 4. 域名与 SSL 管理

- 自定义域名绑定与 DNS 验证
- 自签名 SSL 证书自动生成（Node.js `crypto` 模块）
- SSL 证书到期自动续期
- 域名唯一性约束与验证状态跟踪

### 5. 环境变量管理

- AES-256-GCM 加密存储，数据库中仅保存密文
- 按项目隔离，支持增删查操作
- 构建和 Edge Functions 执行时自动解密注入
- 32 字节十六进制加密密钥配置

### 6. Git 集成

- GitHub / GitLab 双平台 Webhook 支持
- `push` 事件自动触发部署
- Webhook 签名验证（`x-hub-signature-256` / `x-gitlab-token`）
- 仓库连接/断开管理
- 仓库列表查询（支持 GitHub REST API 和 GitLab API）

### 7. 分析与监控

- **流量统计**：请求量、PV、UV 等维度的流量数据
- **性能指标**：TTFB（Time to First Byte）、FCP（First Contentful Paint）、LCP（Largest Contentful Paint）
- **错误追踪**：按项目和时间范围聚合的错误统计

### 8. 认证与授权

- JWT 双令牌机制：Access Token + Refresh Token 轮换
- Access Token 过期后通过 Refresh Token 无感续期
- bcryptjs 密码哈希（cost factor 12）
- 基于角色的团队成员管理（`TeamMember` 模型，支持 `member` / `admin` 角色）

---

## 技术架构

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    CLI / Web Client                      │
├─────────────────────────────────────────────────────────┤
│                  Express 5 API Server                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │  Auth     │ │ Projects │ │ Deploy   │ │ Domains  │   │
│  │  Module   │ │ Module   │ │ Module   │ │ Module   │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │  Edge     │ │ Analytics│ │ Build    │ │ Git      │   │
│  │  Runtime  │ │ Module   │ │ System   │ │ Module   │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
├─────────────────────────────────────────────────────────┤
│              Middleware Layer                             │
│  Helmet │ CORS │ Compression │ Rate Limiting │ JWT Auth  │
├─────────────────────────────────────────────────────────┤
│                    数据层                                 │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │   Prisma ORM 7    │  │   PostgreSQL /    │             │
│  │   Type-safe Query  │  │   SQLite (dev)   │             │
│  └──────────────────┘  └──────────────────┘             │
└─────────────────────────────────────────────────────────┘
```

### 构建流水线

```
代码推送 (Git Webhook / CLI deploy)
    │
    ▼
创建 Deployment (status: queued)
    │
    ▼
触发 Build System
    │
    ├── 框架检测 (detectFramework)
    │     ├── 扫描 package.json 依赖
    │     └── 匹配配置文件 (next.config.js 等)
    │
    ├── 检查构建缓存 (buildCache)
    │     ├── 命中 → 复用缓存产物 → ready
    │     └── 未命中 → 继续构建
    │
    ├── 安装依赖 (npm install)
    │
    ├── 执行构建命令 (npm run build / npx next build 等)
    │     ├── stdout/stderr 实时推送到 SSE (logStreamer)
    │     └── 10 分钟超时保护
    │
    ├── 定位产物目录 (determineOutputDir)
    │     └── 按优先级查找: framework.outputDir → dist → build → out → .next → .output
    │
    ├── 更新状态为 deploying
    │
    └── 完成 → status: ready / failed
```

### 部署流程

```
1. 用户通过 CLI 或 Webhook 触发部署
2. 系统创建 Deployment 记录 (status: queued)
3. Build System 拉取代码并检测框架
4. 执行依赖安装和构建命令
5. 构建产物存入 builds/{deploymentId}/ 目录
6. 域名绑定与 SSL 证书签发
7. 部署完成，生成访问 URL
8. 分析模块开始收集流量和性能数据
```

---

## 数据模型

系统使用 Prisma ORM 管理 8 个核心数据模型，数据库支持 PostgreSQL（生产）和 SQLite（开发）。

### User（用户）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `email` | String | 唯一标识，用于登录 |
| `name` | String | 显示名称 |
| `password` | String | bcrypt 哈希值，永不返回给客户端 |
| `avatar` | String? | 头像 URL |
| `createdAt` | DateTime | 创建时间 |
| `updatedAt` | DateTime | 更新时间 |

### Team（团队）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `name` | String | 团队名称 |
| `members` | TeamMember[] | 团队成员关系 |

### TeamMember（团队成员）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `teamId` | String | 外键 → Team |
| `userId` | String | 外键 → User |
| `role` | String | 角色，默认 `member` |

> 唯一约束：`[teamId, userId]`

### Project（项目）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `name` | String | 项目名称（用户唯一） |
| `framework` | String? | 框架类型：`nextjs`、`vite`、`nuxt` 等 |
| `buildCommand` | String? | 自定义构建命令 |
| `outputDir` | String? | 自定义产物目录 |
| `installCommand` | String? | 自定义安装命令 |
| `rootDirectory` | String? | 项目根目录 |
| `userId` | String? | 所有者（删除时置空） |
| `teamId` | String? | 所属团队（删除时置空） |
| `githubRepoId` | String? | 关联的 GitHub/GitLab 仓库 ID |
| `githubRepoName` | String? | 仓库全名（如 `owner/repo`） |

### Deployment（部署）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `projectId` | String | 外键 → Project（级联删除） |
| `status` | String | `queued` → `building` → `deploying` → `ready` / `failed` / `cancelled` |
| `url` | String? | 部署访问 URL |
| `branch` | String? | 分支名，`null` 表示生产部署 |
| `commitSha` | String? | Git 提交 SHA |
| `commitMsg` | String? | 提交信息 |
| `buildLog` | String | 构建日志（默认空字符串） |
| `completedAt` | DateTime? | 完成时间 |

### Domain（域名）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `projectId` | String | 外键 → Project（级联删除） |
| `name` | String | 域名（全局唯一） |
| `verified` | Boolean | DNS 验证状态 |
| `sslStatus` | String | `none` / `active` / `pending` |
| `sslCert` | String? | SSL 证书 PEM |
| `sslKey` | String? | SSL 私钥 PEM |
| `sslExpiry` | DateTime? | 证书过期时间 |

### EnvVar（环境变量）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `projectId` | String | 外键 → Project（级联删除） |
| `key` | String | 变量名（项目内唯一） |
| `value` | String | AES-256-GCM 加密后的密文 |
| `encrypted` | Boolean | 始终为 `true` |

> 唯一约束：`[projectId, key]`

### EdgeFunction（边缘函数）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `projectId` | String | 外键 → Project（级联删除） |
| `name` | String | 函数名称 |
| `path` | String | 路由路径（如 `/api/hello`） |
| `runtime` | String | 运行时，默认 `nodejs` |
| `code` | String | JavaScript 源代码 |

> 唯一约束：`[projectId, path]`

### RedirectRule（重定向规则）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `projectId` | String | 外键 → Project（级联删除） |
| `source` | String | 源路径 |
| `target` | String | 目标路径 |
| `statusCode` | Int | HTTP 状态码，默认 301 |
| `regex` | Boolean | 是否为正则匹配 |
| `preserveQuery` | Boolean | 是否保留查询参数，默认 true |

---

## 构建系统

### 框架检测原理

构建系统通过两阶段策略自动识别项目使用的前端框架：

**第一阶段：依赖扫描**

解析 `package.json` 中的 `dependencies` 和 `devDependencies`，按优先级匹配：

| 优先级 | 依赖名 | 检测框架 | 构建命令 | 产物目录 |
|--------|--------|---------|---------|---------|
| 1 | `next` | Next.js | `npx next build` | `.next` |
| 2 | `nuxt` | Nuxt | `npx nuxt build` | `.output` |
| 3 | `remix` / `@remix-run/react` | Remix | `npx remix build` | `build` |
| 4 | `gatsby` | Gatsby | `npx gatsby build` | `public` |
| 5 | `astro` | Astro | `npx astro build` | `dist` |
| 6 | `@sveltejs/kit` | SvelteKit | `npx svelte-kit build` | `build` |
| 7 | `react-scripts` | Create React App | `npx react-scripts build` | `build` |
| 8 | `@vue/cli-service` | Vue CLI | `npx vue-cli-service build` | `dist` |
| 9 | `vite` | Vite | `npm run build` | `dist` |

**第二阶段：配置文件匹配**

如果依赖扫描未命中，则遍历所有框架的 `configFile` 列表，检查项目根目录是否存在对应文件（如 `next.config.js`、`vite.config.ts` 等）。

**兜底策略**

如果两个阶段均未匹配，则使用 Node.js 默认配置：
- 构建命令：`npm run build`
- 产物目录：`dist`

### 构建流水线

构建流水线由 `src/services/build-system.ts` 核心模块驱动：

1. **创建构建目录**：在 `builds/{deploymentId}/` 下创建临时工作目录
2. **框架检测**：调用 `detectFramework()` 确定构建配置
3. **缓存检查**：通过 `buildCache.checkCache()` 检查是否有可复用的构建产物
4. **依赖安装**：在项目目录中执行 `npm install`
5. **执行构建**：通过 `child_process.spawn` 启动构建进程，支持跨平台（Windows `cmd /c`，Unix `sh -c`）
6. **日志流式推送**：`stdout` 和 `stderr` 通过 `logStreamer` 实时推送到 SSE 客户端
7. **产物定位**：`determineOutputDir()` 按优先级查找产物目录
8. **状态更新**：构建完成后更新数据库中的部署状态和日志

### 构建状态机

```
          ┌──────────┐
          │ queued   │
          └────┬─────┘
               │
               ▼
          ┌──────────┐
          │ building │ ← SSE 日志推送中
          └────┬─────┘
               │
       ┌───────┼───────┐
       ▼       ▼       ▼
  ┌────────┐ ┌──────┐ ┌───────────┐
  │deploying│ │failed│ │ cancelled │
  └───┬────┘ └──────┘ └───────────┘
      │
      ▼
  ┌────────┐
  │ ready  │
  └────────┘
```

---

## CLI 工具

CLI 工具位于 `cli/src/index.ts`，基于 `commander` 框架构建，提供 7 个核心命令。

### 命令一览

| 命令 | 说明 | 示例 |
|------|------|------|
| `mini-vercel init` | 初始化项目，创建 `.mini-vercel.json` 配置文件 | `mini-vercel init` |
| `mini-vercel login` | 交互式登录，输入邮箱和密码获取 Token | `mini-vercel login` |
| `mini-vercel deploy` | 构建并部署项目到 Mini Vercel 平台 | `mini-vercel deploy` |
| `mini-vercel env` | 管理环境变量（查看/设置/删除） | `mini-vercel env --list` |
| `mini-vercel logs` | 查看最近部署的构建日志 | `mini-vercel logs` |
| `mini-vercel domain` | 管理自定义域名（列表/添加/验证/删除） | `mini-vercel domain --list` |
| `mini-vercel domains` | 域名管理的别名命令 | `mini-vercel domains --add example.com` |

### 使用示例

**初始化项目**

```bash
mini-vercel init
# 交互式选择项目名称和框架
# 生成 .mini-vercel.json 配置文件
```

**登录认证**

```bash
mini-vercel login
# 输入邮箱: user@example.com
# 输入密码: ********
# Token 保存到 ~/.mini-vercel/config.json
```

**部署项目**

```bash
mini-vercel deploy
# 自动检测框架 → 上传文件 → 触发构建 → 返回部署 URL
# 输出示例: https://my-project-abc123.mini-vercel.local
```

**环境变量管理**

```bash
mini-vercel env --list                        # 列出所有环境变量
mini-vercel env --set KEY=VALUE               # 设置环境变量
mini-vercel env --set KEY=VALUE --env prod    # 设置生产环境变量
mini-vercel env --delete KEY                  # 删除环境变量
```

**查看日志**

```bash
mini-vercel logs                # 查看最近部署的日志
mini-vercel logs --follow       # 实时跟踪构建日志（SSE）
mini-vercel logs --deployment-id <id>  # 查看指定部署的日志
```

**域名管理**

```bash
mini-vercel domain --list                    # 列出所有域名
mini-vercel domain --add example.com         # 添加域名
mini-vercel domain --verify example.com      # 触发 DNS 验证
mini-vercel domain --remove example.com      # 删除域名
```

### 配置文件

CLI 使用两层配置机制：

**项目级配置**（`.mini-vercel.json`）

```json
{
  "projectId": "uuid-of-project",
  "projectName": "my-app"
}
```

**全局配置**（`~/.mini-vercel/config.json`）

```json
{
  "token": "jwt-access-token",
  "refreshToken": "jwt-refresh-token"
}
```

---

## Edge Functions

Edge Functions 是 Mini Vercel 提供的轻量级 Serverless 计算能力，允许用户在平台边缘执行自定义 JavaScript 代码。

### 运行时环境

Edge Functions 基于 Node.js `vm` 模块实现，提供沙箱化的执行环境：

| API | 说明 |
|-----|------|
| `console.log/warn/error/info/debug` | 日志输出（存储到内存日志） |
| `fetch()` | HTTP 请求（模拟实现） |
| `localStorage` | 键值存储（内存模拟） |
| `URL` / `URLSearchParams` | URL 解析 |
| `TextEncoder` / `TextDecoder` | 编码工具 |
| `Headers` / `Request` / `Response` | Web 标准 API |
| `AbortController` | 请求中断控制 |
| `atob` / `btoa` | Base64 编解码 |
| `crypto` | 加密 API |
| `setTimeout` / `clearTimeout` | 定时器 |
| `setInterval` / `clearInterval` | 周期定时器 |
| `Buffer` | Node.js Buffer |
| `process.env` | 项目环境变量（自动解密注入） |

### 安全限制

- **执行超时**：10 秒（`TIMEOUT_MS = 10_000`）
- **内存限制**：128MB（`MEMORY_LIMIT_BYTES = 128 * 1024 * 1024`）
- **沙箱隔离**：通过 `vm.createContext()` 创建独立上下文，无法访问宿主环境
- **日志上限**：每个函数最多保留 1000 条日志记录

### 冷启动机制

- 首次调用标记为 cold start，后续调用标记为 warm
- 代码更新（`PUT /:id`）时清除冷启动标记
- 每次调用返回 `coldStart` 标志和执行 `duration`

### 示例代码

```javascript
// Edge Function 代码示例
const name = __request.query.name || "World";
__response.status = 200;
__response.headers = { "content-type": "application/json" };
__response.body = JSON.stringify({
  message: `Hello, ${name}!`,
  runtime: process.env.FUNCTION_RUNTIME,
  timestamp: new Date().toISOString(),
});
```

### 调用方式

```bash
# 创建 Edge Function
curl -X POST http://localhost:4000/api/functions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "xxx",
    "name": "hello",
    "path": "/api/hello",
    "code": "__response.status=200; __response.body=\"Hello!\";"
  }'

# 调用 Edge Function
curl -X POST http://localhost:4000/api/functions/<id>/invoke \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"method": "GET", "query": {"name": "Mini Vercel"}}'

# 查看函数日志
curl http://localhost:4000/api/functions/<id>/logs \
  -H "Authorization: Bearer <token>"
```

---

## API 概览

Mini Vercel 提供 44 个 RESTful API 端点，按功能模块分类如下：

### 认证模块（4 个端点）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/auth/register` | 注册新用户 | ✗ |
| POST | `/api/auth/login` | 用户登录 | ✗ |
| POST | `/api/auth/refresh` | 刷新 Access Token | ✗ |
| GET | `/api/auth/me` | 获取当前用户信息 | ✓ |

### 项目模块（5 个端点）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/projects` | 创建项目 | ✓ |
| GET | `/api/projects` | 列出项目 | ✓ |
| GET | `/api/projects/:id` | 获取项目详情 | ✓ |
| PATCH | `/api/projects/:id` | 更新项目配置 | ✓ |
| DELETE | `/api/projects/:id` | 删除项目 | ✓ |

### 构建模块（5 个端点）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/builds` | 触发新构建 | ✓ |
| GET | `/api/builds` | 列出构建记录（分页） | ✓ |
| GET | `/api/builds/:id` | 获取构建状态与日志 | ✓ |
| GET | `/api/builds/:id/logs` | SSE 实时日志流 | ✓ |
| POST | `/api/builds/:id/cancel` | 取消正在运行的构建 | ✓ |

### 部署模块（4 个端点）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/deployments` | 创建部署 | ✓ |
| GET | `/api/deployments/:id` | 获取部署详情 | ✓ |
| GET | `/api/projects/:id/deployments` | 列出项目部署记录 | ✓ |
| DELETE | `/api/deployments/:id` | 删除部署 | ✓ |

### Git 集成模块（4 个端点）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/git/connect` | 连接 GitHub/GitLab 仓库 | ✓ |
| POST | `/api/git/webhook` | 接收 Webhook 事件 | ✗（签名验证） |
| GET | `/api/git/repos` | 列出可用仓库 | ✓ |
| DELETE | `/api/git/disconnect` | 断开仓库连接 | ✓ |

### 域名模块（3 个端点）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/domains` | 添加自定义域名 | ✓ |
| GET | `/api/domains` | 列出域名 | ✓ |
| POST | `/api/domains/:id/verify` | 触发 DNS 验证 | ✓ |

### 环境变量模块（3 个端点）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/env` | 设置环境变量 | ✓ |
| GET | `/api/env` | 列出环境变量 | ✓ |
| DELETE | `/api/env/:id` | 删除环境变量 | ✓ |

### Edge Functions 模块（5 个端点）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/functions` | 创建 Edge Function | ✓ |
| GET | `/api/functions` | 列出 Edge Functions | ✓ |
| PUT | `/api/functions/:id` | 更新 Edge Function | ✓ |
| DELETE | `/api/functions/:id` | 删除 Edge Function | ✓ |
| POST | `/api/functions/:id/invoke` | 调用 Edge Function | ✓ |

### 分析模块（3 个端点）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/analytics/traffic/:projectId` | 流量统计 | ✓ |
| GET | `/api/analytics/performance/:projectId` | 性能指标 | ✓ |
| GET | `/api/analytics/errors/:projectId` | 错误统计 | ✓ |

### 健康检查（1 个端点）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/health` | 健康检查 | ✗ |

---

## 安全特性

Mini Vercel 内置了多层次的安全防护机制：

### 认证安全

- **JWT 双令牌**：Access Token（短期）+ Refresh Token（长期）轮换机制
- **密码哈希**：bcryptjs，cost factor 12，暴力破解成本极高
- **Token 过期控制**：通过 `JWT_EXPIRES_IN` 环境变量配置有效期

### 传输安全

- **Helmet**：自动设置安全 HTTP 头（X-Content-Type-Options、X-Frame-Options 等）
- **CORS**：可配置的跨域策略，默认允许指定来源
- **SSL/TLS**：自签名证书自动生成，支持域名级别 SSL 绑定

### 请求安全

- **速率限制**：三级限流策略
  - 全局限流：100 次/分钟
  - API 限流：30 次/分钟
  - 认证限流：10 次/分钟
- **输入验证**：Zod schema 校验请求参数
- **请求体大小限制**：JSON 解析限制 10MB

### 数据安全

- **环境变量加密**：AES-256-GCM 加密存储，数据库中仅保存密文
- **密码永不返回**：API 响应中不包含用户密码字段
- **Webhook 签名验证**：GitHub `x-hub-signature-256` / GitLab `x-gitlab-token` 校验

### 运行时安全

- **Edge Functions 沙箱**：`vm.createContext()` 隔离执行环境
- **构建超时**：10 分钟构建超时，防止恶意代码无限运行
- **内存限制**：Edge Functions 128MB 内存上限
- **执行超时**：Edge Functions 10 秒执行超时

---

## 部署指南

### 环境要求

- Node.js ≥ 20
- PostgreSQL ≥ 14（或使用 Docker Compose）
- npm ≥ 10

### 快速部署（Docker Compose）

```bash
# 1. 克隆项目
git clone <repo-url> mini-vercel && cd mini-vercel

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，配置 JWT_SECRET、ENV_ENCRYPTION_KEY、DATABASE_URL

# 3. 启动所有服务
docker compose up -d

# 4. 初始化数据库
docker compose exec app npx prisma db push

# 5. 导入演示数据
docker compose exec app npx ts-node prisma/seed.ts

# 6. 验证部署
curl http://localhost:4000/api/health
```

### 手动部署

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env

# 3. 初始化数据库
npx prisma generate
npx prisma db push

# 4. 导入演示数据
npm run seed

# 5. 启动服务
npm run dev       # 开发模式
npm run build && npm start  # 生产模式
```

### 关键环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | 数据库连接字符串 | `postgresql://...` |
| `JWT_SECRET` | JWT 签名密钥 | （必填） |
| `JWT_EXPIRES_IN` | Access Token 有效期 | `7d` |
| `ENV_ENCRYPTION_KEY` | AES-256-GCM 加密密钥（32 字节十六进制） | （必填） |
| `CORS_ORIGIN` | 允许的 CORS 来源 | `http://localhost:3001` |
| `PORT` | 服务端口 | `3000` |
| `WEBHOOK_SECRET` | Webhook 签名密钥 | `mini-vercel-webhook-secret` |
| `WEBHOOK_BASE_URL` | Webhook 回调地址 | `http://localhost:3000` |

---

## 开发指南

### 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 运行时 | Node.js + TypeScript | 20+ |
| Web 框架 | Express 5 | 5.2.1 |
| ORM | Prisma | 7 |
| 数据库 | PostgreSQL 16 / SQLite | 14+ |
| 认证 | JWT + bcryptjs | jsonwebtoken 9 |
| 安全 | Helmet + CORS + Rate Limiting | helmet 8 |
| 测试 | Vitest（单元）+ Playwright（E2E） | Vitest 4 / Playwright 1.61 |
| 构建 | TypeScript 编译 | tsc |
| 容器化 | Docker + Docker Compose | 多阶段构建 |

### 本地开发

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env

# 启动数据库（开发模式使用 SQLite）
npx prisma generate
npx prisma db push

# 启动开发服务器（支持热重载）
npm run dev

# 另一个终端运行测试
npm test              # 单元测试
npm run test:watch    # 监听模式
npm run test:e2e      # E2E 测试
```

### 项目脚本

| 脚本 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（ts-node） |
| `npm run build` | TypeScript 编译到 `dist/` |
| `npm start` | 启动生产服务器 |
| `npm test` | 运行 Vitest 单元测试 |
| `npm run test:coverage` | 运行测试并生成覆盖率报告 |
| `npm run test:e2e` | 运行 Playwright E2E 测试 |
| `npm run db:push` | 推送 Prisma Schema 到数据库 |
| `npm run db:migrate` | 运行数据库迁移 |
| `npm run db:studio` | 打开 Prisma Studio |
| `npm run seed` | 导入演示数据 |

### API 开发约定

- 所有 API 响应遵循 `ApiResponse<T>` 或 `PaginatedResponse<T>` 格式
- 需要认证的端点使用 `requireAuth` 中间件
- 路由处理器中使用 `AuthenticatedRequest` 类型获取用户信息
- 错误响应统一返回 `{ error: string }` 格式
- 分页查询支持 `page` 和 `limit` 参数，上限 100 条

---

## 项目结构

```
mini-vercel/
├── src/
│   ├── generated/              # Prisma 自动生成的客户端代码
│   ├── lib/
│   │   ├── prisma.ts           # Prisma 客户端实例
│   │   └── cache.ts            # 内存缓存实现
│   ├── middleware/
│   │   ├── auth.ts             # JWT 认证中间件
│   │   └── rate-limit.ts       # 速率限制中间件（三级限流）
│   ├── routes/
│   │   ├── auth.ts             # 认证路由（注册/登录/刷新/用户信息）
│   │   ├── projects.ts         # 项目 CRUD 路由
│   │   ├── deployments.ts      # 部署管理路由
│   │   ├── build.ts            # 构建系统路由（触发/状态/日志/取消）
│   │   ├── domains.ts          # 域名管理路由
│   │   ├── env-vars.ts         # 环境变量路由
│   │   ├── edge-functions.ts   # Edge Functions CRUD + 调用路由
│   │   ├── analytics.ts        # 分析统计路由
│   │   └── git.ts              # Git 集成路由（Webhook/仓库管理）
│   ├── services/
│   │   ├── auth.ts             # JWT Token 生成与验证
│   │   ├── build-system.ts     # 构建系统核心（框架检测/构建执行/缓存）
│   │   ├── build-cache.ts      # 构建缓存管理
│   │   ├── deployment.ts       # 部署流程编排
│   │   ├── log-streamer.ts     # SSE 日志流推送
│   │   ├── edge-runtime.ts     # Edge Functions VM 沙箱运行时
│   │   ├── analytics.ts        # 分析统计服务
│   │   ├── env-encryption.ts   # AES-256-GCM 环境变量加密
│   │   ├── ssl.ts              # SSL 证书生成与管理
│   │   ├── dns.ts              # DNS 验证服务
│   │   ├── redirects.ts        # 重定向规则引擎
│   │   ├── github.ts           # GitHub API 集成
│   │   └── gitlab.ts           # GitLab API 集成
│   ├── types/
│   │   └── index.ts            # TypeScript 类型定义（框架/构建/API 响应）
│   ├── __tests__/              # Vitest 单元测试
│   ├── app.ts                  # Express 应用配置（中间件/路由注册）
│   └── index.ts                # 服务入口（HTTP 服务器启动）
├── cli/
│   └── src/
│       └── index.ts            # CLI 工具入口（commander 命令定义）
├── e2e/                        # Playwright E2E 测试
├── prisma/
│   ├── schema.prisma           # 数据库 Schema（8 个模型）
│   └── seed.ts                 # 演示数据种子脚本
├── Dockerfile                  # 多阶段 Docker 构建文件
├── docker-compose.yml          # Docker Compose 编排（API + PostgreSQL）
├── vitest.config.ts            # Vitest 单元测试配置
├── playwright.config.ts        # Playwright E2E 测试配置
├── tsconfig.json               # TypeScript 编译配置
├── package.json                # 项目依赖与脚本
├── .env.example                # 环境变量模板
├── API.md                      # API 接口文档
├── README.md                   # 项目说明文档
└── INTRODUCTION.md             # 项目介绍文档（本文档）
```
