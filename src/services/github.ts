import { GitHubRepo, CommitStatus } from "../types";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "placeholder-client-id";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "placeholder-client-secret";
const GITHUB_API_BASE = "https://api.github.com";

export function getOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: process.env.GITHUB_REDIRECT_URI || "http://localhost:3000/api/auth/github/callback",
    scope: "repo read:user user:email",
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const data = (await response.json()) as { access_token?: string; error?: string };
  if (!data.access_token) {
    throw new Error(data.error || "Failed to exchange code for token");
  }
  return data.access_token;
}

export async function listRepositories(accessToken: string): Promise<GitHubRepo[]> {
  const response = await fetch(`${GITHUB_API_BASE}/user/repos?per_page=100&sort=updated`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const repos = (await response.json()) as GitHubRepo[];
  return repos;
}

export async function getRepository(accessToken: string, owner: string, repo: string): Promise<GitHubRepo> {
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as GitHubRepo;
}

export async function createWebhook(
  accessToken: string,
  owner: string,
  repo: string,
  webhookUrl: string,
  secret: string
): Promise<{ id: number }> {
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/hooks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "web",
      active: true,
      events: ["push", "pull_request"],
      config: {
        url: webhookUrl,
        content_type: "json",
        secret,
      },
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
  owner: string,
  repo: string,
  hookId: number
): Promise<void> {
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/hooks/${hookId}`, {
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
  owner: string,
  repo: string,
  sha: string,
  status: CommitStatus
): Promise<void> {
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/statuses/${sha}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      state: status.state,
      description: status.description,
      context: status.context,
      target_url: status.target_url,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create commit status: ${response.status}`);
  }
}

interface GitHubPushBody {
  ref?: string;
  head_commit?: { id?: string; message?: string };
  repository?: { id?: number; name?: string; full_name?: string };
}

export function parseWebhookPayload(body: Record<string, unknown>): {
  event: string;
  ref: string;
  commitSha: string;
  commitMessage: string;
  repository: { id: number; name: string; full_name: string };
} | null {
  if (!body || !body.ref || !body.head_commit) {
    return null;
  }

  const pushBody = body as unknown as GitHubPushBody;
  if (!pushBody.ref || !pushBody.head_commit || !pushBody.repository) {
    return null;
  }

  return {
    event: "push",
    ref: pushBody.ref,
    commitSha: pushBody.head_commit.id ?? "",
    commitMessage: pushBody.head_commit.message ?? "",
    repository: {
      id: pushBody.repository.id ?? 0,
      name: pushBody.repository.name ?? "",
      full_name: pushBody.repository.full_name ?? "",
    },
  };
}
