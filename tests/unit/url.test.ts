import { normalizeUrl } from "../../utils/url";

describe("normalizeUrl", () => {
  it("adds https to bare hostnames", () => {
    expect(normalizeUrl("org-agenda-api.duckdns.org")).toBe(
      "https://org-agenda-api.duckdns.org",
    );
  });

  it("preserves explicit schemes", () => {
    expect(normalizeUrl("http://localhost:8080/")).toBe(
      "http://localhost:8080",
    );
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com");
  });

  it("trims whitespace and trailing slashes", () => {
    expect(normalizeUrl("  org-agenda-api.duckdns.org///  ")).toBe(
      "https://org-agenda-api.duckdns.org",
    );
  });
});
