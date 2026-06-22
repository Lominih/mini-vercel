import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import {
  invokeFunction,
  getFunctionLogs,
  clearFunctionLogs,
  removeColdStart,
  EdgeRequest,
} from "../services/edge-runtime";

const router = Router();

function paramStr(val: unknown): string {
  return Array.isArray(val) ? val[0] : (val as string ?? "");
}

router.post("/", async (req: Request, res: Response) => {
  try {
    const { projectId, name, path, runtime, code } = req.body;

    if (!projectId || !name || !path || !code) {
      return res.status(400).json({
        error: "projectId, name, path, and code are required",
      });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    const existing = await prisma.edgeFunction.findFirst({
      where: { projectId, path: normalizedPath },
    });
    if (existing) {
      return res.status(409).json({
        error: `A function already exists at path ${normalizedPath}`,
      });
    }

    const fn = await prisma.edgeFunction.create({
      data: {
        projectId,
        name,
        path: normalizedPath,
        runtime: runtime || "nodejs",
        code,
      },
    });

    res.status(201).json(fn);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId as string | undefined;

    if (!projectId) {
      return res.status(400).json({ error: "projectId query parameter is required" });
    }

    const functions = await prisma.edgeFunction.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    res.json(functions);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    const { name, path, runtime, code } = req.body;

    const fn = await prisma.edgeFunction.findUnique({ where: { id } });
    if (!fn) {
      return res.status(404).json({ error: "Function not found" });
    }

    const updateData: Record<string, string> = {};
    if (name !== undefined) updateData.name = name;
    if (runtime !== undefined) updateData.runtime = runtime;
    if (code !== undefined) updateData.code = code;

    if (path !== undefined) {
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      if (normalizedPath !== fn.path) {
        const conflict = await prisma.edgeFunction.findFirst({
          where: { projectId: fn.projectId, path: normalizedPath },
        });
        if (conflict) {
          return res.status(409).json({
            error: `A function already exists at path ${normalizedPath}`,
          });
        }
        updateData.path = normalizedPath;
      }
    }

    const updated = await prisma.edgeFunction.update({
      where: { id },
      data: updateData,
    });

    if (code !== undefined) {
      removeColdStart(id);
    }

    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);

    const fn = await prisma.edgeFunction.findUnique({ where: { id } });
    if (!fn) {
      return res.status(404).json({ error: "Function not found" });
    }

    clearFunctionLogs(id);
    removeColdStart(id);
    await prisma.edgeFunction.delete({ where: { id } });

    res.json({ message: "Function deleted successfully" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

router.post("/:id/invoke", async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    const { method, url, headers, body, query } = req.body;

    const fn = await prisma.edgeFunction.findUnique({ where: { id } });
    if (!fn) {
      return res.status(404).json({ error: "Function not found" });
    }

    const edgeRequest: EdgeRequest = {
      method: method || "GET",
      url: url || "/",
      headers: headers || {},
      body,
      query: query || {},
    };

    const { response, coldStart, duration } = await invokeFunction(id, edgeRequest);

    res.status(response.status).json({
      result: response.body,
      headers: response.headers,
      coldStart,
      duration,
      functionId: id,
      functionName: fn.name,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

router.get("/:id/logs", async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    const limit = parseInt(req.query.limit as string) || 100;

    const fn = await prisma.edgeFunction.findUnique({ where: { id } });
    if (!fn) {
      return res.status(404).json({ error: "Function not found" });
    }

    const logs = getFunctionLogs(id, limit);

    res.json({
      functionId: id,
      functionName: fn.name,
      logs,
      total: logs.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

export default router;