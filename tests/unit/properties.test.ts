import { getEditableProperties } from "../../utils/properties";

describe("getEditableProperties", () => {
  it("excludes CATEGORY while preserving arbitrary properties", () => {
    expect(
      getEditableProperties({
        CATEGORY: "project",
        EFFORT: "2:00",
        OWNER: "Ivan",
      }),
    ).toEqual({
      EFFORT: "2:00",
      OWNER: "Ivan",
    });
  });

  it("treats the read-only property name case-insensitively", () => {
    expect(
      getEditableProperties({ category: "project", CUSTOM: "value" }),
    ).toEqual({
      CUSTOM: "value",
    });
  });

  it("returns an empty object for missing properties", () => {
    expect(getEditableProperties(null)).toEqual({});
    expect(getEditableProperties(undefined)).toEqual({});
  });
});
