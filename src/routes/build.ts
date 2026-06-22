import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { deploymentCache } from "../lib/cache";
import { createDeployment } from "../services/deployment";
import { cancelBuild, isBuildActive } from "../services/build-system";
import { logStreamer } from "../services/log-streamer";
import { ApiResponse, PaginatedResponse, TriggerBuildBody } from "../types";

const router = Router();

function paramStr(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

// POST /api/builds - Trigger a new build

router.post("/", async (req: Request, res: Response) => {
  try {
    const { projectId, branch, commitSha, commitMsg } = req.body as TriggerBuildBody;

    if (!projectId) {
      res.status(400).json({
        success: false,
        error: "projectId is required",
      } satisfies ApiResponse);
      return;
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      res.status(404).json({
        success: false,
        error: "Project not found",
      } satisfies ApiResponse);
      return;
    }

    const deployment = await createDeployment({
      projectId,
      branch,
      commitSha,
      commitMsg,
    });

    res.status(201).json({
      success: true,
      data: deployment,
      message: "Build triggered successfully",
    } satisfies ApiResponse);
  } catch (error) {
    console.error("[builds] POST / error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    } satisfies ApiResponse);
  }
});

// GET /api/builds/:id - Get build status and logs (cached)

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);

    const cached = deploymentCache.get<any>(`build:${id}`);
    if (cached) {
      res.json({
        success: true,
        data: cached,
      } satisfies ApiResponse);
      return;
    }

    const deployment = await prisma.deployment.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!deployment) {
      res.status(404).json({
        success: false,
        error: "Build not found",
      } satisfies ApiResponse);
      return;
    }

    const data = {
      ...deployment,
      isActive: isBuildActive(id),
      viewerCount: logStreamer.getClientCount(id),
    };

    deploymentCache.set(`build:${id}`, data);

    res.json({
      success: true,
      data,
    } satisfies ApiResponse);
  } catch (error: unknown) {
    console.error("[builds] GET /:id error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    } satisfies ApiResponse);
  }
});

// GET /api/builds/:id/logs - Stream build logs via SSE

router.get("/:id/logs", async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);

    const deployment = await prisma.deployment.findUnique({ where: { id } });

    if (!deployment) {
      res.status(404).json({
        success: false,
        error: "Build not found",
      } satisfies ApiResponse);
      return;
    }

    const clientId = logStreamer.connect(id, res);
    console.log(`[builds] SSE client ${clientId} connected for build ${id}`);
  } catch (error: unknown) {
    console.error("[builds] GET /:id/logs error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    } satisfies ApiResponse);
  }
});

// POST /api/builds/:id/cancel - Cancel a running build

router.post("/:id/cancel", async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);

    const deployment = await prisma.deployment.findUnique({
      where: { id },
    });

    if (!deployment) {
      res.status(404).json({
        success: false,
        error: "Build not found",
      } satisfies ApiResponse);
      return;
    }

    if (deployment.status !== "queued" && deployment.status !== "building") {
      res.status(400).json({
        success: false,
        error: `Cannot cancel build with status: ${deployment.status}`,
      } satisfies ApiResponse);
      return;
    }

    const cancelled = await cancelBuild(id);

    if (!cancelled) {
      res.status(400).json({
        success: false,
        error: "Build is not currently active",
      } satisfies ApiResponse);
      return;
    }

    deploymentCache.delete(`build:${id}`);

    res.json({
      success: true,
      message: "Build cancelled successfully",
    } satisfies ApiResponse);
  } catch (error) {
    console.error("[builds] POST /:id/cancel error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    } satisfies ApiResponse);
  }
});

// GET /api/builds - List builds for a project

router.get("/", async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const status = req.query.status as string | undefined;
    const branch = req.query.branch as string | undefined;

    if (!projectId) {
      res.status(400).json({
        success: false,
        error: "projectId query parameter is required",
      } satisfies ApiResponse);
      return;
    }

    const where: { projectId: string; status?: string; branch?: string } = { projectId };
    if (status) where.status = status;
    if (branch) where.branch = branch;

    const [deployments, total] = await Promise.all([
      prisma.deployment.findMany({
        where,
        include: { project: { select: { id: true, name: true, framework: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.deployment.count({ where }),
    ]);

    res.json({
      success: true,
      data: deployments.map((d) => ({
        ...d,
        isActive: isBuildActive(d.id),
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    } satisfies PaginatedResponse<any>);
  } catch (error) {
    console.error("[builds] GET / error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    } satisfies ApiResponse);
  }
});

export default router;
