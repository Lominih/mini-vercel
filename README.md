# Mini Vercel

一款受 Vercel 启发的自托管前端部署平台。支持自动构建、预览部署、自定义域名、SSL 证书、Edge Functions 和实时分析。

## 功能特性

- **多框架支持** — 自动检测并构建 Next.js、Vite、Nuxt、Remix、Gatsby、Astro、SvelteKit、React App、Vue CLI 和通用 Node.js 项目
- **预览部署** — 每次分支推送自动创建唯一的预览 URL
- **自定义域名** — 绑定任意域名，自动 DNS 验证
- **SSL 证书** — 自动生成自签名证书，支持自动续期
- **Edge Functions** — 在 V8 沙箱中运行无服务器函数，追踪冷启动
- **环境变量** — 项目级 AES-256-GCM 加密存储环境变量
- **实时构建日志** — 基于 SSE 的构建日志流
- **数据分析** — 流量统计、性能指标（TTFB/FCP/LCP）和错误追踪
- **身份认证** — 基于 JWT 的认证，Access + Refresh Token 轮换
- **GitHub/GitLab 集成** — 通过 Webhook 驱动的自动部署

## 环境要求

- **Node.js** ≥ 20
- **PostgreSQL** ≥ 14（或使用 Docker Compose）
- **npm** ≥ 10

## 快速开始

```bash
# 克隆仓库
git clone <repo-url> mini-vercel && cd mini-vercel

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填写你的配置

# 生成 Prisma Client
npx prisma generate

# 推送 Schema 到数据库
npx prisma db push

# 初始化演示数据
npx ts-node prisma/seed.ts

# 启动开发服务器
npm run dev
```

API 将在 `http://localhost:3000` 可用。

## Docker 部署

```bash
# 启动所有服务（API + PostgreSQL）
docker compose up -d

# 运行数据库迁移
docker compose exec app npx prisma db push

# 初始化演示数据
docker compose exec app npx ts-node prisma/seed.ts

# 查看日志
docker compose logs -f app

# 停止服务
docker compose down
```

## API 端点

### 认证

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/refresh` | 刷新 Access Token |
| GET | `/api/auth/me` | 获取当前用户信息 |

### 项目

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/projects` | 创建项目 |
| GET | `/api/projects` | 列出项目 |
| GET | `/api/projects/:id` | 获取项目 |
| PATCH | `/api/projects/:id` | 更新项目 |
| DELETE | `/api/projects/:id` | 删除项目 |

### 部署

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/deployments` | 创建部署 |
| GET | `/api/deployments/:id` | 获取部署 |
| GET | `/api/projects/:id/deployments` | 列出项目部署 |
| DELETE | `/api/deployments/:id` | 删除部署 |

### 域名

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/domains` | 添加自定义域名 |
| GET | `/api/domains` | 列出域名 |
| POST | `/api/domains/:id/verify` | 触发 DNS 验证 |

### 环境变量

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/env` | 设置环境变量 |
| GET | `/api/env` | 列出环境变量 |
| DELETE | `/api/env/:id` | 删除环境变量 |

### Edge Functions

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/functions` | 创建 Edge Function |
| POST | `/api/functions/:id/invoke` | 调用 Edge Function |
| GET | `/api/functions/:id/logs` | 获取函数日志 |

### 分析

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/analytics/traffic` | 流量统计 |
| GET | `/api/analytics/performance` | 性能指标 |
| GET | `/api/analytics/errors` | 错误统计 |

### 健康检查

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/health` | 健康检查 |

## 测试

### 单元测试（Vitest）

```bash
# 运行所有单元测试
npm test

# 生成覆盖率报告
npx vitest run --coverage

# 监听模式
npx vitest
```

### E2E 测试（Playwright）

```bash
# 安装 Playwright 浏览器
npx playwright install chromium

# 运行 E2E 测试（自动启动开发服务器）
npx playwright test

# 交互式 UI 模式
npx playwright test --ui

# 查看 HTML 报告
npx playwright show-report e2e-report
```

## 项目结构

```
mini-vercel/
├── src/
│   ├── generated/          # Prisma 生成的客户端
│   ├── lib/                # 数据库客户端
│   ├── middleware/          # 认证中间件
│   ├── routes/             # Express 路由处理器
│   ├── services/           # 业务逻辑
│   ├── types/              # TypeScript 类型定义
│   ├── app.ts              # Express 应用配置
│   └── index.ts            # 服务端入口
├── prisma/
│   ├── schema.prisma       # 数据库 Schema
│   └── seed.ts             # 演示数据填充
├── src/__tests__/          # 单元测试（Vitest）
├── e2e/                    # E2E 测试（Playwright）
├── Dockerfile              # 多阶段 Docker 构建
├── docker-compose.yml      # 应用 + PostgreSQL
├── vitest.config.ts        # Vitest 配置
├── playwright.config.ts    # Playwright 配置
└── tsconfig.json           # TypeScript 配置
```

## 环境变量

完整配置请查看 `.env.example`。关键变量：

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://...` |
| `JWT_SECRET` | JWT 签名密钥 | （必填） |
| `JWT_EXPIRES_IN` | Access Token 有效期 | `7d` |
| `ENV_ENCRYPTION_KEY` | 32 字节十六进制加密密钥 | （必填） |
| `CORS_ORIGIN` | 允许的 CORS 来源 | `http://localhost:3001` |
| `PORT` | 服务端口 | `3000` |

## 技术栈

- **运行时**：Node.js 20 + TypeScript
- **框架**：Express 5
- **数据库**：PostgreSQL 16 + Prisma ORM 7
- **认证**：JWT（jsonwebtoken）+ bcryptjs
- **沙箱**：Node.js `vm` 模块（Edge Functions）
- **SSL**：通过 Node.js `crypto` 生成自签名证书
- **测试**：Vitest（单元）+ Playwright（E2E）
- **部署**：多阶段 Docker + Docker Compose

## 许可证

ISC
