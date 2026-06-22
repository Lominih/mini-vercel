import crypto from "crypto";
import { prisma } from "../lib/prisma";

export interface Certificate {
  domain: string;
  cert: string;
  key: string;
  issuedAt: Date;
  expiresAt: Date;
}

const CERTIFICATE_LIFETIME_DAYS = 90;
const RENEWAL_THRESHOLD_DAYS = 30;

const certificateStore = new Map<string, Certificate>();

function generateSelfSignedCert(domain: string): Certificate {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + CERTIFICATE_LIFETIME_DAYS);

  const serialNumber = crypto.randomBytes(16).toString("hex");

  const cert = `-----BEGIN CERTIFICATE-----
MIID${crypto.randomBytes(16).toString("base64").replace(/[^A-Za-z0-9+/=]/g, "").substring(0, 200)}
-----END CERTIFICATE-----`;

  const certificate: Certificate = {
    domain,
    cert: publicKey,
    key: privateKey,
    issuedAt: now,
    expiresAt,
  };

  return certificate;
}

export async function requestCertificate(domainId: string): Promise<Certificate> {
  const domain = await prisma.domain.findUniqueOrThrow({
    where: { id: domainId },
  });

  if (domain.sslStatus === "active" && domain.sslExpiry) {
    const daysUntilExpiry = Math.ceil(
      (domain.sslExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilExpiry > RENEWAL_THRESHOLD_DAYS) {
      const existing = certificateStore.get(domain.name);
      if (existing) return existing;
    }
  }

  await prisma.domain.update({
    where: { id: domainId },
    data: { sslStatus: "pending" },
  });

  const certificate = generateSelfSignedCert(domain.name);

  certificateStore.set(domain.name, certificate);

  await prisma.domain.update({
    where: { id: domainId },
    data: {
      sslStatus: "active",
      sslCert: certificate.cert,
      sslKey: certificate.key,
      sslExpiry: certificate.expiresAt,
    },
  });

  return certificate;
}

export async function checkRenewals(): Promise<string[]> {
  const domains = await prisma.domain.findMany({
    where: { sslStatus: "active", sslExpiry: { not: null } },
  });

  const domainsNeedingRenewal = domains.filter((domain) => {
    if (!domain.sslExpiry) return false;
    const daysUntilExpiry = Math.ceil(
      (domain.sslExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= RENEWAL_THRESHOLD_DAYS;
  });

  const results = await Promise.allSettled(
    domainsNeedingRenewal.map((domain) => requestCertificate(domain.id))
  );

  const renewed: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      renewed.push(domainsNeedingRenewal[index].name);
    }
  });

  return renewed;
}

export function getCertificate(domainName: string): Certificate | undefined {
  return certificateStore.get(domainName);
}

export function getSSLStatus(domainId: string): Promise<string | null> {
  return prisma.domain
    .findUnique({ where: { id: domainId }, select: { sslStatus: true } })
    .then((d: { sslStatus: string | null } | null) => d?.sslStatus ?? null);
}