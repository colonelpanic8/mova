import { parseDeepLink } from "../../utils/deepLinks";

describe("parseDeepLink", () => {
  it("extracts every query parameter and keeps the first repeated value", () => {
    expect(
      parseDeepLink(
        "mova://search?q=first&q=second&future=value&title=Buy+milk",
      ),
    ).toEqual({
      action: "search",
      params: { q: "first", future: "value", title: "Buy milk" },
    });
  });

  it("uses either the host or path as the action, preferring the path", () => {
    expect(parseDeepLink("mova://agenda?span=week")?.action).toBe("agenda");
    expect(parseDeepLink("mova://ignored/open?id=todo-1")?.action).toBe("open");
  });

  it("decodes percent-encoded values and tolerates empty values", () => {
    expect(
      parseDeepLink(
        "mova://reschedule?file=%2Fdata%2Forg%2Fgtd.org&pos=12&scheduled=2026-09-20T10%3A00%20%2B1w&deadline=",
      ),
    ).toEqual({
      action: "reschedule",
      params: {
        file: "/data/org/gtd.org",
        pos: "12",
        scheduled: "2026-09-20T10:00 +1w",
        deadline: "",
      },
    });
  });

  it("returns null for something that is not a link", () => {
    expect(parseDeepLink("not a link")).toBeNull();
  });
});
