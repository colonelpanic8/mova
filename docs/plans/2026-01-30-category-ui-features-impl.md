# Category UI Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add category grouping toggle and category colors to the agenda screen.

**Architecture:** Two independent features sharing category color infrastructure. Grouping transforms flat agenda items into category-grouped sections with collapsible headers. Colors use hash-based auto-assignment with user override stored in ColorPaletteConfig.

**Tech Stack:** React Native, AsyncStorage, existing SettingsContext and ColorPaletteContext patterns.

---

## Task 1: Create Category Colors Utility

**Files:**
- Create: `utils/categoryColors.ts`

**Step 1: Create the utility file**

```typescript
// utils/categoryColors.ts

export const CATEGORY_COLOR_PALETTE = [
  "#4A90D9", // blue
  "#50C878", // green
  "#E57373", // red
  "#FFB74D", // orange
  "#9575CD", // purple
  "#4DB6AC", // teal
  "#F06292", // pink
  "#7986CB", // indigo
  "#AED581", // light green
  "#FFD54F", // amber
];

export function getAutoColorForCategory(category: string): string {
  const hash = category
    .toLowerCase()
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return CATEGORY_COLOR_PALETTE[hash % CATEGORY_COLOR_PALETTE.length];
}
```

**Step 2: Verify file was created correctly**

Run: `cat utils/categoryColors.ts`

**Step 3: Commit**

```bash
git add utils/categoryColors.ts
git commit -m "feat: add category color palette and auto-assignment utility"
```

---

## Task 2: Update ColorPaletteConfig Type

**Files:**
- Modify: `types/colors.ts`

**Step 1: Add categoryColors field to ColorPaletteConfig interface**

Find the `ColorPaletteConfig` interface and add `categoryColors` field:

```typescript
export interface ColorPaletteConfig {
  // ... existing fields (completedOpacity, habitColors, etc.)
  categoryColors: Record<string, ColorValue>;
}
```

**Step 2: Verify the change**

Run: `grep -A 20 "interface ColorPaletteConfig" types/colors.ts`

**Step 3: Commit**

```bash
git add types/colors.ts
git commit -m "feat: add categoryColors to ColorPaletteConfig type"
```

---

## Task 3: Update ColorPaletteContext for Category Colors

**Files:**
- Modify: `context/ColorPaletteContext.tsx`

**Step 1: Add categoryColors to DEFAULT_CONFIG**

Find `DEFAULT_CONFIG` and add:

```typescript
categoryColors: {},
```

**Step 2: Add getCategoryColor helper function**

Add this function inside the provider or as a utility:

```typescript
const getCategoryColor = useCallback(
  (category: string): string => {
    const override = config.categoryColors[category];
    if (override) {
      return resolveColor(override);
    }
    return getAutoColorForCategory(category);
  },
  [config.categoryColors, resolveColor]
);
```

**Step 3: Add import for getAutoColorForCategory**

```typescript
import { getAutoColorForCategory } from "../utils/categoryColors";
```

**Step 4: Expose getCategoryColor in context value**

Add `getCategoryColor` to the context value object.

**Step 5: Update ColorPaletteContextType interface**

Add to the interface:

```typescript
getCategoryColor: (category: string) => string;
```

**Step 6: Verify changes compile**

Run: `yarn typecheck`

**Step 7: Commit**

```bash
git add context/ColorPaletteContext.tsx
git commit -m "feat: add getCategoryColor to ColorPaletteContext"
```

---

## Task 4: Add groupByCategory Setting

**Files:**
- Modify: `services/settings.ts`
- Modify: `context/SettingsContext.tsx`

**Step 1: Add storage key and functions to settings.ts**

Add near other setting constants:

```typescript
const GROUP_BY_CATEGORY_KEY = "mova_group_by_category";

export async function getGroupByCategory(): Promise<boolean> {
  const value = await AsyncStorage.getItem(GROUP_BY_CATEGORY_KEY);
  return value === "true";
}

export async function setGroupByCategory(value: boolean): Promise<void> {
  await AsyncStorage.setItem(GROUP_BY_CATEGORY_KEY, value.toString());
}
```

**Step 2: Update SettingsContext.tsx - add state**

Add to state declarations:

```typescript
const [groupByCategory, setGroupByCategoryState] = useState(false);
```

**Step 3: Update SettingsContext.tsx - load setting**

Add to loadSettings or useEffect:

```typescript
const groupByCategoryValue = await getGroupByCategory();
setGroupByCategoryState(groupByCategoryValue);
```

