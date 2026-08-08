import React from "react";
import { ListWidget, TextWidget } from "react-native-android-widget";
import {
  AgendaWidget,
  SHOW_AGENDA_ACTION,
  SHOW_HABITS_ACTION,
} from "../../widgets/AgendaWidget";
import type { AgendaWidgetItem } from "../../widgets/agendaWidgetData";

const { buildWidgetTree } =
  require("react-native-android-widget/lib/commonjs/api/build-widget-tree") as {
    buildWidgetTree: (element: React.ReactElement) => unknown;
  };

const item: AgendaWidgetItem = {
  key: "item-1",
  title: "Test item",
  state: "TODO",
  timeLabel: null,
  timestampLabel: null,
  category: null,
  priority: null,
  isOverdue: false,
  isHabit: false,
  completedToday: false,
  id: "item-1",
  file: null,
  pos: null,
};

function descendants(node: unknown): React.ReactElement<any>[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return [];
  const type = node.type as { __name__?: string } | ((props: any) => unknown);
  if (typeof type === "function" && !("__name__" in type)) {
    return descendants(type(node.props));
  }
  return [node, ...descendants(node.props.children)];
}

describe("AgendaWidget", () => {
  it("keeps the collection above the rounded bottom corners", () => {
    const elements = descendants(
      AgendaWidget({ items: [item], width: 320, height: 200 }),
    );
    const list = elements.find((element) => element.type === ListWidget);

    expect(list).toBeDefined();
    expect(list?.props.style).toMatchObject({
      width: "match_parent",
      height: 136,
    });
  });

  it("offers typed and voice capture from the header", () => {
    const elements = descendants(
      AgendaWidget({ items: [item], width: 320, height: 200 }),
    );
    const uris = elements
      .map((element) => element.props.clickActionData?.uri)
      .filter(Boolean);

    expect(uris).toEqual(
      expect.arrayContaining(["mova://capture", "mova://capture-voice"]),
    );
  });

  it("switches between task and habit tabs", () => {
    const elements = descendants(
      AgendaWidget({
        items: [item],
        habits: [{ ...item, key: "habit", title: "Stretch", isHabit: true }],
        width: 320,
        height: 200,
      }),
    );
    const actions = elements.map((element) => element.props.clickAction);

    expect(actions).toEqual(
      expect.arrayContaining([SHOW_AGENDA_ACTION, SHOW_HABITS_ACTION]),
    );
  });

  it("shows the selected habit collection", () => {
    const habit = { ...item, key: "habit", title: "Stretch", isHabit: true };
    const elements = descendants(
      AgendaWidget({
        items: [item],
        habits: [habit],
        view: "habits",
        width: 320,
        height: 200,
      }),
    );
    const list = elements.find((element) => element.type === ListWidget);
    const rows = React.Children.toArray(
      list?.props.children,
    ) as React.ReactElement<any>[];

    expect(rows).toHaveLength(1);
    expect(rows[0].props.items).toEqual([habit]);
  });

  it("shows the scheduled or deadline date and time", () => {
    const scheduled = {
      ...item,
      timestampLabel: "S 2026-08-08 09:15",
    };
    const elements = descendants(
      AgendaWidget({ items: [scheduled], width: 320, height: 200 }),
    );
    const text = elements
      .filter((element) => element.type === TextWidget)
      .map((element) => element.props.text);

    expect(text).toContain("S 2026-08-08 09:15");
  });

  it("uses two cards per collection row when sufficiently wide", () => {
    const items = [
      item,
      { ...item, key: "item-2", title: "Second" },
      { ...item, key: "item-3", title: "Third" },
    ];
    const wideElements = descendants(
      AgendaWidget({ items, width: 420, height: 200 }),
    );
    const narrowElements = descendants(
      AgendaWidget({ items, width: 419, height: 200 }),
    );
    const wideList = wideElements.find(
      (element) => element.type === ListWidget,
    );
    const narrowList = narrowElements.find(
      (element) => element.type === ListWidget,
    );
    const wideRows = React.Children.toArray(
      wideList?.props.children,
    ) as React.ReactElement<any>[];
    const narrowRows = React.Children.toArray(
      narrowList?.props.children,
    ) as React.ReactElement<any>[];

    expect(wideRows.map((row) => row.props.items)).toEqual([
      items.slice(0, 2),
      items.slice(2),
    ]);
    expect(narrowRows.map((row) => row.props.items)).toEqual(
      items.map((item) => [item]),
    );
  });

  it("builds a valid native widget tree for a wide habit view", () => {
    const habit = { ...item, key: "habit", title: "Stretch", isHabit: true };

    expect(() =>
      buildWidgetTree(
        AgendaWidget({
          items: [item],
          habits: [habit, { ...habit, key: "habit-2" }],
          view: "habits",
          width: 420,
          height: 200,
        }),
      ),
    ).not.toThrow();
  });
});
