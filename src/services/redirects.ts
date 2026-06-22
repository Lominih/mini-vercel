import { prisma } from "../lib/prisma";

export type RedirectStatusCode = 301 | 302 | 307 | 308;

export interface RedirectResult {
  redirected: boolean;
  target?: string;
  statusCode?: RedirectStatusCode;
}

export async function createRedirectRule(
  projectId: string,
  source: string,
  target: string,
  statusCode: RedirectStatusCode = 301,
  regex: boolean = false,
  preserveQuery: boolean = true
) {
  if (regex) {
    try {
      new RegExp(source);
    } catch {
      throw new Error(`Invalid regex pattern: ${source}`);
    }
  }

  const validStatuses: number[] = [301, 302, 307, 308];
  if (!validStatuses.includes(statusCode)) {
    throw new Error(`Invalid status code: ${statusCode}. Must be 301, 302, 307, or 308`);
  }

  return prisma.redirectRule.create({
    data: { projectId, source, target, statusCode, regex, preserveQuery },
  });
}

export async function getRedirectRules(projectId: string) {
  return prisma.redirectRule.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateRedirectRule(
  id: string,
  data: Partial<{
    source: string;
    target: string;
    statusCode: RedirectStatusCode;
    regex: boolean;
    preserveQuery: boolean;
  }>
) {
  if (data.regex && data.source) {
    try {
      new RegExp(data.source);
    } catch {
      throw new Error(`Invalid regex pattern: ${data.source}`);
    }
  }

  if (data.statusCode) {
    const validStatuses: number[] = [301, 302, 307, 308];
    if (!validStatuses.includes(data.statusCode)) {
      throw new Error(`Invalid status code: ${data.statusCode}`);
    }
  }

  return prisma.redirectRule.update({ where: { id }, data });
}

export async function deleteRedirectRule(id: string) {
  return prisma.redirectRule.delete({ where: { id } });
}

export async function resolveRedirect(
  projectId: string,
  requestPath: string,
  queryString?: string
): Promise<RedirectResult> {
  const rules = await prisma.redirectRule.findMany({
    where: { projectId },
  });

  for (const rule of rules) {
    let matches = false;
    let replacement = rule.target;

    if (rule.regex) {
      const regex = new RegExp(rule.source);
      const match = requestPath.match(regex);
      if (match) {
        matches = true;
        replacement = requestPath.replace(regex, rule.target);
      }
    } else {
      const normalizedSource = rule.source.replace(/\/$/, "");
      const normalizedPath = requestPath.replace(/\/$/, "");
      if (normalizedPath === normalizedSource || normalizedPath.startsWith(normalizedSource + "/")) {
        matches = true;
        const suffix = normalizedPath.slice(normalizedSource.length);
        replacement = rule.target + suffix;
      }
    }

    if (matches) {
      let finalTarget = replacement;
      if (rule.preserveQuery && queryString) {
        const separator = finalTarget.includes("?") ? "&" : "?";
        finalTarget += separator + queryString;
      }

      return {
        redirected: true,
        target: finalTarget,
        statusCode: rule.statusCode as RedirectStatusCode,
      };
    }
  }

  return { redirected: false };
}