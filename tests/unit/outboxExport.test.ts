import { OutboxEntry } from "../../services/captureOutbox";
import {
  buildIssueUrl,
  formatOutboxEntryForExport,
  ISSUE_REPO,
} from "../../services/outboxExport";

const entry: OutboxEntry = {
  id: "entry-1",
  createdAt: "2026-08-17T12:00:00.000Z",
  retryCount: 4,
  lastError: "Network request failed",
  request: {
    kind: "capture",
    templateKey: "todo",
    values: { Title: "Buy milk", Tags: ["errands", "home"], Body: "" },
  },
};

describe("formatOutboxEntryForExport", () => {
  it("includes the title, populated fields, and failure context", () => {
    const text = formatOutboxEntryForExport(entry);

    expect(text).toContain("Buy milk");
    expect(text).toContain("Tags: errands, home");
    expect(text).toContain("Template: todo");
    expect(text).toContain("Attempts: 4");
    expect(text).toContain("Last error: Network request failed");
  });

  it("omits empty fields and the error line when there is none", () => {
    const text = formatOutboxEntryForExport({
      ...entry,
      lastError: null,
    });

    expect(text).not.toContain("Body:");
    expect(text).not.toContain("Last error");
  });

  it("describes category captures by type and category", () => {
    const text = formatOutboxEntryForExport({
      ...entry,
      request: {
        kind: "category-capture",
        categoryType: "project",
        category: "mova",
        values: { title: "Ship it" },
      },
    });

    expect(text).toContain("Category: project / mova");
  });
});

describe("buildIssueUrl", () => {
  it("targets the mova repo with an encoded title and body", () => {
    const url = buildIssueUrl(entry, { appVersion: "6.17.0" });

    expect(url.startsWith(`https://github.com/${ISSUE_REPO}/issues/new?`)).toBe(
      true,
    );

    const params = new URL(url).searchParams;
    expect(params.get("title")).toBe("Capture failed to sync: Buy milk");
    expect(params.get("body")).toContain("Buy milk");
    expect(params.get("body")).toContain("Last error: Network request failed");
    expect(params.get("body")).toContain("Mova version: 6.17.0");
  });

  it("omits the version line when it is unknown", () => {
    const params = new URL(buildIssueUrl(entry)).searchParams;
    expect(params.get("body")).not.toContain("Mova version");
  });
});
