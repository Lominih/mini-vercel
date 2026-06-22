import { describe, it, expect } from "vitest";

type DNSType = "A" | "CNAME" | "TXT" | "AAAA";

interface DNSRecord {
  type: DNSType;
  name: string;
  value: string;
  ttl: number;
}

interface DNSVerificationResult {
  verified: boolean;
  records: DNSRecord[];
  message: string;
}

function normalizeDomain(domain: string): string {
  return domain.toLowerCase().replace(/\.$/, "");
}

function matchesWildcard(pattern: string, domain: string): boolean {
  if (!pattern.startsWith("*.")) return false;
  const suffix = pattern.slice(1);
  return domain.endsWith(suffix);
}

function matchesRecord(
  record: DNSRecord,
  domain: string,
  expectedType: DNSType,
  expectedValue?: string
): boolean {
  const normalizedDomain = normalizeDomain(domain);
  const recordName = normalizeDomain(record.name);

  const nameMatches =
    recordName === normalizedDomain ||
    recordName === `*.${normalizedDomain}` ||
    matchesWildcard(recordName, normalizedDomain) ||
    normalizedDomain.endsWith(`.${recordName}`);

  if (!nameMatches) return false;
  if (record.type !== expectedType) return false;

  if (expectedValue) {
    return normalizeDomain(record.value) === normalizeDomain(expectedValue);
  }

  return true;
}

// In-memory DNS store for testing
const dnsStore = new Map<string, DNSRecord[]>();

function addDNSRecord(domain: string, record: DNSRecord): void {
  const normalized = normalizeDomain(domain);
  const existing = dnsStore.get(normalized) || [];
  existing.push(record);
  dnsStore.set(normalized, existing);
}

function getDNSRecords(domain: string): DNSRecord[] {
  return dnsStore.get(normalizeDomain(domain)) || [];
}

function removeDNSRecord(domain: string, type: DNSType, value: string): boolean {
  const normalized = normalizeDomain(domain);
  const existing = dnsStore.get(normalized);
  if (!existing) return false;

      const normalizedType = type.toUpperCase();
    const idx = existing.findIndex(
    (r) => r.type === normalizedType && normalizeDomain(r.value) === normalizeDomain(value)
  );
  if (idx === -1) return false;

  existing.splice(idx, 1);
  if (existing.length === 0) dnsStore.delete(normalized);
  return true;
}

function verifyARecord(domain: string, expectedIp: string): DNSVerificationResult {
  const records = getDNSRecords(domain);
  const matches = records.filter((r) => matchesRecord(r, domain, "A", expectedIp));
  return {
    verified: matches.length > 0,
    records: matches,
    message: matches.length > 0
      ? "A record verified successfully"
      : `No matching A record found for ${domain} pointing to ${expectedIp}`,
  };
}

function verifyCNAMERecord(domain: string, expectedTarget: string): DNSVerificationResult {
  const records = getDNSRecords(domain);
  const matches = records.filter((r) => matchesRecord(r, domain, "CNAME", expectedTarget));
  return {
    verified: matches.length > 0,
    records: matches,
    message: matches.length > 0
      ? "CNAME record verified successfully"
      : `No matching CNAME record found for ${domain} pointing to ${expectedTarget}`,
  };
}

function verifyTXTRecord(domain: string, expectedValue: string): DNSVerificationResult {
  const records = getDNSRecords(domain);
  const matches = records.filter((r) => matchesRecord(r, domain, "TXT", expectedValue));
  return {
    verified: matches.length > 0,
    records: matches,
    message: matches.length > 0
      ? "TXT record verified successfully"
      : `No matching TXT record found for ${domain} with value ${expectedValue}`,
  };
}

function verifyDomain(domain: string, token: string): DNSVerificationResult {
  const txtResult = verifyTXTRecord(domain, `_mini-vercel-verify=${token}`);
  if (txtResult.verified) return txtResult;
  const cnameResult = verifyCNAMERecord(domain, "cname.mini-vercel.app");
  if (cnameResult.verified) return cnameResult;
  return {
    verified: false,
    records: [],
    message: `Domain ${domain} could not be verified.`,
  };
}

beforeEach(() => {
  dnsStore.clear();
});

describe("Domain Normalization", () => {
  it("should lowercase domain names", () => {
    expect(normalizeDomain("Example.COM")).toBe("example.com");
  });

  it("should strip trailing dots", () => {
    expect(normalizeDomain("example.com.")).toBe("example.com");
  });

  it("should handle already normalized domains", () => {
    expect(normalizeDomain("example.com")).toBe("example.com");
  });
});

