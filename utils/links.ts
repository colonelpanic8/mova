export type TextSegment =
  { type: "text"; text: string } | { type: "link"; text: string; url: string };

const OPENABLE_SCHEME = /^(https?|mailto|tel):/i;
const ORG_LINK = String.raw`\[\[([^\]]+)\](?:\[([^\]]+)\])?\]`;
const BARE_URL = String.raw`(?:https?:\/\/|www\.)[^\s<>"'\]\[]+`;
const LINK_PATTERN = new RegExp(`${ORG_LINK}|${BARE_URL}`, "gi");
const TRAILING_PUNCTUATION = /[.,;:!?'")]+$/;

function toOpenableUrl(target: string): string | null {
  const trimmed = target.trim();
  if (OPENABLE_SCHEME.test(trimmed)) {
    return trimmed;
  }
  if (/^www\./i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return null;
}

function trimBareUrl(match: string): string {
  let url = match.replace(TRAILING_PUNCTUATION, "");
  // Keep a closing paren that balances one inside the URL (e.g. wiki links).
  if (match.length > url.length && match[url.length] === ")") {
    const opens = (url.match(/\(/g) ?? []).length;
    const closes = (url.match(/\)/g) ?? []).length;
    if (opens > closes) {
      url += ")";
    }
  }
  return url;
}

export function parseLinks(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;

  const pushText = (value: string) => {
    if (!value) return;
    const previous = segments[segments.length - 1];
    if (previous?.type === "text") {
      previous.text += value;
    } else {
      segments.push({ type: "text", text: value });
    }
  };

  for (const match of text.matchAll(LINK_PATTERN)) {
    const index = match.index ?? 0;
    pushText(text.slice(lastIndex, index));

    const [whole, orgTarget, orgDescription] = match;
    if (orgTarget !== undefined) {
      const label = orgDescription ?? orgTarget;
      const url = toOpenableUrl(orgTarget);
      if (url) {
        segments.push({ type: "link", text: label, url });
      } else {
        pushText(label);
      }
      lastIndex = index + whole.length;
      continue;
    }

    const bare = trimBareUrl(whole);
    segments.push({ type: "link", text: bare, url: toOpenableUrl(bare)! });
    lastIndex = index + bare.length;
  }

  pushText(text.slice(lastIndex));
  return segments;
}

export function extractLinks(text: string): { text: string; url: string }[] {
  return parseLinks(text).filter(
    (segment): segment is Extract<TextSegment, { type: "link" }> =>
      segment.type === "link",
  );
}
