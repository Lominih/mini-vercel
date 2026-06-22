import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { encrypt, maskValue } from "../services/env-encryption";

const router = Router();

const MAX_ENV_VALUE_LENGTH = 10_000;

function paramStr(val: unknown): string {
  return Array.isArray(val) ? val[0] : (val as string ?? "");
}

router.post("/", async (req: Request, res: Response) => {
  try {
    const { projectId, key, value } = req.body;

    if (!projectId || !key || value === undefined) {
      return res.status(400).json({ error: "projectId, key, and value are required" });
    }

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      return res.status(400).json({
        error: "Env var key must start with a letter or underscore and contain only alphanumeric characters and underscores",
      });
    }

    if (typeof value === "string" && value.length > MAX_ENV_VALUE_LENGTH) {
      return res.status(400).json({
        error: `Env var value must be ${MAX_ENV_VALUE_LENGTH} characters or fewer`,
      });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const existing = await prisma.envVar.findUnique({
      where: { projectId_key: { projectId, key } },
    });
    if (existing) {
      return res.status(409).json({ error: `Environment variable "${key}" already exists. Use PUT to update.` });
    }

    const encryptedValue = encrypt(String(value));

    const envVar = await prisma.envVar.create({
      data: { projectId, key, value: encryptedValue, encrypted: true },
    });

    res.status(201).json({
      id: envVar.id,
      projectId: envVar.projectId,
      key: envVar.key,
      value: maskValue(envVar.value),
      encrypted: envVar.encrypted,
      createdAt: envVar.createdAt,
    });
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

    const envVars = await prisma.envVar.findMany({
      where: { projectId },
      orderBy: { key: "asc" },
    });

    res.json(
      envVars.map((v) => ({
        id: v.id,
        projectId: v.projectId,
        key: v.key,
        value: maskValue(v.value),
        encrypted: v.encrypted,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      }))
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    const { key, value } = req.body;

    const envVar = await prisma.envVar.findUnique({ where: { id } });
    if (!envVar) {
      return res.status(404).json({ error: "Environment variable not found" });
    }

    const updateData: { key?: string; value?: string } = {};

    if (key !== undefined) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        return res.status(400).json({
          error: "Env var key must start with a letter or underscore and contain only alphanumeric characters and underscores",
        });
      }

      if (key !== envVar.key) {
        const conflict = await prisma.envVar.findUnique({
          where: { projectId_key: { projectId: envVar.projectId, key } },
        });
        if (conflict) {
          return res.status(409).json({ error: `Environment variable "${key}" already exists in this project` });
        }
      }

      updateData.key = key;
    }

    if (value !== undefined) {
      if (typeof value === "string" && value.length > MAX_ENV_VALUE_LENGTH) {
        return res.status(400).json({
          error: `Env var value must be ${MAX_ENV_VALUE_LENGTH} characters or fewer`,
        });
      }
      updateData.value = encrypt(String(value));
    }

    const updated = await prisma.envVar.update({
      where: { id },
      data: updateData,
    });

    res.json({
      id: updated.id,
      projectId: updated.projectId,
      key: updated.key,
      value: maskValue(updated.value),
      encrypted: updated.encrypted,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);

    const envVar = await prisma.envVar.findUnique({ where: { id } });
    if (!envVar) {
      return res.status(404).json({ error: "Environment variable not found" });
    }

    await prisma.envVar.delete({ where: { id } });

    res.json({ message: "Environment variable deleted successfully" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

router.post("/bulk", async (req: Request, res: Response) => {
  try {
    const { projectId, vars } = req.body;

    if (!projectId || !Array.isArray(vars)) {
      return res.status(400).json({ error: "projectId and vars array are required" });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const results: Array<{ key: string; action: "created" | "updated"; id: string }> = [];
    const errors: Array<{ key: string; error: string }> = [];

    // Validate all items first
    const validItems: Array<{ key: string; value: unknown }> = [];
    for (const item of vars) {
      const { key, value } = item;

      if (!key || value === undefined) {
        errors.push({ key: key || "(empty)", error: "key and value are required" });
        continue;
      }

      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        errors.push({ key, error: "Invalid key format" });
        continue;
      }

      if (typeof value === "string" && value.length > MAX_ENV_VALUE_LENGTH) {
        errors.push({ key, error: `Value exceeds ${MAX_ENV_VALUE_LENGTH} character limit` });
        continue;
      }

      validItems.push({ key, value });
    }

    // Batch-fetch existing env vars for this project (1 query instead of N)
    const existingEnvVars = await prisma.envVar.findMany({
      where: { projectId, key: { in: validItems.map((item) => item.key) } },
    });
    const existingMap = new Map(existingEnvVars.map((ev) => [ev.key, ev]));

    // Process all valid items in parallel
    const operations = validItems.map(async ({ key, value }) => {
      try {
        const encryptedValue = encrypt(String(value));
        const existing = existingMap.get(key);

        if (existing) {
          const updated = await prisma.envVar.update({
            where: { id: existing.id },
            data: { value: encryptedValue },
          });
          results.push({ key, action: "updated", id: updated.id });
        } else {
          const created = await prisma.envVar.create({
            data: { projectId, key, value: encryptedValue, encrypted: true },
          });
          results.push({ key, action: "created", id: created.id });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        errors.push({ key, error: message });
      }
    });

    await Promise.all(operations);

    res.json({
      created: results.filter((r) => r.action === "created").length,
      updated: results.filter((r) => r.action === "updated").length,
      errors: errors.length,
      results,
      errorDetails: errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

export default router;
