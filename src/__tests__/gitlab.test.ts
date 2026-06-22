import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  getOAuthUrl,
  exchangeCodeForToken,
  listProjects,
  getProject,
  createWebhook,
  removeWebhook,
  createCommitStatus,
  parseWebhookPayload,
} from "@/services/gitlab";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GitLab getOAuthUrl", () => {
  it("returns a URL containing the GitLab authorize endpoint", () => {
    const url = getOAuthUrl("state-123");
    expect(url).toContain("https://gitlab.com/oauth/authorize");
  });

  it("includes the state parameter", () => {
    const url = getOAuthUrl("my-state");
    expect(url).toContain("state=my-state");
  });

  it("includes response_type=code", () => {
    const url = getOAuthUrl("s");
    expect(url).toContain("response_type=code");
  });

  it("includes scope parameter", () => {
    const url = getOAuthUrl("s");
    expect(url).toContain("scope=api");
  });
});

describe("GitLab exchangeCodeForToken", () => {
  it("returns access_token on success", async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({ access_token: "gl_token_xyz" }),
    });
    const token = await exchangeCodeForToken("auth-code");
    expect(token).toBe("gl_token_xyz");
  });

  it("throws when no access_token in response", async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({ error: "invalid_grant" }),
    });
    await expect(exchangeCodeForToken("bad")).rejects.toThrow("invalid_grant");
  });

  it("throws generic error when response has no error field", async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({}),
    });
    await expect(exchangeCodeForToken("x")).rejects.toThrow("Failed to exchange code for token");
  });
});

describe("GitLab listProjects", () => {
  it("returns projects on success", async () => {
    const projects = [{ id: 1, name: "proj1" }];
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => projects,
    });
    const result = await listProjects("token");
    expect(result).toEqual(projects);
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });
    await expect(listProjects("bad")).rejects.toThrow("GitLab API error: 401");
  });
});

describe("GitLab getProject", () => {
  it("returns a single project", async () => {
    const project = { id: 42, name: "my-proj" };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => project,
    });
    const result = await getProject("token", 42);
    expect(result).toEqual(project);
  });

  it("throws on failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });
    await expect(getProject("token", 999)).rejects.toThrow("404");
  });
});

describe("GitLab createWebhook", () => {
  it("returns webhook id on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 777 }),
    });
    const result = await createWebhook("token", 42, "https://hook.url", "secret");
    expect(result).toEqual({ id: 777 });
  });

  it("throws on failure with response body", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => "Unprocessable Entity",
    });
    await expect(createWebhook("t", 1, "url", "s")).rejects.toThrow("422");
  });
});

describe("GitLab removeWebhook", () => {
  it("resolves on success", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await expect(removeWebhook("token", 42, 777)).resolves.toBeUndefined();
  });

  it("throws on failure", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(removeWebhook("t", 1, 1)).rejects.toThrow("500");
  });
});

describe("GitLab createCommitStatus", () => {
  it("resolves on success with pending state", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await expect(
      createCommitStatus("token", 42, "sha-abc", {
        state: "pending",
        description: "Building...",
        target_url: null,
      })
    ).resolves.toBeUndefined();
  });

  it("resolves on success with failure state", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await expect(
      createCommitStatus("token", 42, "sha-abc", {
        state: "failure",
        description: "Build failed",
        target_url: "https://ci.example.com",
      })
    ).resolves.toBeUndefined();
  });

  it("throws on API failure", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403 });
    await expect(
      createCommitStatus("t", 1, "sha", {
        state: "success",
        description: null,
        target_url: null,
      })
    ).rejects.toThrow("403");
  });
});

describe("GitLab parseWebhookPayload", () => {
  it("returns null for empty body", () => {
    expect(parseWebhookPayload({})).toBeNull();
  });

  it("returns null when ref is missing", () => {
    expect(parseWebhookPayload({ after: "abc" })).toBeNull();
  });

  it("returns null when after is missing", () => {
    expect(parseWebhookPayload({ ref: "refs/heads/main" })).toBeNull();
  });

  it("parses a valid push payload", () => {
    const body = {
      ref: "refs/heads/main",
      after: "commit-sha-123",
      commits: [{ message: "fix: bug" }],
      project: { id: 10, name: "my-proj", path_with_namespace: "group/my-proj" },
    };
    const result = parseWebhookPayload(body);
    expect(result).not.toBeNull();
    expect(result!.event).toBe("push");
    expect(result!.ref).toBe("refs/heads/main");
    expect(result!.commitSha).toBe("commit-sha-123");
    expect(result!.commitMessage).toBe("fix: bug");
    expect(result!.repository.name).toBe("my-proj");
    expect(result!.repository.full_name).toBe("group/my-proj");
  });

  it("handles empty commits array", () => {
    const body = {
      ref: "refs/heads/dev",
      after: "sha-xyz",
      commits: [],
      project: { id: 5, name: "p", path_with_namespace: "g/p" },
    };
    const result = parseWebhookPayload(body);
    expect(result).not.toBeNull();
    expect(result!.commitMessage).toBe("");
  });

  it("uses last commit message when multiple commits", () => {
    const body = {
      ref: "refs/heads/main",
      after: "sha-end",
      commits: [{ message: "first" }, { message: "second" }],
      project: { id: 1, name: "r", path_with_namespace: "o/r" },
    };
    const result = parseWebhookPayload(body);
    expect(result!.commitMessage).toBe("second");
  });

  it("handles missing project fields gracefully", () => {
    const body = {
      ref: "refs/heads/main",
      after: "sha",
      commits: [],
      project: {},
    };
    const result = parseWebhookPayload(body);
    expect(result).not.toBeNull();
    expect(result!.repository.id).toBe(0);
    expect(result!.repository.name).toBe("");
  });
});
