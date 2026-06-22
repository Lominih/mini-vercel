import { test, expect } from "@playwright/test";

const API = "/api/auth";

test.describe("Auth API", () => {
  const uniqueEmail = `test-${Date.now()}@example.com`;

  test.describe("POST /register", () => {
    test("should register a new user successfully", async ({ request }) => {
      const res = await request.post(`${API}/register`, {
        data: {
          email: uniqueEmail,
          name: "Test User",
          password: "SecurePass123!",
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe(uniqueEmail);
      expect(body.user.name).toBe("Test User");
      expect(body.token).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.user.password).toBeUndefined();
    });

    test("should reject duplicate email", async ({ request }) => {
      const res = await request.post(`${API}/register`, {
        data: {
          email: uniqueEmail,
          name: "Duplicate",
          password: "SecurePass123!",
        },
      });
      expect(res.status()).toBe(409);
      const body = await res.json();
      expect(body.error).toContain("already exists");
    });

    test("should reject missing fields", async ({ request }) => {
      const res = await request.post(`${API}/register`, {
        data: { email: "a@b.com" },
      });
      expect(res.status()).toBe(400);
    });

    test("should reject short password", async ({ request }) => {
      const res = await request.post(`${API}/register`, {
        data: {
          email: `short-${Date.now()}@example.com`,
          name: "Short",
          password: "123",
        },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("8 characters");
    });

    test("should reject invalid email format", async ({ request }) => {
      const res = await request.post(`${API}/register`, {
        data: {
          email: "not-an-email",
          name: "NoEmail",
          password: "SecurePass123!",
        },
      });
      expect(res.status()).toBe(400);
    });
  });

  test.describe("POST /login", () => {
    test("should login with valid credentials", async ({ request }) => {
      const res = await request.post(`${API}/login`, {
        data: {
          email: uniqueEmail,
          password: "SecurePass123!",
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.user.email).toBe(uniqueEmail);
      expect(body.token).toBeDefined();
      expect(body.refreshToken).toBeDefined();
    });

    test("should reject wrong password", async ({ request }) => {
      const res = await request.post(`${API}/login`, {
        data: {
          email: uniqueEmail,
          password: "WrongPassword!",
        },
      });
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.error).toContain("Invalid credentials");
    });

    test("should reject non-existent user", async ({ request }) => {
      const res = await request.post(`${API}/login`, {
        data: {
          email: "nonexistent@example.com",
          password: "whatever",
        },
      });
      expect(res.status()).toBe(401);
    });
  });

  test.describe("POST /refresh", () => {
    let refreshToken: string;

    test.beforeAll(async ({ request }) => {
      const res = await request.post(`${API}/login`, {
        data: { email: uniqueEmail, password: "SecurePass123!" },
      });
      const body = await res.json();
      refreshToken = body.refreshToken;
    });

    test("should issue new tokens with valid refresh token", async ({ request }) => {
      const res = await request.post(`${API}/refresh`, {
        data: { refreshToken },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.token).toBeDefined();
      expect(body.refreshToken).toBeDefined();
    });

    test("should reject invalid refresh token", async ({ request }) => {
      const res = await request.post(`${API}/refresh`, {
        data: { refreshToken: "invalid.token.value" },
      });
      expect(res.status()).toBe(401);
    });

    test("should reject missing refresh token", async ({ request }) => {
      const res = await request.post(`${API}/refresh`, {
        data: {},
      });
      expect(res.status()).toBe(400);
    });
  });

  test.describe("GET /me", () => {
    let token: string;

    test.beforeAll(async ({ request }) => {
      const res = await request.post(`${API}/login`, {
        data: { email: uniqueEmail, password: "SecurePass123!" },
      });
      const body = await res.json();
      token = body.token;
    });

    test("should return user profile with valid token", async ({ request }) => {
      const res = await request.get(`${API}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.user.email).toBe(uniqueEmail);
      expect(body.user.password).toBeUndefined();
    });

    test("should reject request without token", async ({ request }) => {
      const res = await request.get(`${API}/me`);
      expect(res.status()).toBe(401);
    });

    test("should reject request with invalid token", async ({ request }) => {
      const res = await request.get(`${API}/me`, {
        headers: { Authorization: "Bearer garbage" },
      });
      expect(res.status()).toBe(401);
    });
  });
});
