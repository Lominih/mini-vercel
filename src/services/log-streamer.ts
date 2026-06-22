import { Response } from "express";
import { v4 as uuid } from "uuid";

// ─── Log Buffer ───────────────────────────────────────────────────────────────

interface LogEntry {
  message: string;
  timestamp: number;
}

interface LogBuffer {
  entries: LogEntry[];
  maxSize: number;
}

const logBuffers = new Map<string, LogBuffer>();
const MAX_BUFFER_SIZE = 500; // Keep last 500 log lines per deployment

// ─── SSE Client Management ────────────────────────────────────────────────────

interface SSEClient {
  id: string;
  res: Response;
  deploymentId: string;
  connectedAt: Date;
  heartbeatInterval: NodeJS.Timeout | null;
}

const clients = new Map<string, SSEClient>();

// ─── Log Streamer Service ─────────────────────────────────────────────────────

export const logStreamer = {
  /**
   * Connect an SSE client for a deployment's build logs.
   */
  connect(deploymentId: string, res: Response): string {
    const clientId = uuid();

    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    });

    // Send connection event
    res.write(`data: ${JSON.stringify({ type: "connected", clientId })}\n\n`);

    // Flush any buffered logs for late connecters
    const buffer = logBuffers.get(deploymentId);
    if (buffer && buffer.entries.length > 0) {
      res.write(`data: ${JSON.stringify({ type: "buffer_start", count: buffer.entries.length })}\n\n`);
      for (const entry of buffer.entries) {
        res.write(
          `data: ${JSON.stringify({ type: "log", message: entry.message, timestamp: entry.timestamp })}\n\n`
        );
      }
      res.write(`data: ${JSON.stringify({ type: "buffer_end" })}\n\n`);
    }

    // Heartbeat every 30s to keep connection alive
    const heartbeatInterval = setInterval(() => {
      try {
        res.write(`:heartbeat\n\n`);
      } catch {
        this.disconnect(clientId);
      }
    }, 30000);

    // Store client
    const client: SSEClient = {
      id: clientId,
      res,
      deploymentId,
      connectedAt: new Date(),
      heartbeatInterval,
    };
    clients.set(clientId, client);

    // Handle disconnect
    res.on("close", () => {
      this.disconnect(clientId);
    });

    return clientId;
  },

  /**
   * Append a log line to a deployment's buffer and broadcast to connected clients.
   */
  appendLog(deploymentId: string, message: string): void {
    const timestamp = Date.now();

    // Buffer the log entry
    if (!logBuffers.has(deploymentId)) {
      logBuffers.set(deploymentId, { entries: [], maxSize: MAX_BUFFER_SIZE });
    }
    const buffer = logBuffers.get(deploymentId)!;
    buffer.entries.push({ message, timestamp });

    // Trim buffer to max size (drop oldest)
    if (buffer.entries.length > buffer.maxSize) {
      buffer.entries = buffer.entries.slice(-buffer.maxSize);
    }

    // Broadcast to connected SSE clients for this deployment
    const logEvent = JSON.stringify({ type: "log", message, timestamp });
    for (const client of clients.values()) {
      if (client.deploymentId === deploymentId) {
        try {
          client.res.write(`data: ${logEvent}\n\n`);
        } catch {
          this.disconnect(client.id);
        }
      }
    }
  },

  /**
   * Send a status update event to all clients watching a deployment.
   */
  sendStatus(deploymentId: string, status: string, details?: Record<string, unknown>): void {
    const event = JSON.stringify({ type: "status", status, ...details, timestamp: Date.now() });

    for (const client of clients.values()) {
      if (client.deploymentId === deploymentId) {
        try {
          client.res.write(`data: ${event}\n\n`);
        } catch {
          this.disconnect(client.id);
        }
      }
    }
  },

  /**
   * Send a completion event and close all SSE connections for a deployment.
   */
  complete(deploymentId: string, status: string, buildLog?: string): void {
    const event = JSON.stringify({
      type: "complete",
      status,
      timestamp: Date.now(),
    });

    for (const client of clients.values()) {
      if (client.deploymentId === deploymentId) {
        try {
          client.res.write(`data: ${event}\n\n`);
          client.res.end();
        } catch {
          // Already closed
        }
        this.disconnect(client.id);
      }
    }
  },

  /**
   * Disconnect a single client.
   */
  disconnect(clientId: string): void {
    const client = clients.get(clientId);
    if (!client) return;

    if (client.heartbeatInterval) {
      clearInterval(client.heartbeatInterval);
    }

    try {
      client.res.end();
    } catch {
      // Already closed
    }

    clients.delete(clientId);
  },

  /**
   * Close all SSE connections for a deployment.
   */
  closeAll(deploymentId: string): void {
    for (const client of clients.values()) {
      if (client.deploymentId === deploymentId) {
        this.disconnect(client.id);
      }
    }
  },

  /**
   * Clear the log buffer for a deployment.
   */
  clearBuffer(deploymentId: string): void {
    logBuffers.delete(deploymentId);
  },

  /**
   * Get connected clients count for a deployment.
   */
  getClientCount(deploymentId: string): number {
    let count = 0;
    for (const client of clients.values()) {
      if (client.deploymentId === deploymentId) count++;
    }
    return count;
  },

  /**
   * Get total connected clients.
   */
  getTotalClients(): number {
    return clients.size;
  },
};
