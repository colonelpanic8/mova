export type BlockType = "paragraph" | "checklist" | "bullet" | "numbered";

export interface Block {
  id: string;
  type: BlockType;
  indent: number;
  checked?: boolean;
  content: string;
}

let idCounter = 0;

function generateId(): string {
  return `block-${Date.now()}-${idCounter++}`;
}

export function parseOrgBody(text: string): Block[] {
  if (!text || text.trim() === "") {
    return [];
  }

  const lines = text.split("\n");
  const blocks: Block[] = [];

  for (const line of lines) {
    // Count leading spaces for indentation (2 spaces = 1 indent level)
    const leadingSpaces = line.match(/^(\s*)/)?.[1].length || 0;
    const indent = Math.floor(leadingSpaces / 2);
    const trimmedLine = line.trimStart();

    // Checklist: - [ ] or - [X] or - [x]
    const checklistMatch = trimmedLine.match(/^- \[([ Xx])\] (.*)$/);
    if (checklistMatch) {
      blocks.push({
        id: generateId(),
        type: "checklist",
        indent,
        checked: checklistMatch[1].toLowerCase() === "x",
        content: checklistMatch[2],
      });
      continue;
    }

    // Bullet: - text (but not checkbox)
    const bulletMatch = trimmedLine.match(/^- (.+)$/);
    if (bulletMatch) {
      blocks.push({
        id: generateId(),
        type: "bullet",
        indent,
        content: bulletMatch[1],
      });
      continue;
    }

    // Numbered: 1. text, 2. text, etc.
    const numberedMatch = trimmedLine.match(/^\d+\. (.+)$/);
    if (numberedMatch) {
      blocks.push({
        id: generateId(),
        type: "numbered",
        indent,
        content: numberedMatch[1],
      });
      continue;
    }

    // Paragraph (anything else)
    blocks.push({
      id: generateId(),
      type: "paragraph",
      indent,
      content: trimmedLine,
    });
  }

  return blocks;
}

export function serializeBlocks(blocks: Block[]): string {
  if (blocks.length === 0) {
    return "";
  }

  let numberedCounter = 1;
  let lastType: BlockType | null = null;

  return blocks
    .map((block) => {
      const indentStr = "  ".repeat(block.indent);

      // Reset numbered counter when switching away from numbered
      if (block.type !== "numbered" && lastType === "numbered") {
        numberedCounter = 1;
      }
      lastType = block.type;

      switch (block.type) {
        case "checklist":
          return `${indentStr}- [${block.checked ? "X" : " "}] ${block.content}`;
        case "bullet":
          return `${indentStr}- ${block.content}`;
        case "numbered":
          return `${indentStr}${numberedCounter++}. ${block.content}`;
        case "paragraph":
        default:
          return `${indentStr}${block.content}`;
      }
    })
    .join("\n");
}
