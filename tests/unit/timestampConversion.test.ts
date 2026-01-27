import {
  dateToTimestamp,
  formStringToTimestamp,
  parseFormString,
  timestampToDate,
  timestampToFormString,
} from "../../utils/timestampConversion";

describe("timestampConversion", () => {
  describe("parseFormString", () => {
    it("returns empty parts for undefined", () => {
      expect(parseFormString(undefined)).toEqual({ datePart: "", timePart: "" });
    });

    it("returns empty parts for empty string", () => {
      expect(parseFormString("")).toEqual({ datePart: "", timePart: "" });
    });

    it("parses date-only string", () => {
      expect(parseFormString("2026-01-27")).toEqual({
        datePart: "2026-01-27",
        timePart: "",
      });
    });

    it("parses date with T separator", () => {
      expect(parseFormString("2026-01-27T14:30")).toEqual({
        datePart: "2026-01-27",
        timePart: "14:30",
      });
    });

    it("parses date with space separator", () => {
      expect(parseFormString("2026-01-27 14:30")).toEqual({
        datePart: "2026-01-27",
        timePart: "14:30",
      });
    });

    it("handles trailing space with no time", () => {
      expect(parseFormString("2026-01-27 ")).toEqual({
        datePart: "2026-01-27",
        timePart: "",
      });
    });

    it("handles invalid time format", () => {
      expect(parseFormString("2026-01-27 invalid")).toEqual({
        datePart: "2026-01-27",
        timePart: "",
      });
    });
  });

  describe("timestampToFormString", () => {
    it("returns empty string for null", () => {
      expect(timestampToFormString(null)).toBe("");
    });

    it("returns date only when no time", () => {
      expect(timestampToFormString({ date: "2026-01-27" })).toBe("2026-01-27");
    });

    it("returns date with T separator when time exists", () => {
      expect(timestampToFormString({ date: "2026-01-27", time: "14:30" })).toBe(
        "2026-01-27T14:30",
      );
    });
  });

  describe("formStringToTimestamp", () => {
    it("returns null for empty string", () => {
      expect(formStringToTimestamp("", null)).toBeNull();
    });

    it("parses date-only string", () => {
      expect(formStringToTimestamp("2026-01-27", null)).toEqual({
        date: "2026-01-27",
      });
    });

    it("parses date with T separator", () => {
      expect(formStringToTimestamp("2026-01-27T14:30", null)).toEqual({
        date: "2026-01-27",
        time: "14:30",
      });
    });

    it("parses date with space separator (web input format)", () => {
      expect(formStringToTimestamp("2026-01-27 14:30", null)).toEqual({
        date: "2026-01-27",
        time: "14:30",
      });
    });

    it("includes repeater when provided", () => {
      const repeater = { type: "+" as const, value: 1, unit: "d" as const };
      expect(formStringToTimestamp("2026-01-27T14:30", repeater)).toEqual({
        date: "2026-01-27",
        time: "14:30",
        repeater,
      });
    });

    it("handles date string with trailing space (no time)", () => {
      // Edge case: date with space but no valid time after
      expect(formStringToTimestamp("2026-01-27 ", null)).toEqual({
        date: "2026-01-27",
      });
    });
  });

  describe("dateToTimestamp", () => {
    it("creates timestamp with date only when includeTime is false", () => {
      const date = new Date("2026-01-27T14:30:00");
      const result = dateToTimestamp(date, false);
      expect(result).toEqual({ date: "2026-01-27" });
      expect(result.time).toBeUndefined();
    });

    it("creates timestamp with date and time when includeTime is true", () => {
      const date = new Date("2026-01-27T14:30:00");
      const result = dateToTimestamp(date, true);
      expect(result.date).toBe("2026-01-27");
      expect(result.time).toBe("14:30");
    });
  });

  describe("timestampToDate", () => {
    it("returns null for null input", () => {
      expect(timestampToDate(null)).toBeNull();
    });

    it("converts timestamp with time to Date", () => {
      const ts = { date: "2026-01-27", time: "14:30" };
      const result = timestampToDate(ts);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2026);
      expect(result?.getMonth()).toBe(0); // January
      expect(result?.getDate()).toBe(27);
      expect(result?.getHours()).toBe(14);
      expect(result?.getMinutes()).toBe(30);
    });

    it("converts timestamp without time to Date at midnight", () => {
      const ts = { date: "2026-01-27" };
      const result = timestampToDate(ts);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getHours()).toBe(0);
      expect(result?.getMinutes()).toBe(0);
    });
  });

  describe("roundtrip conversions", () => {
    it("preserves time through form string roundtrip with T separator", () => {
      const original = { date: "2026-01-27", time: "14:30" };
      const formString = timestampToFormString(original);
      const restored = formStringToTimestamp(formString, null);
      expect(restored).toEqual(original);
    });

    it("preserves time through form string roundtrip with space separator", () => {
      // Simulates web input path: space separator should work
      const webInput = "2026-01-27 14:30";
      const timestamp = formStringToTimestamp(webInput, null);
      expect(timestamp).toEqual({ date: "2026-01-27", time: "14:30" });
    });
  });
});
