function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function getDomainFromEmailOrDomain(input: string | null | undefined): string | null {
  const normalized = normalize(input);
  if (!normalized) {
    return null;
  }

  if (!normalized.includes("@")) {
    return normalized;
  }

  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= -1 || atIndex === normalized.length - 1) {
    return null;
  }

  return normalized.slice(atIndex + 1);
}

export function isVcomEligibleEmailOrDomain(input: string | null | undefined): boolean {
  const domain = getDomainFromEmailOrDomain(input);
  if (!domain) {
    return false;
  }
  return domain === "vcom.edu" || domain.endsWith(".vcom.edu");
}