describe("Wildcard Matching", () => {
  it("should match wildcard patterns", () => {
    expect(matchesWildcard("*.example.com", "sub.example.com")).toBe(true);
  });

  it("should not match non-wildcard patterns", () => {
    expect(matchesWildcard("example.com", "sub.example.com")).toBe(false);
  });

  it("should not match if suffix doesn't align", () => {
    expect(matchesWildcard("*.example.com", "other.com")).toBe(false);
  });
});

describe("DNS Record Management", () => {
  const record: DNSRecord = {
    type: "A",
    name: "example.com",
    value: "1.2.3.4",
    ttl: 300,
  };

  it("should add and retrieve DNS records", () => {
    addDNSRecord("example.com", record);
    const records = getDNSRecords("example.com");
    expect(records).toHaveLength(1);
    expect(records[0].value).toBe("1.2.3.4");
  });

  it("should return empty array for unknown domains", () => {
    const records = getDNSRecords("unknown.com");
    expect(records).toHaveLength(0);
  });

  it("should remove a DNS record", () => {
    addDNSRecord("example.com", record);
    const removed = removeDNSRecord("example.com", "A", "1.2.3.4");
    expect(removed).toBe(true);
    expect(getDNSRecords("example.com")).toHaveLength(0);
  });

  it("should fail to remove non-existent record", () => {
    const removed = removeDNSRecord("example.com", "A", "1.2.3.4");
    expect(removed).toBe(false);
  });

  it("should handle case-insensitive removal", () => {
    addDNSRecord("example.com", record);
    const removed = removeDNSRecord("EXAMPLE.COM", "a", "1.2.3.4");
    expect(removed).toBe(true);
  });
});

describe("A Record Verification", () => {
  it("should verify a matching A record", () => {
    addDNSRecord("example.com", {
      type: "A", name: "example.com", value: "1.2.3.4", ttl: 300,
    });
    const result = verifyARecord("example.com", "1.2.3.4");
    expect(result.verified).toBe(true);
    expect(result.records).toHaveLength(1);
  });

  it("should fail verification with wrong IP", () => {
    addDNSRecord("example.com", {
      type: "A", name: "example.com", value: "1.2.3.4", ttl: 300,
    });
    const result = verifyARecord("example.com", "5.6.7.8");
    expect(result.verified).toBe(false);
  });

  it("should fail when no A record exists", () => {
    const result = verifyARecord("example.com", "1.2.3.4");
    expect(result.verified).toBe(false);
  });
});

describe("CNAME Record Verification", () => {
  it("should verify a matching CNAME record", () => {
    addDNSRecord("example.com", {
      type: "CNAME", name: "example.com", value: "cname.mini-vercel.app", ttl: 300,
    });
    const result = verifyCNAMERecord("example.com", "cname.mini-vercel.app");
    expect(result.verified).toBe(true);
  });

  it("should fail verification with wrong target", () => {
    addDNSRecord("example.com", {
      type: "CNAME", name: "example.com", value: "other.cdn.com", ttl: 300,
    });
    const result = verifyCNAMERecord("example.com", "cname.mini-vercel.app");
    expect(result.verified).toBe(false);
  });
});

describe("TXT Record Verification", () => {
  it("should verify a matching TXT record", () => {
    addDNSRecord("example.com", {
      type: "TXT", name: "example.com", value: "_mini-vercel-verify=abc123", ttl: 300,
    });
    const result = verifyTXTRecord("example.com", "_mini-vercel-verify=abc123");
    expect(result.verified).toBe(true);
  });

  it("should fail with wrong TXT value", () => {
    addDNSRecord("example.com", {
      type: "TXT", name: "example.com", value: "wrong-value", ttl: 300,
    });
    const result = verifyTXTRecord("example.com", "_mini-vercel-verify=abc123");
    expect(result.verified).toBe(false);
  });
});

describe("Full Domain Verification", () => {
  it("should verify via TXT record first", () => {
    addDNSRecord("example.com", {
      type: "TXT", name: "example.com", value: "_mini-vercel-verify=token1", ttl: 300,
    });
    const result = verifyDomain("example.com", "token1");
    expect(result.verified).toBe(true);
  });

  it("should fall back to CNAME verification", () => {
    addDNSRecord("example.com", {
      type: "CNAME", name: "example.com", value: "cname.mini-vercel.app", ttl: 300,
    });
    const result = verifyDomain("example.com", "token1");
    expect(result.verified).true;
  });

  it("should fail when no records match", () => {
    const result = verifyDomain("example.com", "token1");
    expect(result.verified).toBe(false);
  });
});