**Step 4: Update SettingsContext.tsx - add setter**

```typescript
const handleSetGroupByCategory = useCallback(async (value: boolean) => {
  setGroupByCategoryState(value);
  await setGroupByCategory(value);
}, []);
```

**Step 5: Update SettingsContext.tsx - expose in context value**

Add to context value:

```typescript
groupByCategory,
setGroupByCategory: handleSetGroupByCategory,
```

**Step 6: Update SettingsContextType interface**

Add to the interface:

```typescript
groupByCategory: boolean;
setGroupByCategory: (value: boolean) => Promise<void>;
```

**Step 7: Verify changes compile**

Run: `yarn typecheck`

**Step 8: Commit**

```bash
git add services/settings.ts context/SettingsContext.tsx
git commit -m "feat: add groupByCategory setting to SettingsContext"
```

---

## Task 5: Add Category Colors Section to Colors Settings

**Files:**
- Modify: `app/(tabs)/settings/colors.tsx`

**Step 1: Import FilterContext for categories list**

```typescript
import { useFilter } from "../../../context/FilterContext";
```

**Step 2: Get categories from FilterContext**

Add inside the component:

```typescript
const { filterOptions } = useFilter();
const categories = filterOptions?.categories ?? [];
```

**Step 3: Import getAutoColorForCategory**

```typescript
import { getAutoColorForCategory } from "../../../utils/categoryColors";
```

**Step 4: Add Category Colors section**

Add a new section after existing color settings (before the closing of the ScrollView):

```typescript
{categories.length > 0 && (
  <>
    <Text style={styles.sectionHeader}>Category Colors</Text>
    {categories.map((category) => {
      const currentColor =
        config.categoryColors[category] ??
        getAutoColorForCategory(category);
      return (
        <TouchableOpacity
          key={category}
          style={styles.colorRow}
          onPress={() => {
            setEditingColor({
              key: `category:${category}`,
              label: category,
              currentValue: config.categoryColors[category] ?? null,
            });
          }}
        >
          <View style={styles.colorRowLeft}>
            <View
              style={[
                styles.colorPreview,
                {
                  backgroundColor:
                    typeof currentColor === "string"
                      ? currentColor
                      : resolveColor(currentColor),
                },
              ]}
            />
            <Text style={styles.colorLabel}>{category}</Text>
          </View>
          <Text style={styles.colorValue}>
            {config.categoryColors[category] ? "Custom" : "Auto"}
          </Text>
        </TouchableOpacity>
      );
    })}
  </>
)}
```

**Step 5: Update color picker save handler**

In the color picker save handler, check if the key starts with `category:` and handle accordingly:

```typescript
if (editingColor.key.startsWith("category:")) {
  const categoryName = editingColor.key.slice("category:".length);
  setConfig({
    ...config,
    categoryColors: {
      ...config.categoryColors,
      [categoryName]: selectedColor,
    },
  });
}
```

**Step 6: Verify changes compile**

Run: `yarn typecheck`

**Step 7: Commit**

```bash
git add app/\(tabs\)/settings/colors.tsx
git commit -m "feat: add Category Colors section to colors settings"
```

---

## Task 6: Add Group by Category Toggle to Settings

**Files:**
- Modify: `app/(tabs)/settings/index.tsx`

**Step 1: Import groupByCategory from SettingsContext**

Update the useSettings destructuring:

```typescript
const { groupByCategory, setGroupByCategory, /* ...existing */ } = useSettings();
```

**Step 2: Add toggle in Display section**

Find the Display section and add a toggle row:

```typescript
<View style={styles.settingRow}>
  <Text style={styles.settingLabel}>Group by Category</Text>
  <Switch
    value={groupByCategory}
    onValueChange={setGroupByCategory}
    trackColor={{ false: "#767577", true: colors.primary }}
    thumbColor={groupByCategory ? colors.accent : "#f4f3f4"}
  />
</View>
```

**Step 3: Verify changes compile**

Run: `yarn typecheck`

**Step 4: Commit**

```bash
git add app/\(tabs\)/settings/index.tsx
git commit -m "feat: add Group by Category toggle to settings"
```

---

## Task 7: Implement Category Grouping in Agenda

**Files:**
- Modify: `app/(tabs)/index.tsx`

**Step 1: Import groupByCategory from SettingsContext**

```typescript
const { groupByCategory, /* ...existing */ } = useSettings();
```

**Step 2: Import getCategoryColor from ColorPaletteContext**

