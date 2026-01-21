# Category Capture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add support for org-category-capture and org-project-capture, allowing users to capture todos to specific categories (like projects) through a combo input field.

**Architecture:** Extend the existing capture flow with category types that appear in the template menu. When selected, fetch available categories and display a combo input (dropdown + text input) for category selection before the standard prompts.

**Tech Stack:** React Native, TypeScript, React Native Paper (Menu, TextInput, Chip), Expo

---

## Task 1: Add API Types for Category Capture

**Files:**

- Modify: `services/api.ts:66-131` (types section)

**Step 1: Add the new interface types**

Add after `CaptureResponse` interface (around line 86):

```typescript
export interface CategoryType {
  name: string;
  hasCategories: boolean;
  captureTemplate: string;
  prompts: TemplatePrompt[];
}

export interface CategoryTypesResponse {
  types: CategoryType[];
}

export interface CategoriesResponse {
  type: string;
  categories: string[];
  todoFiles: string[];
}

export interface CategoryCaptureResponse {
  status: string;
  category?: string;
  title?: string;
  file?: string;
  pos?: number;
  message?: string;
}
```

**Step 2: Commit**

```bash
git add services/api.ts
git commit -m "feat(api): add category capture types"
```

---

## Task 2: Add API Methods for Category Capture

**Files:**

- Modify: `services/api.ts` (OrgAgendaApi class)
- Test: `tests/unit/api.test.ts`

**Step 1: Write failing tests for new API methods**

Add to `tests/unit/api.test.ts`:

```typescript
describe("getCategoryTypes", () => {
  it("should make GET request to /category-types", async () => {
    const mockResponse = {
      types: [
        {
          name: "projects",
          hasCategories: true,
          captureTemplate: "* TODO %?\n",
          prompts: [{ name: "Title", type: "string", required: true }],
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
    });

    const result = await api.getCategoryTypes();

    expect(global.fetch).toHaveBeenCalledWith(
      "http://test-api.local/category-types",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining("Basic"),
        }),
      }),
    );
    expect(result.types).toHaveLength(1);
    expect(result.types[0].name).toBe("projects");
  });
});

describe("getCategories", () => {
  it("should make GET request to /categories with type parameter", async () => {
    const mockResponse = {
      type: "projects",
      categories: ["alpha", "beta"],
      todoFiles: ["/path/to/projects.org"],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
    });

    const result = await api.getCategories("projects");

    expect(global.fetch).toHaveBeenCalledWith(
      "http://test-api.local/categories?type=projects",
      expect.any(Object),
    );
    expect(result.categories).toEqual(["alpha", "beta"]);
  });
});

describe("categoryCapture", () => {
  it("should make POST request to /category-capture", async () => {
    const mockResponse = {
      status: "created",
      category: "alpha",
      title: "New task",
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
    });

    const result = await api.categoryCapture("projects", "alpha", {
      title: "New task",
      todo: "TODO",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://test-api.local/category-capture",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          type: "projects",
          category: "alpha",
          title: "New task",
          todo: "TODO",
        }),
      }),
    );
    expect(result.status).toBe("created");
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm test -- tests/unit/api.test.ts --testNamePattern="getCategoryTypes|getCategories|categoryCapture"
```

Expected: FAIL - methods don't exist

**Step 3: Implement the API methods**

Add to `services/api.ts` in the `OrgAgendaApi` class (after `getMetadata` method):

```typescript
async getCategoryTypes(): Promise<CategoryTypesResponse> {
  return this.request<CategoryTypesResponse>("/category-types");
}

async getCategories(type: string): Promise<CategoriesResponse> {
  return this.request<CategoriesResponse>(
    `/categories?type=${encodeURIComponent(type)}`,
  );
}

async categoryCapture(
  type: string,
  category: string,
  values: Record<string, string | string[]>,
): Promise<CategoryCaptureResponse> {
  const { title, ...rest } = values;
  return this.request<CategoryCaptureResponse>("/category-capture", {
    method: "POST",
    body: JSON.stringify({
      type,
      category,
      title,
      ...rest,
    }),
  });
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test -- tests/unit/api.test.ts --testNamePattern="getCategoryTypes|getCategories|categoryCapture"
```

Expected: PASS

**Step 5: Commit**

