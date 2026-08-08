import React from "react";
import { ListWidget } from "react-native-android-widget";
import { AgendaWidget } from "../../widgets/AgendaWidget";
import type { AgendaWidgetItem } from "../../widgets/agendaWidgetData";

const item: AgendaWidgetItem = {
  key: "item-1",
  title: "Test item",
  state: "TODO",
  timeLabel: null,
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
});
