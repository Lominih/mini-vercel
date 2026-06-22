import { GitLabProject, CommitStatus } from "../types";

const GITLAB_CLIENT_ID = process.env.GITLAB_CLIENT_ID || "placeholder-client-id";
const GITLAB_CLIENT_SECRET = process.env.GITLAB_CLIENT_SECRET || "placeholder-client-secret";
const GITLAB_API_BASE = process.env.GITLAB_API_BASE || "https://gitlab.com/api/v4";

export function getOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GITLAB_CLIENT_ID,
    redirect_uri: process.env.GITLAB_REDIRECT_URI || "http://localhost:3000/api/auth/gitlab/callback",
    scope: "api read_repository write_repository",
    state,
    response_type: "code",
  });
  return `https://gitlab.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await fetch("https://gitlab.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: GITLAB_CLIENT_ID,
      client_secret: GITLAB_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: process.env.GITLAB_REDIRECT_URI || "http://localhost:3000/api/auth/gitlab/callback",
    }),
  });

  const data = (await response.json()) as { access_token?: string; error?: string };
  if (!data.access_token) {
    throw new Error(data.error || "Failed to exchange code for token");
  }
  return data.access_token;
}

export async function listProjects(accessToken: string): Promise<GitLabProject[]> {
  const response = await fetch(`${GITLAB_API_BASE}/projects?membership=true&per_page=100&order_by=last_activity_at`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as GitLabProject[];
}

export async function getProject(accessToken: string, projectId: number): Promise<GitLabProject> {
  const response = await fetch(`${GITLAB_API_BASE}/projects/${projectId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as GitLabProject;
}

export async function createWebhook(
  accessToken: string,
  projectId: number,
  webhookUrl: string,
  secret: string
): Promise<{ id: number }> {
  const response = await fetch(`${GITLAB_API_BASE}/projects/${projectId}/hooks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: webhookUrl,
      push_events: true,
      merge_requests_events: true,
      secret_token: secret,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Failed to create webhook: ${response.status} ${errBody}`);
  }

  const data = (await response.json()) as { id: number };
  return { id: data.id };
}

export async function removeWebhook(
  accessToken: string,
  projectId: number,
  hookId: number
): Promise<void> {
  const response = await fetch(`${GITLAB_API_BASE}/projects/${projectId}/hooks/${hookId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to remove webhook: ${response.status}`);
  }
}

export async function createCommitStatus(
  accessToken: string,
  projectId: number,
  sha: string,
  status: CommitStatus
): Promise<void> {
  const stateMap: Record<string, string> = {
    pending: "pending",
    success: "success",
    failure: "failed",
    error: "failed",
  };

  const response = await fetch(
    `${GITLAB_API_BASE}/projects/${projectId}/statuses/${sha}?state=${stateMap[status.state] || "pending"}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: status.context,
        description: status.description,
        target_url: status.target_url,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to create commit status: ${response.status}`);
  }
}

interface GitLabPushBody {
  ref?: string;
  after?: string;
  commits?: Array<{ message?: string }>;
  project?: { id?: number; name?: string; path_with_namespace?: string };
}

export function parseWebhookPayload(body: Record<string, unknown>): {
  event: string;
  ref: string;
  commitSha: string;
  commitMessage: string;
  repository: { id: number; name: string; full_name: string };
} | null {
  if (!body || !body.ref || !body.after) {
    return null;
  }

  const pushBody = body as unknown as GitLabPushBody;
  if (!pushBody.ref || !pushBody.after) {
    return null;
  }

  const commits = pushBody.commits || [];
  const lastCommit = commits[commits.length - 1];

  return {
    event: "push",
    ref: pushBody.ref,
    commitSha: pushBody.after,
    commitMessage: lastCommit?.message || "",
    repository: {
      id: pushBody.project?.id ?? 0,
      name: pushBody.project?.name ?? "",
      full_name: pushBody.project?.path_with_namespace ?? "",
    },
  };
}
