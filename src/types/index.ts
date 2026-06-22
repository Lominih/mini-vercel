import { Request, Response, NextFunction } from "express";

// 鈹€鈹€鈹€ Framework Detection 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export type Framework =
  | "nextjs"
  | "vite"
  | "nuxt"
  | "remix"
  | "gatsby"
  | "astro"
  | "sveltekit"
  | "create-react-app"
  | "vue-cli"
  | "node"
  | "unknown";

export interface FrameworkConfig {
  name: Framework;
  displayName: string;
  configFile: string[];
  buildCommand: string;
  outputDir: string;
  devCommand?: string;
}

export const FRAMEWORKS: FrameworkConfig[] = [
  {
    name: "nextjs",
    displayName: "Next.js",
    configFile: ["next.config.js", "next.config.mjs", "next.config.ts"],
    buildCommand: "npx next build",
    outputDir: ".next",
    devCommand: "npx next dev",
  },
  {
    name: "nuxt",
    displayName: "Nuxt",
    configFile: ["nuxt.config.js", "nuxt.config.ts", "nuxt.config.mjs"],
    buildCommand: "npx nuxt build",
    outputDir: ".output",
  },
  {
    name: "vite",
    displayName: "Vite",
    configFile: ["vite.config.js", "vite.config.ts", "vite.config.mjs"],
    buildCommand: "npm run build",
    outputDir: "dist",
  },
  {
    name: "remix",
    displayName: "Remix",
    configFile: ["remix.config.js", "remix.config.ts", "remix.config.mjs"],
    buildCommand: "npx remix build",
    outputDir: "build",
  },
  {
    name: "gatsby",
    displayName: "Gatsby",
    configFile: ["gatsby-config.js", "gatsby-config.ts", "gatsby-config.mjs"],
    buildCommand: "npx gatsby build",
    outputDir: "public",
  },
  {
    name: "astro",
    displayName: "Astro",
    configFile: ["astro.config.js", "astro.config.ts", "astro.config.mjs"],
    buildCommand: "npx astro build",
    outputDir: "dist",
  },
  {
    name: "sveltekit",
    displayName: "SvelteKit",
    configFile: ["svelte.config.js", "svelte.config.ts"],
    buildCommand: "npx svelte-kit build",
    outputDir: "build",
  },
  {
    name: "create-react-app",
    displayName: "Create React App",
    configFile: [],
    buildCommand: "npx react-scripts build",
    outputDir: "build",
  },
  {
    name: "vue-cli",
    displayName: "Vue CLI",
    configFile: ["vue.config.js", "vue.config.ts"],
    buildCommand: "npx vue-cli-service build",
    outputDir: "dist",
  },
];

// 鈹€鈹€鈹€ Build Status 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export type BuildStatus =
  | "queued"
  | "building"
  | "deploying"
  | "ready"
  | "failed"
  | "cancelled";

export interface BuildResult {
  deploymentId: string;
  status: BuildStatus;
  buildLog: string;
  duration: number;
  error?: string;
}

// 鈹€鈹€鈹€ API Response Helpers 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// 鈹€鈹€鈹€ Request Types 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export interface CreateProjectBody {
  name: string;
  framework?: Framework;
  buildCommand?: string;
  outputDir?: string;
  installCommand?: string;
  rootDirectory?: string;
}

export interface UpdateProjectBody {
  name?: string;
  framework?: Framework;
  buildCommand?: string;
  outputDir?: string;
  installCommand?: string;
  rootDirectory?: string;
}

export interface TriggerBuildBody {
  projectId: string;
  branch?: string;
  commitSha?: string;
  commitMsg?: string;
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
}

// 鈹€鈹€鈹€ SSE Types 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export interface SSEClient {
  id: string;
  res: Response;
  deploymentId: string;
  connectedAt: Date;
}

// 鈹€鈹€鈹€ Express augmentation 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

declare global {
  namespace Express {
    interface Request {
      project?: { id: string; name: string; framework?: string | null };
      deployment?: { id: string; projectId: string; status: string };
    }
  }
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
  description: string | null;
  defaultBranch: string;
}

export interface GitLabProject {
  id: number;
  name: string;
  pathWithNamespace: string;
  webUrl: string;
  description: string | null;
  defaultBranch: string;
}

export interface CommitStatus {
  state: 'pending' | 'success' | 'failure' | 'error';
  description: string | null;
  targetUrl: string | null;
  target_url?: string | null;
  context?: string;
  creator?: { login: string };
  created_at?: string;
  updated_at?: string;
}
export interface JwtPayload {
  userId: string;
  email: string;
  name?: string;
}