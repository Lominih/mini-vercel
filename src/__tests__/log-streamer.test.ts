import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("uuid", () => ({
  v4: vi.fn(),
}));

import { logStreamer } from "@/services/log-streamer";
import { v4 as uuid } from "uuid";

const mockUuid = vi.mocked(uuid);

function createMockResponse() {
  const writes: string[] = [];
  const closeCallbacks: Array<() => void> = [];

  const res = {
    writeHead: vi.fn(),
    write: vi.fn((data: string) => { writes.push(data); }),
    end: vi.fn(),
    on: vi.fn((event: string, cb: () => void) => {
      if (event === "close") closeCallbacks.push(cb);
    }),
    __writes: writes,
    __closeCallbacks: closeCallbacks,
    __simulateClose() {
      for (const cb of closeCallbacks) cb();
    },
  };

  return res as unknown as import("express").Response & {
    __writes: string[];
    __closeCallbacks: Array<() => void>;
    __simulateClose: () => void;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  let counter = 0;
  mockUuid.mockImplementation(() => `uuid-${++counter}` as any);
});

afterEach(() => {
  // Clean up all clients to avoid cross-test pollution
  logStreamer.closeAll("dep-1");
  logStreamer.closeAll("dep-2");
  logStreamer.closeAll("dep-3");
  logStreamer.closeAll("dep-4");
  logStreamer.closeAll("dep-5");
  logStreamer.closeAll("dep-6");
  logStreamer.closeAll("dep-7");
  logStreamer.closeAll("dep-8");
  logStreamer.closeAll("dep-9");
  logStreamer.closeAll("dep-x");
  logStreamer.closeAll("dep-y");
  logStreamer.closeAll("dep-a");
  logStreamer.closeAll("dep-b");
  logStreamer.clearBuffer("dep-1");
  logStreamer.clearBuffer("dep-2");
  logStreamer.clearBuffer("dep-3");
  logStreamer.clearBuffer("dep-4");
  logStreamer.clearBuffer("dep-5");
  logStreamer.clearBuffer("dep-6");
  logStreamer.clearBuffer("dep-7");
  logStreamer.clearBuffer("dep-8");
  logStreamer.clearBuffer("dep-9");
  logStreamer.clearBuffer("dep-x");
  logStreamer.clearBuffer("dep-y");
  logStreamer.clearBuffer("dep-a");
  logStreamer.clearBuffer("dep-b");
});

describe("logStreamer.connect", () => {
  it("returns a client id (uuid)", () => {
    const res = createMockResponse();
    const id = logStreamer.connect("dep-1", res);
    expect(id).toBe("uuid-1");
  });

  it("sets SSE headers via writeHead", () => {
    const res = createMockResponse();
    logStreamer.connect("dep-1", res);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    }));
  });

  it("sends a connected event on connect", () => {
    const res = createMockResponse();
    logStreamer.connect("dep-1", res);
    expect(res.write).toHaveBeenCalled();
    const firstCall = (res.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(firstCall).toContain("connected");
  });

  it("registers a close handler", () => {
    const res = createMockResponse();
    logStreamer.connect("dep-1", res);
    expect(res.on).toHaveBeenCalledWith("close", expect.any(Function));
  });

  it("flushes buffered logs on late connect", () => {
    logStreamer.appendLog("dep-2", "log line 1");
    logStreamer.appendLog("dep-2", "log line 2");

    const res = createMockResponse();
    logStreamer.connect("dep-2", res);

    const allWrites = (res.write as ReturnType<typeof vi.fn>).mock.calls
      .map((c: any[]) => c[0] as string)
      .join("");
    expect(allWrites).toContain("buffer_start");
    expect(allWrites).toContain("log line 1");
    expect(allWrites).toContain("log line 2");
    expect(allWrites).toContain("buffer_end");
  });
});

