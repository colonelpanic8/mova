const READ_ONLY_PROPERTIES = new Set(["CATEGORY"]);

export function getEditableProperties(
  properties: Record<string, string> | null | undefined,
): Record<string, string> {
  if (!properties) return {};

  return Object.fromEntries(
    Object.entries(properties).filter(
      ([key]) => !READ_ONLY_PROPERTIES.has(key.toUpperCase()),
    ),
  );
}
