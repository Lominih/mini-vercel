import vm from "vm";
import { prisma } from "../lib/prisma";
import { decrypt } from "./env-encryption";

const TIMEOUT_MS = 10_000;
const MEMORY_LIMIT_BYTES = 128 * 1024 * 1024;

export interface EdgeRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  query: Record<string, string>;
}

export interface EdgeResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface FunctionLog {
  timestamp: Date;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  duration?: number;
}

const logStore = new Map<string, FunctionLog[]>();
const coldStartTimestamps = new Map<string, number>();

function appendLog(functionId: string, log: FunctionLog) {
  const logs = logStore.get(functionId) || [];
  logs.push(log);
  if (logs.length > 1000) {
    logs.splice(0, logs.length - 1000);
  }
  logStore.set(functionId, logs);
}

function buildSandboxContext(
  envVars: Record<string, string>,
  functionId: string
) {
  const response: EdgeResponse = {
    status: 200,
    headers: { "content-type": "text/plain" },
    body: "",
  };

  const consoleShim = {
    log: (...args: unknown[]) => {
      appendLog(functionId, {
        timestamp: new Date(),
        level: "info",
        message: args.map(String).join(" "),
      });
    },
    warn: (...args: unknown[]) => {
      appendLog(functionId, {
        timestamp: new Date(),
        level: "warn",
        message: args.map(String).join(" "),
      });
    },
    error: (...args: unknown[]) => {
      appendLog(functionId, {
        timestamp: new Date(),
        level: "error",
        message: args.map(String).join(" "),
      });
    },
    info: (...args: unknown[]) => {
      appendLog(functionId, {
        timestamp: new Date(),
        level: "info",
        message: args.map(String).join(" "),
      });
    },
    debug: (...args: unknown[]) => {
      appendLog(functionId, {
        timestamp: new Date(),
        level: "debug",
        message: args.map(String).join(" "),
      });
    },
  };

  const fetchShim = async (
    input: string | { toString(): string },
    init?: RequestInit
  ): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    appendLog(functionId, {
      timestamp: new Date(),
      level: "info",
      message: `fetch: ${init?.method || "GET"} ${url}`,
    });
    return new Response(JSON.stringify({ mock: true, url }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const localStorageShim = (() => {
    const store = new Map<string, string>();
    return {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, String(value)),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      get length() { return store.size; },
      key: (index: number) => [...store.keys()][index] ?? null,
    };
  })();

  return {
    console: consoleShim,
    fetch: fetchShim,
    localStorage: localStorageShim,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    Headers: globalThis.Headers,
    Request: globalThis.Request,
    Response: globalThis.Response,
    AbortController: globalThis.AbortController,
    atob: globalThis.atob,
    btoa: globalThis.btoa,
    crypto: globalThis.crypto,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
    process: {
      env: envVars,
    },
    Buffer,
    __response: response,
    __env: envVars,
  };
}

async function loadEnvVarsForProject(projectId: string): Promise<Record<string, string>> {
  const vars = await prisma.envVar.findMany({ where: { projectId } });
  const result: Record<string, string> = {};
  for (const v of vars) {
    try {
      // decrypt is imported at the top of the file
      result[v.key] = decrypt(v.value);
    } catch {
      result[v.key] = v.value;
    }
  }
  return result;
}

export async function invokeFunction(
  functionId: string,
  request: EdgeRequest
): Promise<{ response: EdgeResponse; coldStart: boolean; duration: number }> {
  const fn = await prisma.edgeFunction.findUniqueOrThrow({
    where: { id: functionId },
  });

  const isColdStart = !coldStartTimestamps.has(functionId);
  if (isColdStart) {
    coldStartTimestamps.set(functionId, Date.now());
  }

  const envVars = await loadEnvVarsForProject(fn.projectId);
  envVars["FUNCTION_NAME"] = fn.name;
  envVars["FUNCTION_PATH"] = fn.path;
  envVars["FUNCTION_RUNTIME"] = fn.runtime;

  const sandboxContext = buildSandboxContext(envVars, functionId);

  appendLog(functionId, {
    timestamp: new Date(),
    level: "info",
    message: `Invoking ${fn.name} (${isColdStart ? "cold start" : "warm"})`,
  });

  const wrapperCode = `
    (async function handler(__request, __response) {
      ${fn.code}
    })
  `;

  const script = new vm.Script(wrapperCode, {
    filename: `${fn.name}.js`,
  });

  const sandbox = vm.createContext(sandboxContext);

  const startTime = Date.now();
  let result: EdgeResponse;

  try {
    const handler = script.runInContext(sandbox, {
      timeout: TIMEOUT_MS,
      displayErrors: true,
    });

    const requestObj = {
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body,
      query: request.query,
    };

    const responsePromise = handler(requestObj, sandboxContext.__response);
    await Promise.race([
      responsePromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Function timed out")), TIMEOUT_MS)
      ),
    ]);

    result = sandboxContext.__response;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    appendLog(functionId, {
      timestamp: new Date(),
      level: "error",
      message: `Execution error: ${message}`,
    });

    result = {
      status: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: message }),
    };
  }

  const duration = Date.now() - startTime;

  appendLog(functionId, {
    timestamp: new Date(),
    level: "info",
    message: `Completed in ${duration}ms with status ${result.status}`,
    duration,
  });

  return { response: result, coldStart: isColdStart, duration };
}

export function getFunctionLogs(functionId: string, limit: number = 100): FunctionLog[] {
  const logs = logStore.get(functionId) || [];
  return logs.slice(-limit);
}

export function clearFunctionLogs(functionId: string): void {
  logStore.delete(functionId);
}

export function removeColdStart(functionId: string): void {
  coldStartTimestamps.delete(functionId);
}