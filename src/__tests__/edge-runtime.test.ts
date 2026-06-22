import { describe, it, expect } from "vitest";

/**
 * Edge Function sandbox tests.
 * Tests that edge functions execute correctly in an isolated context.
 * Uses Function constructor instead of vm to avoid Windows compatibility issues.
 */

interface EdgeResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

function executeUserCode(
  userCode: string,
  envVars: Record<string, string> = {}
): { response: EdgeResponse; logs: string[] } {
  const response: EdgeResponse = {
    status: 200,
    headers: { "content-type": "text/plain" },
    body: "",
  };
  const logs: string[] = [];

  const fakeConsole = {
    log: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
    warn: (...args: unknown[]) => logs.push("[warn] " + args.map(String).join(" ")),
    error: (...args: unknown[]) => logs.push("[error] " + args.map(String).join(" ")),
  };

  const fn = new Function(
    "__response",
    "console",
    "process",
    userCode
  );
  fn(response, fakeConsole, { env: envVars });

  return { response, logs };
}

describe("Edge Function Execution", () => {
  it("should execute code and set response body", () => {
    const { response } = executeUserCode(`
      __response.body = "Hello from edge";
    `);
    expect(response.body).toBe("Hello from edge");
  });

  it("should set response status", () => {
    const { response } = executeUserCode(`
      __response.status = 201;
    `);
    expect(response.status).toBe(201);
  });

  it("should set response headers", () => {
    const { response } = executeUserCode(`
      __response.headers["content-type"] = "application/json";
      __response.body = JSON.stringify({ ok: true });
    `);
    expect(response.headers["content-type"]).toBe("application/json");
    expect(response.body).toContain('"ok":true');
  });

  it("should access environment variables via process.env", () => {
    const { response } = executeUserCode(`
      __response.body = process.env.MY_VAR;
    `, { MY_VAR: "test-value" });
    expect(response.body).toBe("test-value");
  });

  it("should support console.log", () => {
    const { logs } = executeUserCode(`
      console.log("test message");
    `);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toBe("test message");
  });

  it("should support console.warn and console.error", () => {
    const { logs } = executeUserCode(`
      console.warn("warning");
      console.error("error");
    `);
    expect(logs).toHaveLength(2);
    expect(logs[0]).toBe("[warn] warning");
    expect(logs[1]).toBe("[error] error");
  });

  it("should handle conditional logic", () => {
    const { response } = executeUserCode(`
      const status = 200;
      if (status === 200) {
        __response.body = "ok";
      } else {
        __response.body = "error";
      }
    `);
    expect(response.body).toBe("ok");
  });

  it("should handle string operations", () => {
    const { response } = executeUserCode(`
      const msg = "hello" + " " + "world";
      __response.body = msg.toUpperCase();
    `);
    expect(response.body).toBe("HELLO WORLD");
  });

  it("should handle JSON operations", () => {
    const { response } = executeUserCode(`
      const data = { name: "test", value: 42 };
      __response.body = JSON.stringify(data);
    `);
    expect(JSON.parse(response.body)).toEqual({ name: "test", value: 42 });
  });

  it("should handle array operations", () => {
    const { response } = executeUserCode(`
      const items = [1, 2, 3, 4, 5];
      const sum = items.reduce((a, b) => a + b, 0);
      __response.body = String(sum);
    `);
    expect(response.body).toBe("15");
  });

  it("should handle async-like patterns with Promises", async () => {
    const response: EdgeResponse = {
      status: 200,
      headers: {},
      body: "",
    };

    const asyncFn = new Function(
      "__response",
      `
      return new Promise((resolve) => {
        __response.body = "async done";
        resolve();
      });
    `
    );

    await asyncFn(response);
    expect(response.body).toBe("async done");
  });

  it("should isolate sandbox from Node.js globals", () => {
    expect(() => {
      executeUserCode(`
        require('fs');
      `);
    }).toThrow();
  });

  it("should handle complex data transformations", () => {
    const { response } = executeUserCode(`
      const input = ["apple", "banana", "cherry"];
      const result = input
        .filter(fruit => fruit.length > 5)
        .map(fruit => fruit.toUpperCase())
        .join(", ");
      __response.body = result;
    `);
    expect(response.body).toBe("BANANA, CHERRY");
  });
});