```bash
git add services/api.ts tests/unit/api.test.ts
git commit -m "feat(api): add category capture methods

- getCategoryTypes() fetches available category strategy types
- getCategories(type) fetches categories for a strategy
- categoryCapture() creates entry in a category"
```

---

## Task 3: Add Category Types to TemplatesContext

**Files:**

- Modify: `context/TemplatesContext.tsx`

**Step 1: Add categoryTypes to context type**

Update the `TemplatesContextType` interface:

```typescript
interface TemplatesContextType {
  templates: TemplatesResponse | null;
  categoryTypes: CategoryType[] | null; // Add this
  filterOptions: FilterOptionsResponse | null;
  todoStates: TodoStatesResponse | null;
  customViews: CustomViewsResponse | null;
  isLoading: boolean;
  error: string | null;
  reloadTemplates: () => Promise<void>;
}
```

**Step 2: Add state and import**

Update imports:

```typescript
import {
  api,
  CategoryType,
  CustomViewsResponse,
  FilterOptionsResponse,
  MetadataResponse,
  TemplatesResponse,
  TodoStatesResponse,
} from "@/services/api";
```

Add state in provider:

```typescript
const [categoryTypes, setCategoryTypes] = useState<CategoryType[] | null>(null);
```

**Step 3: Fetch category types in reloadTemplates**

After the metadata fetch block, add:

```typescript
// Fetch category types separately (not part of /metadata)
try {
  const categoryTypesResponse = await api.getCategoryTypes();
  setCategoryTypes(categoryTypesResponse.types);
} catch (categoryErr) {
  console.warn("Failed to fetch category types:", categoryErr);
  setCategoryTypes([]);
}
```

**Step 4: Update provider value and cleanup**

Update the provider value:

```typescript
<TemplatesContext.Provider
  value={{ templates, categoryTypes, filterOptions, todoStates, customViews, isLoading, error, reloadTemplates }}
>
```

Add to the logout cleanup:

```typescript
setCategoryTypes(null);
```

**Step 5: Commit**

```bash
git add context/TemplatesContext.tsx
git commit -m "feat(context): add categoryTypes to TemplatesContext

Fetches category types from /category-types endpoint alongside
templates. Exposes categoryTypes in context for capture screen."
```

---

## Task 4: Create CategoryField Component

**Files:**

- Create: `components/capture/CategoryField.tsx`

**Step 1: Create the component file**

```typescript
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Chip, Menu, Text, TextInput } from "react-native-paper";

interface CategoryFieldProps {
  categories: string[];
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
}

export function CategoryField({
  categories,
  value,
  onChange,
  loading = false,
}: CategoryFieldProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const filteredCategories = useMemo(() => {
    if (!value.trim()) return categories;
    const lowerValue = value.toLowerCase();
    return categories.filter((cat) =>
      cat.toLowerCase().includes(lowerValue)
    );
  }, [categories, value]);

  const isNewCategory = useMemo(() => {
    if (!value.trim()) return false;
    return !categories.some(
      (cat) => cat.toLowerCase() === value.toLowerCase()
    );
  }, [categories, value]);

  const handleSelectCategory = useCallback(
    (category: string) => {
      onChange(category);
      setMenuVisible(false);
    },
    [onChange]
  );

  const handleInputFocus = useCallback(() => {
    setInputFocused(true);
    setMenuVisible(true);
  }, []);

  const handleInputBlur = useCallback(() => {
    setInputFocused(false);
    // Delay hiding menu to allow click on menu item
    setTimeout(() => {
      if (!inputFocused) {
        setMenuVisible(false);
      }
    }, 200);
  }, [inputFocused]);

  const showMenu = menuVisible && (filteredCategories.length > 0 || isNewCategory);

  return (
    <View style={styles.container}>
      <Text variant="bodySmall" style={styles.label}>
        Category *
      </Text>
      <Menu
        visible={showMenu}
        onDismiss={() => setMenuVisible(false)}
        anchor={
          <TextInput
            mode="outlined"
            placeholder={loading ? "Loading categories..." : "Select or type category"}
            value={value}
            onChangeText={onChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            right={
              <TextInput.Icon
                icon={menuVisible ? "chevron-up" : "chevron-down"}
                onPress={() => setMenuVisible(!menuVisible)}
              />
            }
            disabled={loading}
          />
        }
        anchorPosition="bottom"
        style={styles.menu}
      >
        {filteredCategories.map((category) => (
          <Menu.Item
            key={category}
            onPress={() => handleSelectCategory(category)}
            title={category}
            leadingIcon={
              value.toLowerCase() === category.toLowerCase()
                ? "check"
                : undefined
            }
          />
        ))}
        {isNewCategory && (
          <>
            {filteredCategories.length > 0 && <Menu.Item title="" disabled />}
            <Menu.Item
              onPress={() => handleSelectCategory(value.trim())}
              title={`Create "${value.trim()}"`}
              leadingIcon="plus"
            />
          </>
        )}
      </Menu>
      {value && !loading && (
        <View style={styles.selectedContainer}>
          <Chip
            icon={isNewCategory ? "plus" : "folder"}
            onClose={() => onChange("")}
            style={styles.selectedChip}
          >
            {isNewCategory ? `New: ${value}` : value}
          </Chip>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    opacity: 0.7,
  },
  menu: {
    marginTop: 4,
  },
  selectedContainer: {
    flexDirection: "row",
    marginTop: 8,
  },
  selectedChip: {
    alignSelf: "flex-start",
  },
});
```

