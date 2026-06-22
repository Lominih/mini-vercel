import { test, expect } from "@playwright/test";

const API = "/api";

let authToken: string;

test.beforeAll(async ({ request }) => {
  const email = `project-test-${Date.now()}@example.com`;
  const res = await request.post(`${API}/auth/register`, {
    data: { email, name: "Project Tester", password: "SecurePass123!" },
  });
  const body = await res.json();
  authToken = body.token;
});

function authHeaders() {
  return { Authorization: `Bearer ${authToken}` };
}

test.describe("Projects API", () => {
  let projectId: string;

  test("should create a new project", async ({ request }) => {
    const res = await request.post(`${API}/projects`, {
      headers: authHeaders(),
      data: {
        name: `Test Project ${Date.now()}`,
        framework: "vite",
        buildCommand: "npm run build",
        outputDir: "dist",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.name).toBeTruthy();
    projectId = body.data.id;
  });

  test("should list projects", async ({ request }) => {
    const res = await request.get(`${API}/projects`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  test("should get project by id", async ({ request }) => {
    const res = await request.get(`${API}/projects/${projectId}`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(projectId);
  });

  test("should update project settings", async ({ request }) => {
    const res = await request.patch(`${API}/projects/${projectId}`, {
      headers: authHeaders(),
      data: {
        buildCommand: "npm run build --production",
        outputDir: "build",
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.buildCommand).toBe("npm run build --production");
  });

  test("should return 404 for non-existent project", async ({ request }) => {
    const res = await request.get(`${API}/projects/nonexistent-id`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(404);
  });

  test("should reject unauthenticated project creation", async ({ request }) => {
    const res = await request.post(`${API}/projects`, {
      data: { name: "Unauthed" },
    });
    expect(res.status()).toBe(401);
  });

  test("should delete a project", async ({ request }) => {
    const createRes = await request.post(`${API}/projects`, {
      headers: authHeaders(),
      data: { name: `Delete Me ${Date.now()}` },
    });
    const { data } = await createRes.json();

    const res = await request.delete(`${API}/projects/${data.id}`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);

    const getRes = await request.get(`${API}/projects/${data.id}`, {
      headers: authHeaders(),
    });
    expect(getRes.status()).toBe(404);
  });
});
