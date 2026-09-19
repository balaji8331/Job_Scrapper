export function stripHtml(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/[\s,/|]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function normalizeCompanyTitle(company: string, title: string): string {
  return `${company.trim().toLowerCase()}::${title.trim().toLowerCase()}`;
}

export function isRemoteText(value: string): boolean {
  return /\bremote\b|\bwfh\b|work from home|work from anywhere/i.test(value);
}