**Step 2: Export from capture index**

Update `components/capture/index.ts` (or create if doesn't exist):

```typescript
export { PriorityPicker } from "./PriorityPicker";
export { StatePicker } from "./StatePicker";
export { CategoryField } from "./CategoryField";
```

**Step 3: Commit**

```bash
git add components/capture/CategoryField.tsx components/capture/index.ts
git commit -m "feat(components): add CategoryField combo input

Combo input that shows dropdown of existing categories and allows
typing new category names. Shows visual indicator for new vs existing."
```

---

## Task 5: Update Capture Screen - Add Category Types to Menu

**Files:**

- Modify: `app/(tabs)/capture.tsx`

**Step 1: Update imports and types**

Add to imports:

```typescript
import {
  CategoryField,
  PriorityPicker,
  StatePicker,
} from "@/components/capture";
import { api, CategoryType, TemplatePrompt } from "@/services/api";
```

Add selection type:

```typescript
type CaptureSelection =
  | { type: "template"; key: string }
  | { type: "category"; categoryType: CategoryType };
```

**Step 2: Update state variables**

Replace `selectedTemplateKey` state with:

```typescript
const [selection, setSelection] = useState<CaptureSelection | null>(null);
const [categoryValue, setCategoryValue] = useState("");
const [availableCategories, setAvailableCategories] = useState<string[]>([]);
const [categoriesLoading, setCategoriesLoading] = useState(false);
```

**Step 3: Get categoryTypes from context**

Update the useTemplates destructure:

```typescript
const {
  templates,
  categoryTypes,
  filterOptions,
  isLoading: loading,
  reloadTemplates,
} = useTemplates();
```

**Step 4: Update the useEffect for loading last template**

```typescript
useEffect(() => {
  if (!templates) return;

  const loadLastTemplate = async () => {
    const lastTemplate = await AsyncStorage.getItem(LAST_TEMPLATE_KEY);
    const templateKeys = Object.keys(templates);

    if (lastTemplate && templateKeys.includes(lastTemplate)) {
      setSelection({ type: "template", key: lastTemplate });
    } else if (templateKeys.length > 0) {
      setSelection({ type: "template", key: templateKeys[0] });
    }
  };

  loadLastTemplate();
}, [templates]);
```

**Step 5: Add effect to fetch categories when category type selected**

```typescript
useEffect(() => {
  if (selection?.type !== "category") {
    setAvailableCategories([]);
    setCategoryValue("");
    return;
  }

  const fetchCategories = async () => {
    setCategoriesLoading(true);
    try {
      const response = await api.getCategories(selection.categoryType.name);
      setAvailableCategories(response.categories);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
      setAvailableCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  };

  fetchCategories();
}, [selection]);
```

**Step 6: Reset form when selection changes**

```typescript
useEffect(() => {
  setValues({});
  setOptionalFields({});
  setCategoryValue("");
}, [selection]);
```

**Step 7: Commit partial progress**

```bash
git add app/\(tabs\)/capture.tsx
git commit -m "feat(capture): add category types state and effects

- Track selection as template or category type
- Fetch categories when category type selected
- Reset form on selection change"
```

---

## Task 6: Update Capture Screen - Render Category Types in Menu

**Files:**

- Modify: `app/(tabs)/capture.tsx`

**Step 1: Update handleTemplateSelect for both types**

```typescript
const handleTemplateSelect = (key: string) => {
  setMenuVisible(false);
  setTimeout(() => {
    setSelection({ type: "template", key });
    AsyncStorage.setItem(LAST_TEMPLATE_KEY, key);
  }, 0);
};

const handleCategoryTypeSelect = (categoryType: CategoryType) => {
  setMenuVisible(false);
  setTimeout(() => {
    setSelection({ type: "category", categoryType });
  }, 0);
};
```

**Step 2: Compute selected display name and prompts**

```typescript
const selectedDisplayName = useMemo(() => {
  if (!selection) return "Select Template";
  if (selection.type === "template" && templates) {
    return templates[selection.key]?.name || "Select Template";
  }
  if (selection.type === "category") {
    return selection.categoryType.name;
  }
  return "Select Template";
}, [selection, templates]);

const selectedPrompts: TemplatePrompt[] = useMemo(() => {
  if (!selection) return [];
  if (selection.type === "template" && templates) {
    return templates[selection.key]?.prompts ?? [];
  }
  if (selection.type === "category") {
    return selection.categoryType.prompts;
  }
  return [];
}, [selection, templates]);
```

**Step 3: Update the Menu rendering**

Replace the existing Menu content with:

```typescript
<Menu
  visible={menuVisible}
  onDismiss={() => setMenuVisible(false)}
  anchor={
    <Button
      mode="outlined"
      onPress={() => setMenuVisible(true)}
      icon="chevron-down"
      contentStyle={styles.templateButtonContent}
      testID="templateSelector"
    >
      {selectedDisplayName}
    </Button>
  }
>
  {templateKeys.length === 0 && (!categoryTypes || categoryTypes.length === 0) && (
    <Menu.Item title="No templates available" disabled />
  )}
  {templateKeys.map((key) => (
    <Menu.Item
      key={key}
      onPress={() => handleTemplateSelect(key)}
      title={templates![key].name}
      leadingIcon={
        selection?.type === "template" && selection.key === key
          ? "check"
          : undefined
      }
      testID={`menuItem-${key}`}
    />
  ))}
  {categoryTypes && categoryTypes.length > 0 && (
    <>
      <Divider />
      {categoryTypes.map((ct) => (
        <Menu.Item
          key={`category-${ct.name}`}
          onPress={() => handleCategoryTypeSelect(ct)}
          title={ct.name}
          leadingIcon={
            selection?.type === "category" &&
            selection.categoryType.name === ct.name
              ? "check"
              : "folder"
          }
          testID={`menuItem-category-${ct.name}`}
        />
      ))}
    </>
  )}
</Menu>
```

**Step 4: Commit**

```bash
git add app/\(tabs\)/capture.tsx
git commit -m "feat(capture): render category types in menu

Category types appear after a divider with folder icon.
Selection handling works for both templates and category types."
```

---

## Task 7: Update Capture Screen - Render Category Field and Handle Capture

**Files:**

- Modify: `app/(tabs)/capture.tsx`

**Step 1: Update the form rendering to show CategoryField**

In the ScrollView, before the template prompts section, add:

```typescript
{/* Category field for category type captures */}
{selection?.type === "category" && (
  <CategoryField
    categories={availableCategories}
    value={categoryValue}
    onChange={setCategoryValue}
    loading={categoriesLoading}
  />
)}
```

**Step 2: Update the prompts rendering to use selectedPrompts**

Replace:

```typescript
{(selectedTemplate?.prompts ?? []).map((prompt) => (
```

With:

```typescript
{selectedPrompts.map((prompt) => (
```

**Step 3: Update handleCapture to support both capture types**

Replace the handleCapture function:

```typescript
const handleCapture = async () => {
  if (!selection) return;

  setSubmitting(true);

  try {
    // Validate required fields from prompts
    const missingRequired = selectedPrompts
      .filter((p) => p.required)
      .filter((p) => {
        const val = values[p.name];
        if (Array.isArray(val)) return val.length === 0;
        return !val || (typeof val === "string" && !val.trim());
      })
      .map((p) => p.name);

    // For category captures, also require category
    if (selection.type === "category" && !categoryValue.trim()) {
      missingRequired.unshift("Category");
    }

    if (missingRequired.length > 0) {
      setMessage({
        text: `Missing required fields: ${missingRequired.join(", ")}`,
        isError: true,
      });
      setSubmitting(false);
      return;
    }

    // Build capture values
    const captureValues: Record<string, string | string[]> = { ...values };
    if (optionalFields.scheduled)
      captureValues.scheduled = optionalFields.scheduled;
    if (optionalFields.deadline)
      captureValues.deadline = optionalFields.deadline;
    if (optionalFields.priority)
      captureValues.priority = optionalFields.priority;
    if (optionalFields.tags?.length) captureValues.tags = optionalFields.tags;
    if (optionalFields.todo && optionalFields.todo !== "TODO")
      captureValues.todo = optionalFields.todo;

    let result;
    if (selection.type === "template") {
      result = await api.capture(selection.key, captureValues);
    } else {
      // Category capture
      // Map prompt names to API field names
      const title = (captureValues.Title as string) || "";
      delete captureValues.Title;
      captureValues.title = title;

      result = await api.categoryCapture(
        selection.categoryType.name,
        categoryValue.trim(),
        captureValues,
      );
    }

    if (result.status === "created") {
      setMessage({ text: "Captured!", isError: false });
      setValues({});
      setOptionalFields({});
      setCategoryValue("");
      triggerRefresh();
    } else {
      setMessage({
        text: result.message || "Capture failed",
        isError: true,
      });
    }
  } catch (err) {
    console.error("Capture failed:", err);
    setMessage({ text: "Failed to capture", isError: true });
  } finally {
    setSubmitting(false);
  }
};
```

**Step 4: Update capture button disabled state**

Update the capture button:

```typescript
<Button
  testID="captureButton"
  mode="contained"
  onPress={handleCapture}
  loading={submitting}
  disabled={submitting || !selection}
  style={styles.captureButton}
  icon="check"
>
  Capture
</Button>
```

**Step 5: Commit**

```bash
git add app/\(tabs\)/capture.tsx
git commit -m "feat(capture): complete category capture integration

- Show CategoryField when category type selected
- Route capture to appropriate endpoint based on selection type
- Validate category field for category captures
- Reset category value on successful capture"
```

---

## Task 8: Add Export and Verify Build

**Files:**

- Modify: `components/capture/index.ts` (if not already done)

**Step 1: Verify the capture components index exports CategoryField**

Check `components/capture/index.ts` has:

```typescript
export { CategoryField } from "./CategoryField";
export { PriorityPicker } from "./PriorityPicker";
export { StatePicker } from "./StatePicker";
```

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

**Step 3: Run the build**

```bash
npm run build:web
```

Expected: Build succeeds

**Step 4: Run all tests**

```bash
npm test
```

Expected: All tests pass

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: ensure exports and verify build"
```

---

## Task 9: Manual Testing Checklist

Test the following manually:

1. **No category types configured:**
   - Menu shows only templates, no divider
   - Capture works as before

2. **Category types available:**
   - Menu shows templates, then divider, then category types with folder icon
   - Selecting category type shows CategoryField
   - Categories load in dropdown

3. **Category selection:**
   - Typing filters the dropdown
   - Selecting existing category shows chip
   - Typing new category shows "Create X" option
   - New category shows chip with "New: X"

4. **Category capture:**
   - Capture with existing category succeeds
   - Capture with new category succeeds
   - Missing category shows validation error
   - Form resets after successful capture

---

## Summary

| Task | Description                     | Files                                       |
| ---- | ------------------------------- | ------------------------------------------- |
| 1    | Add API types                   | `services/api.ts`                           |
| 2    | Add API methods + tests         | `services/api.ts`, `tests/unit/api.test.ts` |
| 3    | Add to TemplatesContext         | `context/TemplatesContext.tsx`              |
| 4    | Create CategoryField            | `components/capture/CategoryField.tsx`      |
| 5    | Capture state/effects           | `app/(tabs)/capture.tsx`                    |
| 6    | Render menu with category types | `app/(tabs)/capture.tsx`                    |
| 7    | Handle category capture         | `app/(tabs)/capture.tsx`                    |
| 8    | Verify build                    | -                                           |
| 9    | Manual testing                  | -                                           |
