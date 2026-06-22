# Mini Vercel - API Reference

> Base URL: `http://localhost:4000/api`
>
> Authentication: Bearer token in the `Authorization` header.
> Content-Type: `application/json` (unless otherwise noted).

---

## Table of Contents

- [Data Models](#data-models)
- [Authentication](#authentication)
- [Projects](#projects)
- [Git Integration](#git-integration)
- [Build System](#build-system)
- [Deployment Management](#deployment-management)
- [Domain Management](#domain-management)
- [Environment Variables](#environment-variables)
- [Edge Functions](#edge-functions)
- [Analytics](#analytics)
- [Health Check](#health-check)
- [CLI Command Reference](#cli-command-reference)
- [Error Reference](#error-reference)

---

## Data Models

### User

| Field       | Type     | Notes                     |
|-------------|----------|---------------------------|
| `id`        | `string` | UUID, primary key         |
| `email`     | `string` | Unique                    |
| `name`      | `string` |                           |
| `password`  | `string` | Bcrypt hash (never returned in responses) |
| `avatar`    | `string` | Optional                  |
| `createdAt` | `string` | ISO 8601 datetime         |
| `updatedAt` | `string` | ISO 8601 datetime         |

### Project

| Field            | Type     | Notes                          |
|------------------|----------|--------------------------------|
| `id`             | `string` | UUID, primary key              |
| `name`           | `string` | Unique per user                |
| `framework`      | `string` | e.g. `nextjs`, `vite`, `node` |
| `buildCommand`   | `string` | Optional                       |
| `outputDir`      | `string` | Optional                       |
| `installCommand` | `string` | Optional                       |
| `rootDirectory`  | `string` | Optional                       |
| `userId`         | `string` | Optional, owner FK             |
| `teamId`         | `string` | Optional, team FK              |
| `githubRepoId`   | `string` | Optional, linked repo ID       |
| `githubRepoName` | `string` | Optional, e.g. `owner/repo`   |
| `createdAt`      | `string` | ISO 8601 datetime              |
| `updatedAt`      | `string` | ISO 8601 datetime              |

### Deployment

| Field         | Type     | Notes                                          |
|---------------|----------|------------------------------------------------|
| `id`          | `string` | UUID, primary key                              |
| `projectId`   | `string` | FK to Project                                  |
| `status`      | `string` | `queued` `building` `deploying` `ready` `failed` `cancelled` |
| `url`         | `string` | Optional, deployment URL                       |
| `branch`      | `string` | Optional, `null` = production                  |
| `commitSha`   | `string` | Optional, git commit SHA                       |
| `commitMsg`   | `string` | Optional, commit message                       |
| `buildLog`    | `string` | Build output log                               |
| `createdAt`   | `string` | ISO 8601 datetime                              |
| `completedAt` | `string` | Optional, ISO 8601 datetime                    |

### Domain

| Field       | Type      | Notes                           |
|-------------|-----------|---------------------------------|
| `id`        | `string`  | UUID, primary key               |
| `projectId` | `string`  | FK to Project                   |
| `name`      | `string`  | Unique, e.g. `example.com`     |
| `verified`  | `boolean` | DNS verification status         |
| `sslStatus` | `string`  | `none` `active` `pending`      |
| `createdAt` | `string`  | ISO 8601 datetime               |
| `updatedAt` | `string`  | ISO 8601 datetime               |

### EnvVar

| Field       | Type      | Notes                     |
|-------------|-----------|---------------------------|
| `id`        | `string`  | UUID, primary key         |
| `projectId` | `string`  | FK to Project             |
| `key`       | `string`  | Unique per project        |
| `value`     | `string`  | AES-encrypted at rest     |
| `encrypted` | `boolean` | Always `true`             |
| `createdAt` | `string`  | ISO 8601 datetime         |
| `updatedAt` | `string`  | ISO 8601 datetime         |

### EdgeFunction

| Field       | Type     | Notes                          |
|-------------|----------|--------------------------------|
| `id`        | `string` | UUID, primary key              |
| `projectId` | `string` | FK to Project                  |
| `name`      | `string` | Display name                   |
| `path`      | `string` | URL path, unique per project   |
| `runtime`   | `string` | Default `nodejs`               |
| `code`      | `string` | JavaScript source code         |
| `createdAt` | `string` | ISO 8601 datetime              |
| `updatedAt` | `string` | ISO 8601 datetime              |

### RedirectRule

| Field           | Type      | Notes                     |
|-----------------|-----------|---------------------------|
| `id`            | `string`  | UUID, primary key         |
| `projectId`     | `string`  | FK to Project             |
| `source`        | `string`  | Source path/pattern       |
| `target`        | `string`  | Target URL/path           |
| `statusCode`    | `number`  | Default `301`             |
| `regex`         | `boolean` | Default `false`           |
| `preserveQuery` | `boolean` | Default `true`            |

---

## Authentication

All authenticated endpoints require the `Authorization: Bearer <token>` header. Obtain tokens via the register or login endpoints.

### POST /api/auth/register

Create a new user account.

**Request Body:**

```json
{
  "email": "user@example.com",
  "name": "Jane Doe",
  "password": "securepass123"
}
```

| Field      | Type     | Required | Validation                          |
|------------|----------|----------|-------------------------------------|
| `email`    | `string` | Yes      | Valid email format                  |
| `name`     | `string` | Yes      | Non-empty                           |
| `password` | `string` | Yes      | Minimum 8 characters                |

**Response - 201 Created:**

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "Jane Doe",
    "avatar": null,
    "createdAt": "2026-06-22T10:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Errors:**

| Status | Error                              |
|--------|------------------------------------|
| `400`  | Email, name, and password are required |
| `400`  | Password must be at least 8 characters |
| `400`  | Invalid email format               |
| `409`  | User already exists                |
| `500`  | Internal server error              |

---

### POST /api/auth/login

Authenticate an existing user.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securepass123"
}
```

**Response - 200 OK:**

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "Jane Doe",
    "avatar": null,
    "createdAt": "2026-06-22T10:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Errors:**

| Status | Error                      |
|--------|----------------------------|
| `400`  | Email and password are required |
| `401`  | Invalid credentials        |
| `500`  | Internal server error      |

---

### POST /api/auth/refresh

Exchange a refresh token for a new access + refresh token pair.

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response - 200 OK:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Errors:**

| Status | Error                              |
|--------|------------------------------------|
| `400`  | Refresh token is required          |
| `401`  | Invalid or expired refresh token   |
| `401`  | User not found                     |
| `500`  | Internal server error              |

---

### GET /api/auth/me

Get the currently authenticated user's profile.

**Headers:** `Authorization: Bearer <token>`

**Response - 200 OK:**

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "Jane Doe",
    "avatar": null,
    "createdAt": "2026-06-22T10:00:00.000Z",
    "updatedAt": "2026-06-22T10:00:00.000Z"
  }
}
```

**Errors:**

| Status | Error                       |
|--------|-----------------------------|
| `401`  | Missing or invalid authorization header |
| `401`  | Not authenticated           |
| `404`  | User not found              |
| `500`  | Internal server error       |

---

## Projects

### POST /api/projects

Create a new project.

**Request Body:**

```json
{
  "name": "my-app",
  "framework": "nextjs",
  "buildCommand": "npx next build",
  "outputDir": ".next",
  "installCommand": "npm install",
  "rootDirectory": "."
}
```

| Field            | Type     | Required | Notes                                  |
|------------------|----------|----------|----------------------------------------|
| `name`           | `string` | Yes      |                                        |
| `framework`      | `string` | No       | `nextjs`, `vite`, `node`, etc.        |
| `buildCommand`   | `string` | No       | Custom build command                   |
| `outputDir`      | `string` | No       | Build output directory                 |
| `installCommand` | `string` | No       | Custom install command                 |
| `rootDirectory`  | `string` | No       | Monorepo root directory                |

**Response - 201 Created:**

```json
{
  "success": true,
  "data": {
    "id": "proj_abc123",
    "name": "my-app",
    "framework": "nextjs",
    "buildCommand": "npx next build",
    "outputDir": ".next",
    "installCommand": "npm install",
    "rootDirectory": ".",
    "createdAt": "2026-06-22T10:00:00.000Z",
    "updatedAt": "2026-06-22T10:00:00.000Z"
  },
  "message": "Project created successfully"
}
```

**Errors:**

| Status | Error                                    |
|--------|------------------------------------------|
| `400`  | Project name is required                 |
| `409`  | A project with that name already exists  |
| `500`  | Internal server error                    |

---

### GET /api/projects

List all projects with pagination and optional search.

**Query Parameters:**

| Param    | Type     | Default | Notes                  |
|----------|----------|---------|------------------------|
| `page`   | `number` | `1`     | Page number            |
| `limit`  | `number` | `20`    | Items per page (max 100) |
| `search` | `string` | -       | Filter by project name |

**Response - 200 OK:**

```json
{
  "success": true,
  "data": [
    {
      "id": "proj_abc123",
      "name": "my-app",
      "framework": "nextjs",
      "deploymentCount": 5,
      "domainCount": 2,
      "envVarCount": 3,
      "createdAt": "2026-06-22T10:00:00.000Z",
      "updatedAt": "2026-06-22T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### GET /api/projects/:id

Get a single project with recent deployments, domains, and env var keys.

**Response - 200 OK:**

```json
{
  "success": true,
  "data": {
    "id": "proj_abc123",
    "name": "my-app",
    "framework": "nextjs",
    "deployments": [
      {
        "id": "dep_xyz789",
        "status": "ready",
        "branch": "main",
        "commitSha": "a1b2c3d",
        "commitMsg": "feat: add landing page",
        "createdAt": "2026-06-22T12:00:00.000Z"
      }
    ],
    "domains": [
      {
        "id": "dom_1",
        "name": "my-app.vercel.app",
        "verified": true,
        "sslStatus": "active"
      }
    ],
    "envVars": [
      {
        "id": "env_1",
        "key": "API_URL",
        "createdAt": "2026-06-22T10:00:00.000Z"
      }
    ],
    "deploymentCount": 5,
    "createdAt": "2026-06-22T10:00:00.000Z",
    "updatedAt": "2026-06-22T10:00:00.000Z"
  }
}
```

**Errors:**

| Status | Error              |
|--------|--------------------|
| `404`  | Project not found  |
| `500`  | Internal server error |

---

### PUT /api/projects/:id

Update project settings. Only provided fields are updated.

**Request Body (all fields optional):**

```json
{
  "name": "my-app-v2",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDir": "dist",
  "installCommand": "pnpm install",
  "rootDirectory": "packages/web"
}
```

**Response - 200 OK:**

```json
{
  "success": true,
  "data": {
    "id": "proj_abc123",
    "name": "my-app-v2",
    "framework": "vite",
    "buildCommand": "npm run build",
    "outputDir": "dist",
    "installCommand": "pnpm install",
    "rootDirectory": "packages/web",
    "createdAt": "2026-06-22T10:00:00.000Z",
    "updatedAt": "2026-06-22T14:00:00.000Z"
  },
  "message": "Project updated successfully"
}
```

**Errors:**

| Status | Error                                    |
|--------|------------------------------------------|
| `404`  | Project not found                        |
| `409`  | A project with that name already exists  |
| `500`  | Internal server error                    |

---

### DELETE /api/projects/:id

Delete a project and all associated resources (deployments, domains, env vars, edge functions, redirect rules).

**Response - 200 OK:**

```json
{
  "success": true,
  "message": "Project deleted successfully"
}
```

**Errors:**

| Status | Error              |
|--------|--------------------|
| `404`  | Project not found  |
| `500`  | Internal server error |

---

### GET /api/projects/:id/deployments

List deployments for a project with pagination.

**Query Parameters:**

| Param   | Type     | Default |
|---------|----------|---------|
| `page`  | `number` | `1`     |
| `limit` | `number` | `20`    |

**Response - 200 OK:**

```json
{
  "success": true,
  "data": [
    {
      "id": "dep_xyz789",
      "projectId": "proj_abc123",
      "status": "ready",
      "branch": "main",
      "commitSha": "a1b2c3d",
      "commitMsg": "feat: add landing page",
      "url": "https://my-app-xyz789.example.com",
      "createdAt": "2026-06-22T12:00:00.000Z",
      "completedAt": "2026-06-22T12:02:30.000Z"
    }
  ],
  "pagination": {
    "total": 5,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

## Git Integration

### POST /api/git/connect

Connect a GitHub or GitLab repository to a project.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "provider": "github",
  "repoId": 123456789,
  "projectId": "proj_abc123",
  "repoName": "user/my-app"
}
```

| Field       | Type               | Required | Notes                     |
|-------------|--------------------|----------|---------------------------|
| `provider`  | `string`           | Yes      | `"github"` or `"gitlab"` |
| `repoId`    | `string / number`  | Yes      | Repository ID             |
| `projectId` | `string`           | Yes      | Target project ID         |
| `repoName`  | `string`           | No       | e.g. `owner/repo`        |

**Response - 200 OK:**

```json
{
  "project": {
    "id": "proj_abc123",
    "githubRepoId": "123456789",
    "githubRepoName": "user/my-app"
  },
  "webhookUrl": "http://localhost:3000/api/git/webhook",
  "webhookSecret": "mini-vercel-webhook-secret",
  "message": "Repository connected via github"
}
```

**Errors:**

| Status | Error                              |
|--------|------------------------------------|
| `400`  | provider, repoId, and projectId are required |
| `400`  | provider must be 'github' or 'gitlab' |
| `401`  | Missing or invalid authorization header |
| `404`  | Project not found                  |
| `500`  | Internal server error              |

---

### POST /api/git/webhook

Webhook receiver for GitHub/GitLab push events. Automatically creates a new deployment when a push is received.

**Headers:**

| Header                 | Notes                                    |
|------------------------|------------------------------------------|
| `X-GitHub-Event`       | GitHub event type (e.g. `push`)          |
| `X-GitHub-Signature-256` | HMAC signature for verification     |
| `X-GitLab-Event`       | GitLab event type                        |
| `X-GitLab-Token`       | GitLab webhook token                     |

**Request Body (GitHub push event):**

```json
{
  "ref": "refs/heads/main",
  "head_commit": {
    "id": "a1b2c3d4e5f6",
    "message": "feat: update homepage"
  },
  "repository": {
    "id": 123456789,
    "full_name": "user/my-app"
  }
}
```

**Response - 201 Created:**

```json
{
  "deploymentId": "dep_new123",
  "status": "queued",
  "message": "Deployment queued"
}
```

**Other Responses:**

| Status | Body                              | When                              |
|--------|-----------------------------------|-----------------------------------|
| `200`  | `{ "message": "Event ignored" }`  | Non-push event                    |
| `200`  | `{ "message": "No matching project" }` | Repo not linked to any project |
| `401`  | `{ "error": "Invalid webhook signature" }` | Bad signature           |

---

### GET /api/git/repos

List repositories from a connected GitHub or GitLab account.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**

| Param         | Type     | Required | Notes                          |
|---------------|----------|----------|--------------------------------|
| `provider`    | `string` | Yes      | `"github"` or `"gitlab"`      |
| `accessToken` | `string` | Yes      | OAuth access token for the provider |

**Response - 200 OK:**

```json
{
  "repos": [
    {
      "id": 123456789,
      "name": "my-app",
      "full_name": "user/my-app",
      "private": false,
      "html_url": "https://github.com/user/my-app"
    }
  ],
  "provider": "github"
}
```

**Errors:**

| Status | Error                              |
|--------|------------------------------------|
| `400`  | provider and accessToken query params are required |
| `400`  | provider must be 'github' or 'gitlab' |
| `500`  | Failed to list repositories        |

---

### DELETE /api/git/disconnect

Disconnect a repository from a project.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "projectId": "proj_abc123"
}
```

**Response - 200 OK:**

```json
{
  "message": "Repository disconnected"
}
```

**Errors:**

| Status | Error                                      |
|--------|--------------------------------------------|
| `400`  | projectId is required                      |
| `400`  | Project is not connected to a repository   |
| `404`  | Project not found                          |
| `500`  | Internal server error                      |

---

## Build System

### POST /api/builds

Trigger a new build for a project.

**Request Body:**

```json
{
  "projectId": "proj_abc123",
  "branch": "main",
  "commitSha": "a1b2c3d",
  "commitMsg": "feat: add feature"
}
```

| Field        | Type     | Required | Notes             |
|--------------|----------|----------|-------------------|
| `projectId`  | `string` | Yes      |                   |
| `branch`     | `string` | No       | Defaults to `main` |
| `commitSha`  | `string` | No       | Git SHA            |
| `commitMsg`  | `string` | No       | Commit message     |

**Response - 201 Created:**

```json
{
  "success": true,
  "data": {
    "id": "dep_build01",
    "projectId": "proj_abc123",
    "status": "queued",
    "branch": "main",
    "commitSha": "a1b2c3d",
    "commitMsg": "feat: add feature",
    "createdAt": "2026-06-22T12:00:00.000Z"
  },
  "message": "Build triggered successfully"
}
```

**Errors:**

| Status | Error                |
|--------|----------------------|
| `400`  | projectId is required |
| `404`  | Project not found    |
| `500`  | Internal server error |

---

### GET /api/builds/:id

Get build status, including active state and viewer count.

**Response - 200 OK:**

```json
{
  "success": true,
  "data": {
    "id": "dep_build01",
    "projectId": "proj_abc123",
    "status": "building",
    "branch": "main",
    "commitSha": "a1b2c3d",
    "commitMsg": "feat: add feature",
    "buildLog": "Installing dependencies...\nBuilding...\n",
    "isActive": true,
    "viewerCount": 3,
    "createdAt": "2026-06-22T12:00:00.000Z"
  }
}
```

**Errors:**

| Status | Error              |
|--------|--------------------|
| `404`  | Build not found    |
| `500`  | Internal server error |

---

### GET /api/builds/:id/logs

Stream build logs via **Server-Sent Events (SSE)**.

**Response:** `Content-Type: text/event-stream`

The connection stays open, pushing real-time log events as the build progresses:

```
data: {"type":"log","message":"Installing dependencies...","timestamp":"2026-06-22T12:00:01.000Z"}

data: {"type":"log","message":"Build complete","timestamp":"2026-06-22T12:02:00.000Z"}

data: {"type":"done","status":"ready"}
```

**Errors (returned before SSE stream opens):**

| Status | Error              |
|--------|--------------------|
| `404`  | Build not found    |
| `500`  | Internal server error |

---

### POST /api/builds/:id/cancel

Cancel a running or queued build.

**Response - 200 OK:**

```json
{
  "success": true,
  "message": "Build cancelled successfully"
}
```

**Errors:**

| Status | Error                                              |
|--------|----------------------------------------------------|
| `400`  | Cannot cancel build with status: `ready`           |
| `400`  | Build is not currently active                      |
| `404`  | Build not found                                    |
| `500`  | Internal server error                              |

---

### GET /api/builds

List builds for a project with filtering and pagination.

**Query Parameters:**

| Param      | Type     | Required | Notes                     |
|------------|----------|----------|---------------------------|
| `projectId`| `string` | Yes      |                           |
| `page`     | `number` | No       | Default `1`               |
| `limit`    | `number` | No       | Default `20`, max `100`   |
| `status`   | `string` | No       | Filter by build status    |
| `branch`   | `string` | No       | Filter by branch name     |

**Response - 200 OK:**

```json
{
  "success": true,
  "data": [
    {
      "id": "dep_build01",
      "status": "ready",
      "branch": "main",
      "isActive": false,
      "project": {
        "id": "proj_abc123",
        "name": "my-app",
        "framework": "nextjs"
      },
      "createdAt": "2026-06-22T12:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 5,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

**Errors:**

| Status | Error                              |
|--------|------------------------------------|
| `400`  | projectId query parameter is required |
| `500`  | Internal server error              |

---

## Deployment Management

### GET /api/deployments

List deployments for a project with filtering and pagination.

**Query Parameters:**

| Param      | Type     | Required | Notes                     |
|------------|----------|----------|---------------------------|
| `projectId`| `string` | Yes      |                           |
| `page`     | `number` | No       | Default `1`               |
| `limit`    | `number` | No       | Default `20`, max `100`   |
| `status`   | `string` | No       | Filter by status          |
| `branch`   | `string` | No       | Filter by branch          |

**Response - 200 OK:**

```json
{
  "success": true,
  "data": [
    {
      "id": "dep_xyz789",
      "projectId": "proj_abc123",
      "status": "ready",
      "url": "https://my-app-xyz789.example.com",
      "branch": "main",
      "commitSha": "a1b2c3d",
      "commitMsg": "feat: add landing page",
      "createdAt": "2026-06-22T12:00:00.000Z",
      "completedAt": "2026-06-22T12:02:30.000Z"
    }
  ],
  "pagination": {
    "total": 10,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### GET /api/deployments/:id

Get full deployment details including project info and viewer count.

**Response - 200 OK:**

```json
{
  "success": true,
  "data": {
    "id": "dep_xyz789",
    "projectId": "proj_abc123",
    "status": "ready",
    "url": "https://my-app-xyz789.example.com",
    "branch": "main",
    "commitSha": "a1b2c3d",
    "commitMsg": "feat: add landing page",
    "buildLog": "Installing dependencies...\nBuilding...\nDone.\n",
    "viewerCount": 1,
    "project": {
      "id": "proj_abc123",
      "name": "my-app",
      "framework": "nextjs"
    },
    "createdAt": "2026-06-22T12:00:00.000Z",
    "completedAt": "2026-06-22T12:02:30.000Z"
  }
}
```

**Errors:**

| Status | Error                |
|--------|----------------------|
| `404`  | Deployment not found |
| `500`  | Internal server error |

---

### POST /api/deployments/:id/promote

Promote a preview deployment to production by clearing its branch association.

**Response - 200 OK:**

```json
{
  "success": true,
  "data": {
    "id": "dep_xyz789",
    "status": "ready",
    "branch": null,
    "project": {
      "id": "proj_abc123",
      "name": "my-app"
    }
  },
  "message": "Deployment promoted to production"
}
```

**Errors:**

| Status | Error                              |
|--------|------------------------------------|
| `400`  | Can only promote a ready deployment |
| `404`  | Deployment not found               |
| `500`  | Internal server error              |

---

### POST /api/deployments/:id/rollback

Rollback to a previous deployment by creating a new deployment with the same code.

**Response - 200 OK:**

```json
{
  "success": true,
  "data": {
    "id": "dep_rollback01",
    "status": "queued",
    "projectId": "proj_abc123",
    "branch": "main",
    "commitSha": "a1b2c3d"
  },
  "message": "Rolled back. New deployment: dep_rollback01"
}
```

**Errors:**

| Status | Error                |
|--------|----------------------|
| `404`  | Deployment not found |
| `500`  | Internal server error |

---

### DELETE /api/deployments/:id

Delete a deployment.

**Response - 200 OK:**

```json
{
  "success": true,
  "message": "Deployment deleted successfully"
}
```

**Errors:**

| Status | Error                |
|--------|----------------------|
| `404`  | Deployment not found |
| `500`  | Internal server error |

---

## Domain Management

### POST /api/domains

Add a custom domain to a project.

**Request Body:**

```json
{
  "projectId": "proj_abc123",
  "name": "my-app.example.com"
}
```

| Field       | Type     | Required | Notes                                  |
|-------------|----------|----------|----------------------------------------|
| `projectId` | `string` | Yes      |                                        |
| `name`      | `string` | Yes      | Valid domain, supports wildcards (`*.example.com`) |

**Response - 201 Created:**

```json
{
  "id": "dom_abc123",
  "projectId": "proj_abc123",
  "name": "my-app.example.com",
  "verified": false,
  "sslStatus": "none",
  "createdAt": "2026-06-22T10:00:00.000Z",
  "verificationToken": "a1b2c3d4e5f6..."
}
```

**Errors:**

| Status | Error                          |
|--------|--------------------------------|
| `400`  | projectId and name are required |
| `400`  | Invalid domain name            |
| `404`  | Project not found              |
| `409`  | Domain already registered      |
| `500`  | Internal server error          |

---

### GET /api/domains

List all domains for a project.

**Query Parameters:**

| Param      | Type     | Required |
|------------|----------|----------|
| `projectId`| `string` | Yes      |

**Response - 200 OK:**

```json
[
  {
    "id": "dom_abc123",
    "projectId": "proj_abc123",
    "name": "my-app.example.com",
    "verified": true,
    "sslStatus": "active",
    "createdAt": "2026-06-22T10:00:00.000Z",
    "updatedAt": "2026-06-22T10:30:00.000Z"
  }
]
```

**Errors:**

| Status | Error                              |
|--------|------------------------------------|
| `400`  | projectId query parameter is required |
| `500`  | Internal server error              |

---

### DELETE /api/domains/:id

Remove a domain.

**Response - 200 OK:**

```json
{
  "message": "Domain deleted successfully"
}
```

**Errors:**

| Status | Error              |
|--------|--------------------|
| `404`  | Domain not found   |
| `500`  | Internal server error |

---

### POST /api/domains/:id/verify

Trigger DNS verification for a domain.

**Response - 200 OK:**

```json
{
  "verified": true,
  "message": "Domain verified successfully",
  "records": {
    "A": ["76.76.21.21"],
    "CNAME": ["cname.vercel-dns.com"]
  },
  "hint": "Add a TXT record: my-app.example.com -> _mini-vercel-verify=a1b2c3..."
}
```

**Errors:**

| Status | Error              |
|--------|--------------------|
| `404`  | Domain not found   |
| `500`  | Internal server error |

---

### POST /api/domains/:id/ssl

Request an SSL certificate for a verified domain.

**Response - 200 OK:**

```json
{
  "status": "active",
  "domain": "my-app.example.com",
  "issuedAt": "2026-06-22T10:30:00.000Z",
  "expiresAt": "2026-09-22T10:30:00.000Z",
  "message": "SSL certificate issued successfully"
}
```

**Errors:**

| Status | Error                                              |
|--------|----------------------------------------------------|
| `400`  | Domain must be verified before requesting SSL certificate |
| `404`  | Domain not found                                   |
| `500`  | Internal server error                              |

---

## Environment Variables

All environment variable values are AES-encrypted at rest. API responses return masked values (e.g. `s3cr****`).

### POST /api/env

Create a new environment variable.

**Request Body:**

```json
{
  "projectId": "proj_abc123",
  "key": "DATABASE_URL",
  "value": "postgres://user:pass@localhost:5432/mydb"
}
```

| Field       | Type     | Required | Notes                                           |
|-------------|----------|----------|-------------------------------------------------|
| `projectId` | `string` | Yes      |                                                 |
| `key`       | `string` | Yes      | Must match `^[A-Za-z_][A-Za-z0-9_]*$`          |
| `value`     | `string` | Yes      |                                                 |

**Response - 201 Created:**

```json
{
  "id": "env_abc123",
  "projectId": "proj_abc123",
  "key": "DATABASE_URL",
  "value": "post***************l5432/mydb",
  "encrypted": true,
  "createdAt": "2026-06-22T10:00:00.000Z"
}
```

**Errors:**

| Status | Error                              |
|--------|------------------------------------|
| `400`  | projectId, key, and value are required |
| `400`  | Env var key format validation error |
| `404`  | Project not found                  |
| `409`  | Environment variable already exists. Use PUT to update. |
| `500`  | Internal server error              |

---

### GET /api/env

List all environment variables for a project (values are masked).

**Query Parameters:**

| Param      | Type     | Required |
|------------|----------|----------|
| `projectId`| `string` | Yes      |

**Response - 200 OK:**

```json
[
  {
    "id": "env_abc123",
    "projectId": "proj_abc123",
    "key": "DATABASE_URL",
    "value": "post***************l5432/mydb",
    "encrypted": true,
    "createdAt": "2026-06-22T10:00:00.000Z",
    "updatedAt": "2026-06-22T10:00:00.000Z"
  },
  {
    "id": "env_def456",
    "projectId": "proj_abc123",
    "key": "API_KEY",
    "value": "sk-*************xyz",
    "encrypted": true,
    "createdAt": "2026-06-22T10:05:00.000Z",
    "updatedAt": "2026-06-22T10:05:00.000Z"
  }
]
```

---

### PUT /api/env/:id

Update an existing environment variable's key and/or value.

**Request Body (both fields optional):**

```json
{
  "key": "NEW_API_KEY",
  "value": "sk-new-key-value"
}
```

**Response - 200 OK:**

```json
{
  "id": "env_abc123",
  "projectId": "proj_abc123",
  "key": "NEW_API_KEY",
  "value": "sk-*************lue",
  "encrypted": true,
  "createdAt": "2026-06-22T10:00:00.000Z",
  "updatedAt": "2026-06-22T14:00:00.000Z"
}
```

**Errors:**

| Status | Error                              |
|--------|------------------------------------|
| `400`  | Env var key format validation error |
| `404`  | Environment variable not found     |
| `409`  | Environment variable already exists in this project |
| `500`  | Internal server error              |

---

### DELETE /api/env/:id

Delete an environment variable.

**Response - 200 OK:**

```json
{
  "message": "Environment variable deleted successfully"
}
```

**Errors:**

| Status | Error                              |
|--------|------------------------------------|
| `404`  | Environment variable not found     |
| `500`  | Internal server error              |

---

### POST /api/env/bulk

Create or update multiple environment variables in one request.

**Request Body:**

```json
{
  "projectId": "proj_abc123",
  "vars": [
    { "key": "DATABASE_URL", "value": "postgres://localhost/mydb" },
    { "key": "API_KEY", "value": "sk-12345" },
    { "key": "REDIS_URL", "value": "redis://localhost:6379" }
  ]
}
```

**Response - 200 OK:**

```json
{
  "created": 2,
  "updated": 1,
  "errors": 0,
  "results": [
    { "key": "DATABASE_URL", "action": "created", "id": "env_1" },
    { "key": "API_KEY", "action": "created", "id": "env_2" },
    { "key": "REDIS_URL", "action": "updated", "id": "env_3" }
  ],
  "errorDetails": []
}
```

**Errors:**

| Status | Error                              |
|--------|------------------------------------|
| `400`  | projectId and vars array are required |
| `404`  | Project not found                  |
| `500`  | Internal server error              |

Individual item errors are returned in the `errorDetails` array without failing the entire request.

---

## Edge Functions

### POST /api/functions

Create a new edge function.

**Request Body:**

```json
{
  "projectId": "proj_abc123",
  "name": "hello-world",
  "path": "/api/hello",
  "runtime": "nodejs",
  "code": "export default async function handler(req) { return new Response('Hello!'); }"
}
```

| Field       | Type     | Required | Notes                          |
|-------------|----------|----------|--------------------------------|
| `projectId` | `string` | Yes      |                                |
| `name`      | `string` | Yes      | Display name                   |
| `path`      | `string` | Yes      | URL path (auto-prefixed with `/`) |
| `runtime`   | `string` | No       | Default `nodejs`               |
| `code`      | `string` | Yes      | JavaScript source code         |

**Response - 201 Created:**

```json
{
  "id": "fn_abc123",
  "projectId": "proj_abc123",
  "name": "hello-world",
  "path": "/api/hello",
  "runtime": "nodejs",
  "code": "export default async function handler(req) { return new Response('Hello!'); }",
  "createdAt": "2026-06-22T10:00:00.000Z",
  "updatedAt": "2026-06-22T10:00:00.000Z"
}
```

**Errors:**

| Status | Error                              |
|--------|------------------------------------|
| `400`  | projectId, name, path, and code are required |
| `404`  | Project not found                  |
| `409`  | A function already exists at path  |
| `500`  | Internal server error              |

---

### GET /api/functions

List all edge functions for a project.

**Query Parameters:**

| Param      | Type     | Required |
|------------|----------|----------|
| `projectId`| `string` | Yes      |

**Response - 200 OK:**

```json
[
  {
    "id": "fn_abc123",
    "projectId": "proj_abc123",
    "name": "hello-world",
    "path": "/api/hello",
    "runtime": "nodejs",
    "createdAt": "2026-06-22T10:00:00.000Z",
    "updatedAt": "2026-06-22T10:00:00.000Z"
  }
]
```

---

### PUT /api/functions/:id

Update an edge function. Partial updates are supported. Updating `code` resets the cold-start cache.

**Request Body (all fields optional):**

```json
{
  "name": "hello-world-v2",
  "path": "/api/hello-v2",
  "runtime": "nodejs",
  "code": "export default async function handler(req) { return new Response('Hello v2!'); }"
}
```

**Response - 200 OK:**

```json
{
  "id": "fn_abc123",
  "projectId": "proj_abc123",
  "name": "hello-world-v2",
  "path": "/api/hello-v2",
  "runtime": "nodejs",
  "code": "export default async function handler(req) { return new Response('Hello v2!'); }",
  "createdAt": "2026-06-22T10:00:00.000Z",
  "updatedAt": "2026-06-22T14:00:00.000Z"
}
```

**Errors:**

| Status | Error                              |
|--------|------------------------------------|
| `404`  | Function not found                 |
| `409`  | A function already exists at path  |
| `500`  | Internal server error              |

---

### DELETE /api/functions/:id

Delete an edge function and clear its logs and cold-start cache.

**Response - 200 OK:**

```json
{
  "message": "Function deleted successfully"
}
```

**Errors:**

| Status | Error              |
|--------|--------------------|
| `404`  | Function not found |
| `500`  | Internal server error |

---

### POST /api/functions/:id/invoke

Invoke an edge function with a simulated request.

**Request Body:**

```json
{
  "method": "GET",
  "url": "/api/hello?name=world",
  "headers": { "Accept": "application/json" },
  "body": null,
  "query": { "name": "world" }
}
```

| Field     | Type     | Required | Notes                          |
|-----------|----------|----------|--------------------------------|
| `method`  | `string` | No       | Default `GET`                  |
| `url`     | `string` | No       | Default `/`                    |
| `headers` | `object` | No       | Request headers                |
| `body`    | `any`    | No       | Request body                   |
| `query`   | `object` | No       | Query parameters               |

**Response - 200 OK (status depends on function):**

```json
{
  "result": "Hello!",
  "headers": { "content-type": "text/plain" },
  "coldStart": true,
  "duration": 12,
  "functionId": "fn_abc123",
  "functionName": "hello-world"
}
```

| Field         | Type      | Notes                                |
|---------------|-----------|--------------------------------------|
| `coldStart`   | `boolean` | `true` if this was the first invocation |
| `duration`    | `number`  | Execution time in milliseconds       |
| `result`      | `any`     | The function's return value          |

**Errors:**

| Status | Error              |
|--------|--------------------|
| `404`  | Function not found |
| `500`  | Internal server error |

---

### GET /api/functions/:id/logs

Retrieve recent invocation logs for an edge function.

**Query Parameters:**

| Param   | Type     | Default |
|---------|----------|---------|
| `limit` | `number` | `100`   |

**Response - 200 OK:**

```json
{
  "functionId": "fn_abc123",
  "functionName": "hello-world",
  "logs": [
    {
      "timestamp": "2026-06-22T12:00:00.000Z",
      "method": "GET",
      "url": "/api/hello",
      "status": 200,
      "duration": 12,
      "coldStart": false
    }
  ],
  "total": 1
}
```

**Errors:**

| Status | Error              |
|--------|--------------------|
| `404`  | Function not found |
| `500`  | Internal server error |

---

## Analytics

### GET /api/analytics/traffic/:projectId

Get traffic statistics for a project.

**Query Parameters:**

| Param  | Type     | Required | Notes            |
|--------|----------|----------|------------------|
| `from` | `string` | No       | ISO 8601 date    |
| `to`   | `string` | No       | ISO 8601 date    |

**Response - 200 OK:**

```json
{
  "totalRequests": 15234,
  "uniqueVisitors": 3842,
  "bandwidth": "1.2 GB",
  "requestsByDay": [
    { "date": "2026-06-20", "requests": 2100 },
    { "date": "2026-06-21", "requests": 2800 },
    { "date": "2026-06-22", "requests": 1900 }
  ],
  "topPages": [
    { "path": "/", "hits": 5200 },
    { "path": "/about", "hits": 1200 }
  ]
}
```

**Errors:**

| Status | Error                          |
|--------|--------------------------------|
| `500`  | Failed to fetch traffic stats  |

---

### GET /api/analytics/performance/:projectId

Get performance metrics for a project.

**Query Parameters:**

| Param  | Type     | Required | Notes            |
|--------|----------|----------|------------------|
| `from` | `string` | No       | ISO 8601 date    |
| `to`   | `string` | No       | ISO 8601 date    |

**Response - 200 OK:**

```json
{
  "avgResponseTime": 142,
  "p95ResponseTime": 320,
  "p99ResponseTime": 580,
  "avgTtfb": 45,
  "cacheHitRatio": 0.87,
  "responseTimesByDay": [
    { "date": "2026-06-20", "avg": 138 },
    { "date": "2026-06-21", "avg": 145 },
    { "date": "2026-06-22", "avg": 142 }
  ]
}
```

**Errors:**

| Status | Error                                    |
|--------|------------------------------------------|
| `500`  | Failed to fetch performance metrics      |

---

### GET /api/analytics/errors/:projectId

Get error statistics for a project.

**Query Parameters:**

| Param  | Type     | Required | Notes            |
|--------|----------|----------|------------------|
| `from` | `string` | No       | ISO 8601 date    |
| `to`   | `string` | No       | ISO 8601 date    |

**Response - 200 OK:**

```json
{
  "totalErrors": 23,
  "errorRate": 0.0015,
  "errorsByDay": [
    { "date": "2026-06-20", "count": 8 },
    { "date": "2026-06-21", "count": 10 },
    { "date": "2026-06-22", "count": 5 }
  ],
  "topErrors": [
    { "status": 500, "count": 12, "lastSeen": "2026-06-22T12:00:00.000Z" },
    { "status": 404, "count": 11, "lastSeen": "2026-06-22T11:45:00.000Z" }
  ]
}
```

**Errors:**

| Status | Error                             |
|--------|-----------------------------------|
| `500`  | Failed to fetch error stats       |

---

## Health Check

### GET /api/health

Returns server status. No authentication required.

**Response - 200 OK:**

```json
{
  "status": "ok",
  "timestamp": "2026-06-22T12:00:00.000Z",
  "uptime": 3600.5
}
```

---

## CLI Command Reference

The Mini Vercel CLI is installed as `mini-vercel`. The API base URL defaults to `http://localhost:4000/api` and can be overridden via the `MINI_VERCEL_API` environment variable.

Global config is stored at `~/.mini-vercel/config.json`. Per-project config is stored at `.mini-vercel.json` in the project root.

### mini-vercel login

Interactive login. Prompts for email and password, then stores the auth token globally.

```bash
mini-vercel login
# Prompts:
#   Email: user@example.com
#   Password: ********
# Saved to: ~/.mini-vercel/config.json
```

### mini-vercel whoami

Display the currently authenticated user.

```bash
mini-vercel whoami
# Output:
#   Logged in as:
#     Name:  Jane Doe
#     Email: user@example.com
```

### mini-vercel deploy init

Initialize a new project. Creates a `vercel.json` configuration file locally and creates the project on the server.

```bash
mini-vercel deploy init
# Prompts:
#   Project name: (default: current directory name)
#   Framework: node | static | next | react | python
#   Build command: (optional, leave empty for default)
#   Output directory: (default: ./dist)
#
# Creates: vercel.json + .mini-vercel.json
```

**Generated `vercel.json`:**

```json
{
  "name": "my-app",
  "framework": "node",
  "buildCommand": "",
  "outputDir": "./dist",
  "installCommand": "npm install"
}
```

**Generated `.mini-vercel.json`:**

```json
{
  "projectId": "proj_abc123",
  "projectName": "my-app"
}
```

### mini-vercel deploy

Deploy the current directory. Reads the output directory from `vercel.json` (defaults to `./dist`). If the output directory does not exist, offers to upload source files directly.

```bash
mini-vercel deploy
# Uploads files from ./dist (or ./) to the server
# Output:
#   Deployment ready!
#     URL:      https://my-app-xyz789.example.com
#     Status:   ready
#     ID:       dep_xyz789
```

**Options:** None (uses `.mini-vercel.json` for project ID).

### mini-vercel deploy logs [deployment-id]

View deployment logs. Without a deployment ID, lists the 10 most recent deployments.

```bash
# List recent deployments
mini-vercel deploy logs
# Output:
#   Recent deployments:
#   dep_xyz78  ready       https://my-app-xyz789.example.com
#   dep_abc12  building
#   dep_def34  failed

# View logs for a specific deployment
mini-vercel deploy logs dep_xyz789
# Output:
#   [12:00:01] Installing dependencies...
#   [12:00:15] Building project...
#   [12:02:28] Build complete.
#   [12:02:30] Deployment ready.
```

### mini-vercel deploy env

Manage environment variables for the current project.

```bash
# List all environment variables
mini-vercel deploy env --list
# Output:
#   Environment variables:
#     DATABASE_URL  (set)
#     API_KEY       (set)
#     REDIS_URL     (set)

# Set an environment variable
mini-vercel deploy env --set "DATABASE_URL=postgres://localhost/mydb"
# Output:
#   Environment variable DATABASE_URL set

# Delete an environment variable
mini-vercel deploy env --delete DATABASE_URL
# Output:
#   Environment variable DATABASE_URL deleted
```

| Option                      | Description                          |
|-----------------------------|--------------------------------------|
| `-l, --list`                | List all environment variables       |
| `-s, --set <key=value>`     | Create or update an env var          |
| `-d, --delete <key>`        | Delete an env var                    |

### mini-vercel deploy domains

Manage custom domains for the current project.

```bash
# List all domains
mini-vercel deploy domains --list
# Output:
#   Domains:
#     my-app.example.com  Verified  SSL active
#     staging.example.com  Pending      SSL pending

# Add a domain
mini-vercel deploy domains --add my-app.example.com
# Output:
#   Domain my-app.example.com added

# Verify a domain
mini-vercel deploy domains --verify my-app.example.com
# Output:
#   Domain my-app.example.com verification initiated

# Remove a domain
mini-vercel deploy domains --remove my-app.example.com
# Output:
#   Domain my-app.example.com removed

# Interactive mode (no flags)
mini-vercel deploy domains
# Prompts: List | Add | Remove | Verify
```

| Option                      | Description                          |
|-----------------------------|--------------------------------------|
| `-l, --list`                | List all domains                     |
| `-a, --add <domain>`        | Add a custom domain                  |
| `-r, --remove <domain>`     | Remove a domain                      |
| `-v, --verify <domain>`     | Initiate DNS verification            |

---

## Error Reference

### Standard Error Response Format

All errors follow a consistent JSON structure:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

Or for simpler endpoints:

```json
{
  "error": "Human-readable error message"
}
```

### HTTP Status Codes

| Code | Meaning              | When                                                  |
|------|----------------------|-------------------------------------------------------|
| `200` | OK                  | Successful GET, PUT, DELETE, POST                      |
| `201` | Created             | Successful resource creation (register, deploy, etc.) |
| `400` | Bad Request         | Missing required fields, invalid input, validation errors |
| `401` | Unauthorized        | Missing/invalid/expired auth token, invalid credentials |
| `404` | Not Found           | Resource does not exist, unknown endpoint             |
| `409` | Conflict            | Duplicate email, project name, domain, or env var key |
| `500` | Internal Server Error | Unhandled exceptions, database errors                |

### Common Error Messages

| Error                                          | Status | Endpoint                 |
|------------------------------------------------|--------|--------------------------|
| `Email, name, and password are required`       | `400`  | `POST /auth/register`    |
| `Password must be at least 8 characters`       | `400`  | `POST /auth/register`    |
| `Invalid email format`                         | `400`  | `POST /auth/register`    |
| `Invalid credentials`                          | `401`  | `POST /auth/login`       |
| `Missing or invalid authorization header`      | `401`  | All authenticated routes |
| `Invalid or expired token`                     | `401`  | All authenticated routes |
| `Invalid or expired refresh token`             | `401`  | `POST /auth/refresh`     |
| `Project name is required`                     | `400`  | `POST /projects`         |
| `projectId is required`                        | `400`  | `POST /builds`, etc.     |
| `Project not found`                            | `404`  | Multiple endpoints       |
| `User already exists`                          | `409`  | `POST /auth/register`    |
| `A project with that name already exists`      | `409`  | `POST /projects`         |
| `Domain already registered`                    | `409`  | `POST /domains`          |
| `Invalid domain name`                          | `400`  | `POST /domains`          |
| `Domain must be verified before requesting SSL`| `400`  | `POST /domains/:id/ssl`  |
| `Env var key format validation error`          | `400`  | `POST /env`              |
| `Environment variable already exists`          | `409`  | `POST /env`              |
| `A function already exists at path`            | `409`  | `POST /functions`        |
| `Can only promote a ready deployment`          | `400`  | `POST /deployments/:id/promote` |
| `Cannot cancel build with status: X`           | `400`  | `POST /builds/:id/cancel` |
| `Invalid webhook signature`                    | `401`  | `POST /git/webhook`      |
| `Build not found`                              | `404`  | `GET /builds/:id`        |
| `Deployment not found`                         | `404`  | `GET /deployments/:id`   |
| `Function not found`                           | `404`  | `GET /functions/:id`     |

---

## Supported Frameworks

The following frameworks are supported with auto-detected build settings:

| Framework          | Build Command                  | Output Dir |
|--------------------|--------------------------------|------------|
| `nextjs`           | `npx next build`              | `.next`    |
| `nuxt`             | `npx nuxt build`              | `.output`  |
| `vite`             | `npm run build`               | `dist`     |
| `remix`            | `npx remix build`             | `build`    |
| `gatsby`           | `npx gatsby build`            | `public`   |
| `astro`            | `npx astro build`             | `dist`     |
| `sveltekit`        | `npx svelte-kit build`        | `build`    |
| `create-react-app` | `npx react-scripts build`     | `build`    |
| `vue-cli`          | `npx vue-cli-service build`   | `dist`     |
| `node`             | *(custom)*                    | *(custom)* |
