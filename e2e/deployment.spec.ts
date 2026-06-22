import { test, expect } from "@playwright/test";

const API = "/api";

let authToken: string;
let projectId: string;

test.beforeAll(async ({ request }) => {
  const email = `deploy-test-${Date.now()}@example.com`;
  const regRes = await request.post(`${API}/auth/register`, {
    data: { email, name: "Deploy Tester", password: "SecurePass123!" },
  });
  const regBody = await regRes.json();
  authToken = regBody.token;

  const projRes = await request.post(`${API}/projects`, {
    headers: { Authorization: `Bearer ${authToken}` },
    data: {
      name: `Deploy Project ${Date.now()}`,
      framework: "vite",
    },
  });
  const projBody = await projRes.json();
  projectId = projBody.data.id;
});

function authHeaders() {
  return { Authorization: `Bearer ${authToken}` };
}

test.describe("Deployments API", () => {
  let deploymentId: string;

  test("should create a new deployment", async ({ request }) => {
    const res = await request.post(`${API}/deployments`, {
      headers: authHeaders(),
      data: {
        projectId,
        branch: "main",
        commitSha: "abc123",
        commitMsg: "Initial deployment",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.status).toBe("queued");
    expect(body.data.branch).toBe("main");
    deploymentId = body.data.id;
  });

  test("should list deployments for a project", async ({ request }) => {
    const res = await request.get(`${API}/projects/${projectId}/deployments`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("should get deployment by id", async ({ request }) => {
    const res = await request.get(`${API}/deployments/${deploymentId}`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(deploymentId);
  });

  test("should return deployment with url field", async ({ request }) => {
    const res = await request.get(`${API}/deployments/${deploymentId}`, {
      headers: authHeaders(),
    });
    const body = await res.json();
    expect(body.data.url).toBeDefined();
    expect(typeof body.data.url).toBe("string");
  });

  test("should reject deployment for non-existent project", async ({ request }) => {
    const res = await request.post(`${API}/deployments`, {
      headers: authHeaders(),
      data: { projectId: "nonexistent" },
    });
    expect(res.status()).toBe(404);
  });

  test("should reject unauthenticated deployment", async ({ request }) => {
    const res = await request.post(`${API}/deployments`, {
      data: { projectId },
    });
    expect(res.status()).toBe(401);
  });

  test("should reject deployment with missing projectId", async ({ request }) => {
    const res = await request.post(`${API}/deployments`, {
      headers: authHeaders(),
      data: { branch: "main" },
    });
    expect(res.status()).toBe(400);
  });

  test("should delete a deployment", async ({ request }) => {
    const createRes = await request.post(`${API}/deployments`, {
      headers: authHeaders(),
      data: { projectId, branch: "temp" },
    });
    const { data } = await createRes.json();

    const res = await request.delete(`${API}/deployments/${data.id}`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);

    const getRes = await request.get(`${API}/deployments/${data.id}`, {
      headers: authHeaders(),
    });
    expect(getRes.status()).toBe(404);
  });
});
