import {
  getOutboxEntryTitle,
  type OutboxEntry,
} from "@/services/captureOutbox";

/** Repository that "Report on GitHub" files against. */
export const ISSUE_REPO = "colonelpanic8/mova";

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Human-readable rendering of a queued capture, including why it has not
 * delivered. Used both for the share sheet and the prefilled issue body so a
 * capture that cannot reach the server is never trapped on the device.
 */
export function formatOutboxEntryForExport(entry: OutboxEntry): string {
  const lines: string[] = [getOutboxEntryTitle(entry)];

  const fields = Object.entries(entry.request.values).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );
  if (fields.length > 0) {
    lines.push("");
    for (const [key, value] of fields) {
      lines.push(`${key}: ${formatValue(value)}`);
    }
  }

  lines.push("");
  lines.push(
    entry.request.kind === "capture"
      ? `Template: ${entry.request.templateKey}`
      : `Category: ${entry.request.categoryType} / ${entry.request.category}`,
  );
  lines.push(`Queued: ${entry.createdAt}`);
  lines.push(`Attempts: ${entry.retryCount}`);
  if (entry.lastError) {
    lines.push(`Last error: ${entry.lastError}`);
  }

  return lines.join("\n");
}

/**
 * Prefilled GitHub "new issue" URL. GitHub renders the form with these values
 * and uses the browser's own session, so the app never handles credentials.
 */
export function buildIssueUrl(
  entry: OutboxEntry,
  options: { appVersion?: string } = {},
): string {
  const title = `Capture failed to sync: ${getOutboxEntryTitle(entry)}`;
  const bodyParts = [
    "This capture could not be delivered from Mova.",
    "",
    "```",
    formatOutboxEntryForExport(entry),
    "```",
  ];
  if (options.appVersion) {
    bodyParts.push("", `Mova version: ${options.appVersion}`);
  }

  const params = new URLSearchParams({
    title,
    body: bodyParts.join("\n"),
  });
  return `https://github.com/${ISSUE_REPO}/issues/new?${params.toString()}`;
}
