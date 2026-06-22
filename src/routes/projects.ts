import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { ApiResponse, PaginatedResponse, CreateProjectBody, UpdateProjectBody } from "../types";

const router = Router();

function paramStr(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

const MAX_NAME_LENGTH = 128;
const MAX_BUILD_COMMAND_LENGTH = 1024;

// POST /api/projects - Create a project

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = req.body as CreateProjectBody;

    if (!body.name) {
      res.status(400).json({
        success: false,
        error: "Project name is required",
      } satisfies ApiResponse);
      return;
    }

    if (typeof body.name === "string" && body.name.length > MAX_NAME_LENGTH) {
      res.status(400).json({
        success: false,
        error: `Project name must be ${MAX_NAME_LENGTH} characters or fewer`,
      } satisfies ApiResponse);
      return;
    }

    if (body.buildCommand && typeof body.buildCommand === "string" && body.buildCommand.length > MAX_BUILD_COMMAND_LENGTH) {
      res.status(400).json({
        success: false,
        error: `Build command must be ${MAX_BUILD_COMMAND_LENGTH} characters or fewer`,
      } satisfies ApiResponse);
      return;
    }

    const project = await prisma.project.create({
      data: {
        name: body.name,
        framework: body.framework ?? null,
        buildCommand: body.buildCommand ?? null,
        outputDir: body.outputDir ?? null,
        installCommand: body.installCommand ?? null,
        rootDirectory: body.rootDirectory ?? null,
      },
    });

    res.status(201).json({
      success: true,
      data: project,
      message: "Project created successfully",
    } satisfies ApiResponse);
  } catch (error: unknown) {
    console.error("[projects] POST / error:", error);

    if (error instanceof Error && "code" in error && (error as { code: string }).code === "P2002") {
      res.status(409).json({
        success: false,
        error: "A project with that name already exists",
      } satisfies ApiResponse);
      return;
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    } satisfies ApiResponse);
  }
});

// GET /api/projects - List projects

router.get("/", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = req.query.search as string | undefined;

    const where: { name?: { contains: string } } = {};
    if (search) {
      where.name = { contains: search };
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          _count: {
            select: {
              deployments: true,
              domains: true,
              envVars: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.project.count({ where }),
    ]);

    res.json({
      success: true,
      data: projects.map((p) => ({
        ...p,
        deploymentCount: p._count.deployments,
        domainCount: p._count.domains,
        envVarCount: p._count.envVars,
        _count: undefined,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    } satisfies PaginatedResponse<any>);
  } catch (error) {
    console.error("[projects] GET / error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    } satisfies ApiResponse);
  }
});

// GET /api/projects/:id - Get project details

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        deployments: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        domains: true,
        envVars: {
          select: { id: true, key: true, createdAt: true },
        },
        _count: {
          select: { deployments: true },
        },
      },
    });

    if (!project) {
      res.status(404).json({
        success: false,
        error: "Project not found",
      } satisfies ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: {
        ...project,
        deploymentCount: project._count.deployments,
        _count: undefined,
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error("[projects] GET /:id error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    } satisfies ApiResponse);
  }
});

// PUT /api/projects/:id - Update project

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    const body = req.body as UpdateProjectBody;

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({
        success: false,
        error: "Project not found",
      } satisfies ApiResponse);
      return;
    }

    if (body.name !== undefined && typeof body.name === "string" && body.name.length > MAX_NAME_LENGTH) {
      res.status(400).json({
        success: false,
        error: `Project name must be ${MAX_NAME_LENGTH} characters or fewer`,
      } satisfies ApiResponse);
      return;
    }

    if (body.buildCommand !== undefined && typeof body.buildCommand === "string" && body.buildCommand.length > MAX_BUILD_COMMAND_LENGTH) {
      res.status(400).json({
        success: false,
        error: `Build command must be ${MAX_BUILD_COMMAND_LENGTH} characters or fewer`,
      } satisfies ApiResponse);
      return;
    }

    const updateData: { name?: string; framework?: string | null; buildCommand?: string | null; outputDir?: string | null; installCommand?: string | null; rootDirectory?: string | null } = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.framework !== undefined) updateData.framework = body.framework;
    if (body.buildCommand !== undefined) updateData.buildCommand = body.buildCommand;
    if (body.outputDir !== undefined) updateData.outputDir = body.outputDir;
    if (body.installCommand !== undefined) updateData.installCommand = body.installCommand;
    if (body.rootDirectory !== undefined) updateData.rootDirectory = body.rootDirectory;

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      data: project,
      message: "Project updated successfully",
    } satisfies ApiResponse);
  } catch (error: unknown) {
    console.error("[projects] PUT /:id error:", error);

    if (error instanceof Error && "code" in error && (error as { code: string }).code === "P2002") {
      res.status(409).json({
        success: false,
        error: "A project with that name already exists",
      } satisfies ApiResponse);
      return;
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    } satisfies ApiResponse);
  }
});

// DELETE /api/projects/:id - Delete project

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({
        success: false,
        error: "Project not found",
      } satisfies ApiResponse);
      return;
    }

    // Delete related records in parallel (cascading not guaranteed with SQLite)
    await Promise.all([
      prisma.envVar.deleteMany({ where: { projectId: id } }),
      prisma.edgeFunction.deleteMany({ where: { projectId: id } }),
      prisma.redirectRule.deleteMany({ where: { projectId: id } }),
      prisma.domain.deleteMany({ where: { projectId: id } }),
      prisma.deployment.deleteMany({ where: { projectId: id } }),
    ]);
    await prisma.project.delete({ where: { id } });

    res.json({
      success: true,
      message: "Project deleted successfully",
    } satisfies ApiResponse);
  } catch (error) {
    console.error("[projects] DELETE /:id error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    } satisfies ApiResponse);
  }
});

// GET /api/projects/:id/deployments - List deployments for project

router.get("/:id/deployments", async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      res.status(404).json({
        success: false,
        error: "Project not found",
      } satisfies ApiResponse);
      return;
    }

    const [deployments, total] = await Promise.all([
      prisma.deployment.findMany({
        where: { projectId: id },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.deployment.count({ where: { projectId: id } }),
    ]);

    res.json({
      success: true,
      data: deployments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    } satisfies PaginatedResponse<any>);
  } catch (error) {
    console.error("[projects] GET /:id/deployments error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    } satisfies ApiResponse);
  }
});

export default router;
