import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { requestCertificate } from "../services/ssl";
import { verifyDomain } from "../services/dns";
import crypto from "crypto";

const router = Router();

function paramStr(val: unknown): string {
  return Array.isArray(val) ? val[0] : (val as string ?? "");
}

router.post("/", async (req: Request, res: Response) => {
  try {
    const { projectId, name } = req.body;

    if (!projectId || !name) {
      return res.status(400).json({ error: "projectId and name are required" });
    }

    const domainRegex = /^(\*\.)?[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(name)) {
      return res.status(400).json({ error: "Invalid domain name" });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const existing = await prisma.domain.findUnique({ where: { name } });
    if (existing) {
      return res.status(409).json({ error: "Domain already registered" });
    }

    const domain = await prisma.domain.create({
      data: { projectId, name },
    });

    res.status(201).json({
      ...domain,
      verificationToken: crypto.randomBytes(32).toString("hex"),
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

    const domains = await prisma.domain.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    res.json(domains);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);

    const domain = await prisma.domain.findUnique({ where: { id } });
    if (!domain) {
      return res.status(404).json({ error: "Domain not found" });
    }

    await prisma.domain.delete({ where: { id } });

    res.json({ message: "Domain deleted successfully" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

router.post("/:id/verify", async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);

    const domain = await prisma.domain.findUnique({ where: { id } });
    if (!domain) {
      return res.status(404).json({ error: "Domain not found" });
    }

    const verificationToken = crypto
      .createHash("sha256")
      .update(`${domain.projectId}:${domain.name}`)
      .digest("hex");

    const result = verifyDomain(domain.name, verificationToken);

    if (result.verified) {
      await prisma.domain.update({
        where: { id },
        data: { verified: true },
      });
    }

    res.json({
      verified: result.verified,
      message: result.message,
      records: result.records,
      hint: `Add a TXT record: ${domain.name} -> _mini-vercel-verify=${verificationToken}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

router.post("/:id/ssl", async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);

    const domain = await prisma.domain.findUnique({ where: { id } });
    if (!domain) {
      return res.status(404).json({ error: "Domain not found" });
    }

    if (!domain.verified) {
      return res.status(400).json({
        error: "Domain must be verified before requesting SSL certificate",
      });
    }

    const certificate = await requestCertificate(id);

    res.json({
      status: "active",
      domain: domain.name,
      issuedAt: certificate.issuedAt,
      expiresAt: certificate.expiresAt,
      message: "SSL certificate issued successfully",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

export default router;