```typescript
const { getCategoryColor, /* ...existing */ } = useColorPalette();
```

**Step 3: Add collapsed state for category headers**

```typescript
const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
  new Set()
);
```

**Step 4: Create toggle function for collapsing**

```typescript
const toggleCategoryCollapse = useCallback((categoryKey: string) => {
  setCollapsedCategories((prev) => {
    const next = new Set(prev);
    if (next.has(categoryKey)) {
      next.delete(categoryKey);
    } else {
      next.add(categoryKey);
    }
    return next;
  });
}, []);
```

**Step 5: Create function to group items by category**

```typescript
const groupItemsByCategory = useCallback(
  (items: AgendaItem[]): (AgendaItem | CategoryHeader)[] => {
    if (!groupByCategory) return items;

    const categoryMap = new Map<string, AgendaItem[]>();
    items.forEach((item) => {
      const category = item.category || "Uncategorized";
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(item);
    });

    const result: (AgendaItem | CategoryHeader)[] = [];
    Array.from(categoryMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([category, categoryItems]) => {
        result.push({
          type: "category-header",
          category,
          count: categoryItems.length,
          color: getCategoryColor(category),
        });
        const categoryKey = `category:${category}`;
        if (!collapsedCategories.has(categoryKey)) {
          result.push(...categoryItems);
        }
      });

    return result;
  },
  [groupByCategory, getCategoryColor, collapsedCategories]
);
```

**Step 6: Add CategoryHeader type**

Add at top of file or in types:

```typescript
interface CategoryHeader {
  type: "category-header";
  category: string;
  count: number;
  color: string;
}
```

**Step 7: Update section data transformation**

Wrap existing items with groupItemsByCategory:

```typescript
const activeItems = groupItemsByCategory(/* existing active items */);
const completedItems = groupItemsByCategory(/* existing completed items */);
```

**Step 8: Update renderItem to handle category headers**

```typescript
const renderItem = ({ item }: { item: AgendaItem | CategoryHeader }) => {
  if ("type" in item && item.type === "category-header") {
    const isCollapsed = collapsedCategories.has(`category:${item.category}`);
    return (
      <TouchableOpacity
        style={[styles.categoryHeader, { borderLeftColor: item.color }]}
        onPress={() => toggleCategoryCollapse(`category:${item.category}`)}
      >
        <View style={styles.categoryHeaderLeft}>
          <MaterialIcons
            name={isCollapsed ? "chevron-right" : "expand-more"}
            size={24}
            color={colors.text}
          />
          <Text style={styles.categoryHeaderText}>{item.category}</Text>
        </View>
        <Text style={styles.categoryHeaderCount}>{item.count}</Text>
      </TouchableOpacity>
    );
  }
  // ... existing item rendering
};
```

**Step 9: Add styles for category header**

```typescript
categoryHeader: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingVertical: 8,
  paddingHorizontal: 16,
  borderLeftWidth: 4,
  backgroundColor: colors.surface,
},
categoryHeaderLeft: {
  flexDirection: "row",
  alignItems: "center",
},
categoryHeaderText: {
  fontSize: 14,
  fontWeight: "600",
  color: colors.text,
  marginLeft: 4,
},
categoryHeaderCount: {
  fontSize: 12,
  color: colors.textSecondary,
},
```

**Step 10: Update keyExtractor to handle category headers**

```typescript
keyExtractor={(item) =>
  "type" in item && item.type === "category-header"
    ? `header-${item.category}`
    : item.id
}
```

**Step 11: Verify changes compile**

Run: `yarn typecheck`

**Step 12: Test manually**

- Enable "Group by Category" in settings
- Verify categories appear as collapsible headers
- Verify tapping headers collapses/expands items
- Verify category colors appear as left border

**Step 13: Commit**

```bash
git add app/\(tabs\)/index.tsx
git commit -m "feat: implement category grouping with collapsible headers in agenda"
```

---

## Task 8: Final Validation and Release

**Step 1: Run full validation**

```bash
yarn validate
```

**Step 2: Fix any issues**

If prettier fails:
```bash
yarn prettier:fix
```

**Step 3: Bump version (minor)**

Edit package.json version from 5.16.4 to 5.17.0

**Step 4: Commit version bump**

```bash
git add package.json
git commit -m "chore: bump version to 5.17.0"
```

**Step 5: Create tag**

```bash
git tag v5.17.0
```

**Step 6: Push**

```bash
git push && git push --tags
```