describe("logStreamer.appendLog", () => {
  it("writes log event to connected clients", () => {
    const res = createMockResponse();
    logStreamer.connect("dep-3", res);
    logStreamer.appendLog("dep-3", "hello world");

    const writes = (res.write as ReturnType<typeof vi.fn>).mock.calls.map((c: any[]) => c[0] as string);
    const logWrite = writes.find((w: string) => w.includes("hello world"));
    expect(logWrite).toBeDefined();
    expect(logWrite).toContain("log");
  });

  it("does not write to clients of other deployments", () => {
    const res = createMockResponse();
    logStreamer.connect("dep-a", res);
    logStreamer.appendLog("dep-b", "other deploy");

    const writes = (res.write as ReturnType<typeof vi.fn>).mock.calls.map((c: any[]) => c[0] as string);
    const logWrite = writes.find((w: string) => w.includes("other deploy"));
    expect(logWrite).toBeUndefined();
  });

  it("buffers logs for clients not yet connected", () => {
    logStreamer.appendLog("dep-4", "buffered line");
    const res = createMockResponse();
    logStreamer.connect("dep-4", res);

    const writes = (res.write as ReturnType<typeof vi.fn>).mock.calls.map((c: any[]) => c[0] as string);
    expect(writes.some((w: string) => w.includes("buffered line"))).toBe(true);
  });
});

describe("logStreamer.sendStatus", () => {
  it("sends status event to connected clients", () => {
    const res = createMockResponse();
    logStreamer.connect("dep-5", res);
    logStreamer.sendStatus("dep-5", "building", { step: "install" });

    const writes = (res.write as ReturnType<typeof vi.fn>).mock.calls.map((c: any[]) => c[0] as string);
    const statusWrite = writes.find((w: string) => w.includes("building"));
    expect(statusWrite).toBeDefined();
    expect(statusWrite).toContain("install");
  });
});

describe("logStreamer.complete", () => {
  it("sends complete event and ends connection", () => {
    const res = createMockResponse();
    logStreamer.connect("dep-6", res);
    logStreamer.complete("dep-6", "ready");

    const writes = (res.write as ReturnType<typeof vi.fn>).mock.calls.map((c: any[]) => c[0] as string);
    expect(writes.some((w: string) => w.includes("complete"))).toBe(true);
    expect(res.end).toHaveBeenCalled();
  });
});

describe("logStreamer.disconnect", () => {
  it("removes client and ends response", () => {
    const res = createMockResponse();
    const id = logStreamer.connect("dep-7", res);
    logStreamer.disconnect(id);
    expect(res.end).toHaveBeenCalled();
    expect(logStreamer.getClientCount("dep-7")).toBe(0);
  });

  it("handles disconnect of unknown client id gracefully", () => {
    expect(() => logStreamer.disconnect("nonexistent")).not.toThrow();
  });
});

describe("logStreamer.closeAll", () => {
  it("disconnects all clients for a deployment", () => {
    const res1 = createMockResponse();
    const res2 = createMockResponse();
    logStreamer.connect("dep-8", res1);
    logStreamer.connect("dep-8", res2);
    expect(logStreamer.getClientCount("dep-8")).toBe(2);

    logStreamer.closeAll("dep-8");
    expect(logStreamer.getClientCount("dep-8")).toBe(0);
  });

  it("does not affect clients of other deployments", () => {
    const res1 = createMockResponse();
    const res2 = createMockResponse();
    logStreamer.connect("dep-x", res1);
    logStreamer.connect("dep-y", res2);

    logStreamer.closeAll("dep-x");
    expect(logStreamer.getClientCount("dep-x")).toBe(0);
    expect(logStreamer.getClientCount("dep-y")).toBe(1);
  });
});

describe("logStreamer.clearBuffer", () => {
  it("clears the buffer for a deployment", () => {
    logStreamer.appendLog("dep-9", "line1");
    logStreamer.clearBuffer("dep-9");

    const res = createMockResponse();
    logStreamer.connect("dep-9", res);
    const writes = (res.write as ReturnType<typeof vi.fn>).mock.calls.map((c: any[]) => c[0] as string);
    expect(writes.some((w: string) => w.includes("buffer_start"))).toBe(false);
  });
});

describe("logStreamer.getClientCount / getTotalClients", () => {
  it("returns correct counts", () => {
    const res1 = createMockResponse();
    const res2 = createMockResponse();
    logStreamer.connect("dep-x", res1);
    logStreamer.connect("dep-y", res2);

    expect(logStreamer.getClientCount("dep-x")).toBe(1);
    expect(logStreamer.getClientCount("dep-y")).toBe(1);
    expect(logStreamer.getTotalClients()).toBe(2);
  });

  it("returns 0 for deployment with no clients", () => {
    expect(logStreamer.getClientCount("no-such-dep")).toBe(0);
  });

  it("total is 0 when no clients exist", () => {
    expect(logStreamer.getTotalClients()).toBe(0);
  });
});
