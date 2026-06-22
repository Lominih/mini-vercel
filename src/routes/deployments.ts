import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { deploymentCache } from "../lib/cache";
import {
  listDeployments,
  rollbackDeployment,
  deleteDeployment,
} from "../services/deployment";
import { logStreamer } from "../services/log-streamer";
import { ApiResponse, PaginatedResponse, BuildStatus } from "../types";

const router = Router();

function paramStr(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

// GET /api/deployments - List deployments for a project

router.get("/", async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const status = req.query.status as BuildStatus | undefined;
    const branch = req.query.branch as string | undefined;

    if (!projectId) {
      res.status(400).json({
        success: false,
        error: "projectId query parameter is required",
      } satisfies ApiResponse);
      return;
    }

    const result = await listDeployments(projectId, page, limit, {
      status,
      branch,
    });

    res.json({
      success: true,
      data: result.deployments,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    } satisfies PaginatedResponse<any>);
  } catch (error) {
    console.error("[deployments] GET / error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    } satisfies ApiResponse);
  }
});

// GET /api/deployments/:id - Get deployment details (cached)

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);

    const cached = deploymentCache.get<any>(`deployment:${id}`);
    if (cached) {
      res.json({
        success: true,
        data: cached,
      } satisfies ApiResponse);
      return;
    }

    const deployment = await prisma.deployment.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            framework: true,
          },
        },
      },
    });

    if (!deployment) {
      res.status(404).json({
        success: false,
        error: "Deployment not found",
      } satisfies ApiResponse);
      return;
    }

    const data = {
      ...deployment,
      viewerCount: logStreamer.getClientCount(id),
    };

    deploymentCache.set(`deployment:${id}`, data);

    res.json({
      success: true,
      data,
    } satisfies ApiResponse);
  } catch (error) {
    console.error("[deployments] GET /:id error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    } satisfies ApiResponse);
  }
});

// POST /api/deployments/:id/promote - Promote preview to production

router.post("/:id/promote", async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);

    const deployment = await prisma.deployment.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!deployment) {
      res.status(404).json({
        success: false,
        error: "Deployment not found",
      } satisfies ApiResponse);
      return;
    }

    if (deployment.status !== "ready") {
      res.status(400).json({
        success: false,
        error: "Can only promote a ready deployment",
      } satisfies ApiResponse);
      return;
    }

    // Promote: clear the branch to make it the production deployment
    const promoted = await prisma.deployment.update({
      where: { id },
      data: { branch: null },
      include: { project: true },
    });

    deploymentCache.delete(`deployment:${id}`);

    res.json({
      success: true,
      data: promoted,
      message: "Deployment promoted to production",
    } satisfies ApiResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({
      success: false,
      error: message,
    } satisfies ApiResponse);
  }
});

// POST /api/deployments/:id/rollback - Rollback to this deployment

router.post("/:id/rollback", async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);

    const newDeployment = await rollbackDeployment(id);

    res.json({
      success: true,
      data: newDeployment,
      message: `Rolled back. New deployment: ${newDeployment.id}`,
    } satisfies ApiResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("not found") ? 404 : 400;

    res.status(status).json({
      success: false,
      error: message,
    } satisfies ApiResponse);
  }
});

// DELETE /api/deployments/:id - Delete a deployment

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);

    await deleteDeployment(id);

    deploymentCache.delete(`deployment:${id}`);

    res.json({
      success: true,
      message: "Deployment deleted successfully",
    } satisfies ApiResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("not found") ? 404 : 400;

    res.status(status).json({
      success: false,
      error: message,
    } satisfies ApiResponse);
  }
});

export default router;
