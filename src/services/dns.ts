export type DNSType = "A" | "CNAME" | "TXT" | "AAAA";

export interface DNSRecord {
  type: DNSType;
  name: string;
  value: string;
  ttl: number;
}

export interface DNSVerificationResult {
  verified: boolean;
  records: DNSRecord[];
  message: string;
}

const dnsStore = new Map<string, DNSRecord[]>();

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

export function addDNSRecord(
  domain: string,
  record: DNSRecord
): void {
  const normalized = normalizeDomain(domain);
  const existing = dnsStore.get(normalized) || [];
  existing.push(record);
  dnsStore.set(normalized, existing);
}

export function removeDNSRecord(
  domain: string,
  type: DNSType,
  value: string
): boolean {
  const normalized = normalizeDomain(domain);
  const existing = dnsStore.get(normalized);
  if (!existing) return false;

  const idx = existing.findIndex(
    (r) => r.type === type && normalizeDomain(r.value) === normalizeDomain(value)
  );
  if (idx === -1) return false;

  existing.splice(idx, 1);
  if (existing.length === 0) {
    dnsStore.delete(normalized);
  }
  return true;
}

export function getDNSRecords(domain: string): DNSRecord[] {
  return dnsStore.get(normalizeDomain(domain)) || [];
}

export function verifyARecord(domain: string, expectedIp: string): DNSVerificationResult {
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

export function verifyCNAMERecord(
  domain: string,
  expectedTarget: string
): DNSVerificationResult {
  const records = getDNSRecords(domain);
  const matches = records.filter((r) =>
    matchesRecord(r, domain, "CNAME", expectedTarget)
  );

  return {
    verified: matches.length > 0,
    records: matches,
    message: matches.length > 0
      ? "CNAME record verified successfully"
      : `No matching CNAME record found for ${domain} pointing to ${expectedTarget}`,
  };
}

export function verifyTXTRecord(
  domain: string,
  expectedValue: string
): DNSVerificationResult {
  const records = getDNSRecords(domain);
  const matches = records.filter((r) =>
    matchesRecord(r, domain, "TXT", expectedValue)
  );

  return {
    verified: matches.length > 0,
    records: matches,
    message: matches.length > 0
      ? "TXT record verified successfully"
      : `No matching TXT record found for ${domain} with value ${expectedValue}`,
  };
}

export function verifyDomain(
  domain: string,
  verificationToken: string
): DNSVerificationResult {
  const txtResult = verifyTXTRecord(domain, `_mini-vercel-verify=${verificationToken}`);
  if (txtResult.verified) return txtResult;

  const cnameResult = verifyCNAMERecord(domain, "cname.mini-vercel.app");
  if (cnameResult.verified) return cnameResult;

  return {
    verified: false,
    records: [],
    message: `Domain ${domain} could not be verified. Add a TXT record with value _mini-vercel-verify=${verificationToken} or a CNAME record pointing to cname.mini-vercel.app`,
  };
}