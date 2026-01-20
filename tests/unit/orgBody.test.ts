import { Block, parseOrgBody, serializeBlocks } from "../../utils/orgBody";

describe("parseOrgBody", () => {
  it("should parse empty string to empty array", () => {
    expect(parseOrgBody("")).toEqual([]);
  });

  it("should parse plain paragraph", () => {
    const result = parseOrgBody("Some text here");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("paragraph");
    expect(result[0].content).toBe("Some text here");
    expect(result[0].indent).toBe(0);
  });

  it("should parse unchecked checklist item", () => {
    const result = parseOrgBody("- [ ] Buy milk");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("checklist");
    expect(result[0].checked).toBe(false);
    expect(result[0].content).toBe("Buy milk");
  });

  it("should parse checked checklist item", () => {
    const result = parseOrgBody("- [X] Done task");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("checklist");
    expect(result[0].checked).toBe(true);
    expect(result[0].content).toBe("Done task");
  });

  it("should parse lowercase x as checked", () => {
    const result = parseOrgBody("- [x] Done task");
    expect(result[0].checked).toBe(true);
  });

  it("should parse bullet item", () => {
    const result = parseOrgBody("- Item without checkbox");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("bullet");
    expect(result[0].content).toBe("Item without checkbox");
  });

  it("should parse numbered list item", () => {
    const result = parseOrgBody("1. First item");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("numbered");
    expect(result[0].content).toBe("First item");
  });

  it("should parse indented items", () => {
    const result = parseOrgBody("  - [ ] Indented item");
    expect(result[0].indent).toBe(1);
    expect(result[0].content).toBe("Indented item");
  });

  it("should parse multiple lines", () => {
    const input = `- [ ] Task 1
- [X] Task 2
Some notes`;
    const result = parseOrgBody(input);
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe("checklist");
    expect(result[1].type).toBe("checklist");
    expect(result[2].type).toBe("paragraph");
  });
});

describe("serializeBlocks", () => {
  it("should serialize empty array to empty string", () => {
    expect(serializeBlocks([])).toBe("");
  });

  it("should serialize paragraph", () => {
    const blocks: Block[] = [
      { id: "1", type: "paragraph", indent: 0, content: "Hello world" },
    ];
    expect(serializeBlocks(blocks)).toBe("Hello world");
  });

  it("should serialize unchecked checklist", () => {
    const blocks: Block[] = [
      {
        id: "1",
        type: "checklist",
        indent: 0,
        checked: false,
        content: "Task",
      },
    ];
    expect(serializeBlocks(blocks)).toBe("- [ ] Task");
  });

  it("should serialize checked checklist", () => {
    const blocks: Block[] = [
      { id: "1", type: "checklist", indent: 0, checked: true, content: "Done" },
    ];
    expect(serializeBlocks(blocks)).toBe("- [X] Done");
  });

  it("should serialize bullet", () => {
    const blocks: Block[] = [
      { id: "1", type: "bullet", indent: 0, content: "Item" },
    ];
    expect(serializeBlocks(blocks)).toBe("- Item");
  });

  it("should serialize numbered list", () => {
    const blocks: Block[] = [
      { id: "1", type: "numbered", indent: 0, content: "First" },
    ];
    expect(serializeBlocks(blocks)).toBe("1. First");
  });

  it("should serialize with indentation", () => {
    const blocks: Block[] = [
      {
        id: "1",
        type: "checklist",
        indent: 2,
        checked: false,
        content: "Nested",
      },
    ];
    expect(serializeBlocks(blocks)).toBe("    - [ ] Nested");
  });

  it("should round-trip parse and serialize", () => {
    const original = `- [ ] Task 1
- [X] Task 2
  - [ ] Subtask
Some notes`;
    const blocks = parseOrgBody(original);
    const serialized = serializeBlocks(blocks);
    expect(serialized).toBe(original);
  });
});
