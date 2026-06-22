import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  getOAuthUrl,
  exchangeCodeForToken,
  listRepositories,
  getRepository,
  createWebhook,
  removeWebhook,
  createCommitStatus,
  parseWebhookPayload,
} from "@/services/github";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GitHub getOAuthUrl", () => {
  it("returns a URL containing the GitHub authorize endpoint", () => {
    const url = getOAuthUrl("state-123");
    expect(url).toContain("https://github.com/login/oauth/authorize");
  });

  it("includes the state parameter in the URL", () => {
    const url = getOAuthUrl("my-state");
    expect(url).toContain("state=my-state");
  });

  it("includes the scope parameter", () => {
    const url = getOAuthUrl("s");
    expect(url).toContain("scope=repo");
  });

  it("includes client_id in the URL", () => {
    const url = getOAuthUrl("s");
    expect(url).toContain("client_id=");
  });
});

describe("GitHub exchangeCodeForToken", () => {
  it("returns access_token on success", async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({ access_token: "gh_tok_abc" }),
    });
    const token = await exchangeCodeForToken("code-123");
    expect(token).toBe("gh_tok_abc");
  });

  it("throws when no access_token in response", async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({ error: "bad_code" }),
    });
    await expect(exchangeCodeForToken("bad")).rejects.toThrow("bad_code");
  });

  it("throws generic error when no error field either", async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({}),
    });
    await expect(exchangeCodeForToken("x")).rejects.toThrow("Failed to exchange code for token");
  });
});

describe("GitHub listRepositories", () => {
  it("returns repos on success", async () => {
    const repos = [{ id: 1, name: "repo1" }];
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => repos,
    });
    const result = await listRepositories("token");
    expect(result).toEqual(repos);
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });
    await expect(listRepositories("bad")).rejects.toThrow("GitHub API error: 401");
  });
});

describe("GitHub getRepository", () => {
  it("returns a single repo", async () => {
    const repo = { id: 42, name: "my-repo" };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => repo,
    });
    const result = await getRepository("token", "owner", "my-repo");
    expect(result).toEqual(repo);
  });

  it("throws on failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });
    await expect(getRepository("token", "o", "r")).rejects.toThrow("404");
  });
});

describe("GitHub createWebhook", () => {
  it("returns webhook id on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 999 }),
    });
    const result = await createWebhook("token", "owner", "repo", "https://hook.url", "secret");
    expect(result).toEqual({ id: 999 });
  });

  it("throws on failure with response body", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => "Validation Failed",
    });
    await expect(createWebhook("t", "o", "r", "url", "s")).rejects.toThrow("422");
  });
});

describe("GitHub removeWebhook", () => {
  it("resolves on success", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await expect(removeWebhook("token", "o", "r", 123)).resolves.toBeUndefined();
  });

  it("throws on failure", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(removeWebhook("t", "o", "r", 1)).rejects.toThrow("500");
  });
});

describe("GitHub createCommitStatus", () => {
  it("resolves on success", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await expect(
      createCommitStatus("token", "owner", "repo", "sha-1", {
        state: "success",
        description: "Build passed",
        target_url: "https://ci.example.com",
      })
    ).resolves.toBeUndefined();
  });

  it("throws on failure", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403 });
    await expect(
      createCommitStatus("t", "o", "r", "sha-2", {
        state: "failure",
        description: null,
        target_url: null,
      })
    ).rejects.toThrow("403");
  });
});

describe("GitHub parseWebhookPayload", () => {
  it("returns null for empty body", () => {
    expect(parseWebhookPayload({})).toBeNull();
  });

  it("returns null when ref is missing", () => {
    expect(parseWebhookPayload({ head_commit: { id: "abc" }, repository: {} })).toBeNull();
  });

  it("returns null when head_commit is missing", () => {
    expect(parseWebhookPayload({ ref: "refs/heads/main" })).toBeNull();
  });

  it("parses a valid push payload", () => {
    const body = {
      ref: "refs/heads/main",
      head_commit: { id: "sha-abc", message: "feat: add thing" },
      repository: { id: 1, name: "repo", full_name: "owner/repo" },
    };
    const result = parseWebhookPayload(body);
    expect(result).not.toBeNull();
    expect(result!.event).toBe("push");
    expect(result!.ref).toBe("refs/heads/main");
    expect(result!.commitSha).toBe("sha-abc");
    expect(result!.commitMessage).toBe("feat: add thing");
    expect(result!.repository.name).toBe("repo");
  });

  it("handles missing optional fields gracefully", () => {
    const body = {
      ref: "refs/heads/dev",
      head_commit: {},
      repository: {},
    };
    const result = parseWebhookPayload(body);
    expect(result).not.toBeNull();
    expect(result!.commitSha).toBe("");
    expect(result!.commitMessage).toBe("");
  });
});
