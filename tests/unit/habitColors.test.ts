import { lerpColor, getHabitCellColor } from "@/utils/habitColors";

describe("habitColors", () => {
  describe("lerpColor", () => {
    it("returns first color when ratio is 0", () => {
      const result = lerpColor("#ff0000", "#00ff00", 0);
      expect(result).toBe("#ff0000");
    });

    it("returns second color when ratio is 1", () => {
      const result = lerpColor("#ff0000", "#00ff00", 1);
      expect(result).toBe("#00ff00");
    });

    it("returns midpoint color when ratio is 0.5", () => {
      const result = lerpColor("#000000", "#ffffff", 0.5);
      // Should be around #808080 (gray)
      expect(result.toLowerCase()).toBe("#808080");
    });

    it("handles lowercase hex colors", () => {
      const result = lerpColor("#aabbcc", "#ddeeff", 0);
      expect(result.toLowerCase()).toBe("#aabbcc");
    });
  });

  describe("getHabitCellColor", () => {
    const defaultColors = {
      conforming: "#4d7085",
      notConforming: "#d40d0d",
    };

    it("returns not-conforming color for ratio 0", () => {
      const result = getHabitCellColor(0, defaultColors);
      expect(result).toBe("#d40d0d");
    });

    it("returns conforming color for ratio 1", () => {
      const result = getHabitCellColor(1, defaultColors);
      expect(result).toBe("#4d7085");
    });

    it("clamps ratio above 1 to 1", () => {
      const result = getHabitCellColor(1.5, defaultColors);
      expect(result).toBe("#4d7085");
    });

    it("clamps ratio below 0 to 0", () => {
      const result = getHabitCellColor(-0.5, defaultColors);
      expect(result).toBe("#d40d0d");
    });
  });
});
