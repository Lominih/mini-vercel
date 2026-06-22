const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

interface ApiError {
  message: string;
  status: number;
}

function getToken(): string | null {
  return localStorage.getItem('token');
}

function setToken(token: string): void {
  localStorage.setItem('token', token);
}

function removeToken(): void {
  localStorage.removeItem('token');
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;
  const token = getToken();

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  if (!response.ok) {
    const error: ApiError = {
      message: `Request failed: ${response.statusText}`,
      status: response.status,
    };

    try {
      const data = await response.json();
      error.message = data.message || data.error || error.message;
    } catch {
      // Use default error message
    }

    if (response.status === 401) {
      removeToken();
      window.location.href = '/login';
    }

    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),

  register: (name: string, email: string, password: string) =>
    request<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: { name, email, password },
    }),

  me: () => request<User>('/auth/me'),
};

// Projects
export const projectsApi = {
  list: () => request<Project[]>('/projects'),

  get: (id: string) => request<Project>(`/projects/${id}`),

  create: (data: { name: string; framework?: string }) =>
    request<Project>('/projects', { method: 'POST', body: data }),

  update: (id: string, data: Partial<Project>) =>
    request<Project>(`/projects/${id}`, { method: 'PATCH', body: data }),

  delete: (id: string) =>
    request<void>(`/projects/${id}`, { method: 'DELETE' }),
};

// Deployments
export const deploymentsApi = {
  list: (projectId: string) =>
    request<Deployment[]>(`/projects/${projectId}/deployments`),

  get: (projectId: string, deploymentId: string) =>
    request<Deployment>(`/projects/${projectId}/deployments/${deploymentId}`),

  create: (projectId: string) =>
    request<Deployment>(`/projects/${projectId}/deployments`, { method: 'POST' }),

  getLogs: (projectId: string, deploymentId: string) =>
    request<LogEntry[]>(`/projects/${projectId}/deployments/${deploymentId}/logs`),

  cancel: (projectId: string, deploymentId: string) =>
    request<void>(`/projects/${projectId}/deployments/${deploymentId}/cancel`, { method: 'POST' }),
};

// Domains
export const domainsApi = {
  list: (projectId: string) =>
    request<Domain[]>(`/projects/${projectId}/domains`),

  add: (projectId: string, name: string) =>
    request<Domain>(`/projects/${projectId}/domains`, { method: 'POST', body: { name } }),

  verify: (projectId: string, domainId: string) =>
    request<Domain>(`/projects/${projectId}/domains/${domainId}/verify`, { method: 'POST' }),

  remove: (projectId: string, domainId: string) =>
    request<void>(`/projects/${projectId}/domains/${domainId}`, { method: 'DELETE' }),
};

// Environment Variables
export const envApi = {
  list: (projectId: string) =>
    request<EnvVariable[]>(`/projects/${projectId}/env`),

  set: (projectId: string, key: string, value: string, target?: string[]) =>
    request<EnvVariable>(`/projects/${projectId}/env`, {
      method: 'POST',
      body: { key, value, target },
    }),

  delete: (projectId: string, key: string) =>
    request<void>(`/projects/${projectId}/env/${encodeURIComponent(key)}`, { method: 'DELETE' }),
};

// Functions
export const functionsApi = {
  list: (projectId: string) =>
    request<Function[]>(`/projects/${projectId}/functions`),

  get: (projectId: string, functionId: string) =>
    request<Function>(`/projects/${projectId}/functions/${functionId}`),

  update: (projectId: string, functionId: string, data: { code: string }) =>
    request<Function>(`/projects/${projectId}/functions/${functionId}`, {
      method: 'PATCH',
      body: data,
    }),
};

// Analytics
export const analyticsApi = {
  traffic: (projectId: string, params?: { from?: string; to?: string }) => {
    const query = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return request<TrafficStats>(`/analytics/traffic/${projectId}${query}`);
  },

  performance: (projectId: string, params?: { from?: string; to?: string }) => {
    const query = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return request<PerformanceMetrics>(`/analytics/performance/${projectId}${query}`);
  },

  errors: (projectId: string, params?: { from?: string; to?: string }) => {
    const query = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return request<ErrorStats>(`/analytics/errors/${projectId}${query}`);
  },
};

// Types
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  framework: string;
  createdAt: string;
  updatedAt: string;
  latestDeployment?: Deployment;
  deployments?: Deployment[];
  domains?: Domain[];
}

export interface Deployment {
  id: string;
  projectId: string;
  url: string;
  status: 'queued' | 'building' | 'ready' | 'failed';
  createdAt: string;
  readyAt?: string;
  buildTime?: number;
  commitMessage?: string;
  commitSha?: string;
  branch?: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface Domain {
  id: string;
  name: string;
  projectId: string;
  verified: boolean;
  sslStatus: 'active' | 'pending' | 'failed';
  createdAt: string;
  verifiedAt?: string;
}

export interface EnvVariable {
  id: string;
  key: string;
  value: string;
  target: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Function {
  id: string;
  name: string;
  projectId: string;
  runtime: string;
  route: string;
  code: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrafficStats {
  totalPV: number;
  totalUV: number;
  daily: Array<{ date: string; pv: number; uv: number }>;
}

export interface PerformanceMetrics {
  avgTTFB: number;
  avgFCP: number;
  avgLCP: number;
  p95TTFB: number;
  p95FCP: number;
  p95LCP: number;
  daily: Array<{ date: string; ttfb: number; fcp: number; lcp: number }>;
}

export interface ErrorStats {
  totalErrors: number;
  errorRate: number;
  daily: Array<{ date: string; errors: number; requests: number; rate: number }>;
  byStatus: Array<{ status: number; count: number }>;
}

export { getToken, setToken, removeToken };
