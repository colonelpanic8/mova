import { extractLinks, parseLinks } from "@/utils/links";

describe("parseLinks", () => {
  it("returns plain text untouched", () => {
    expect(parseLinks("Buy milk")).toEqual([
      { type: "text", text: "Buy milk" },
    ]);
  });

  it("uses the description of org links", () => {
    expect(
      parseLinks("Read [[https://example.com/a][the article]] today"),
    ).toEqual([
      { type: "text", text: "Read " },
      { type: "link", text: "the article", url: "https://example.com/a" },
      { type: "text", text: " today" },
    ]);
  });

  it("shows the target of org links without a description", () => {
    expect(parseLinks("[[https://example.com]]")).toEqual([
      { type: "link", text: "https://example.com", url: "https://example.com" },
    ]);
  });

  it("renders non-web org links as plain text", () => {
    expect(parseLinks("See [[id:abc-123][notes]] and [[file:x.org]]")).toEqual([
      { type: "text", text: "See notes and file:x.org" },
    ]);
  });

  it("detects bare URLs without swallowing trailing punctuation", () => {
    expect(parseLinks("Go to https://example.com/path?q=1.")).toEqual([
      { type: "text", text: "Go to " },
      {
        type: "link",
        text: "https://example.com/path?q=1",
        url: "https://example.com/path?q=1",
      },
      { type: "text", text: "." },
    ]);
  });

  it("keeps balanced parentheses and strips wrapping ones", () => {
    expect(
      extractLinks(
        "(https://en.wikipedia.org/wiki/Foo_(bar)) and (https://a.com)",
      ).map((link) => link.url),
    ).toEqual(["https://en.wikipedia.org/wiki/Foo_(bar)", "https://a.com"]);
  });

  it("adds a scheme to www links", () => {
    expect(extractLinks("www.example.com")).toEqual([
      { type: "link", text: "www.example.com", url: "https://www.example.com" },
    ]);
  });
});
