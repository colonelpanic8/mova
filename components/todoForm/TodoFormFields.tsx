import { PriorityPicker, StatePicker } from "@/components/capture";
import { RepeaterPicker } from "@/components/RepeaterPicker";
import { TagsEditor, TagsEditorHandle } from "@/components/TagsEditor";
import { useSettings } from "@/context/SettingsContext";
import { useTemplates } from "@/context/TemplatesContext";
import { Repeater, Todo } from "@/services/api";
import { timestampToFormString } from "@/utils/timestampConversion";
import { forwardRef, useImperativeHandle, useRef } from "react";
import { DateFieldWithQuickActions } from "./DateFieldWithQuickActions";

/** The org-mode fields shared by the capture and edit forms. */
export interface TodoFormState {
  state: string;
  priority: string | null;
  scheduled: string;
  scheduledRepeater: Repeater | null;
  deadline: string;
  deadlineRepeater: Repeater | null;
  tags: string[];
}

export function emptyTodoFormState(): TodoFormState {
  return {
    state: "TODO",
    priority: null,
    scheduled: "",
    scheduledRepeater: null,
    deadline: "",
    deadlineRepeater: null,
    tags: [],
  };
}

export function todoToFormState(todo: Todo): TodoFormState {
  return {
    state: todo.todo || "TODO",
    priority: todo.priority,
    scheduled: timestampToFormString(todo.scheduled),
    scheduledRepeater: todo.scheduled?.repeater || null,
    deadline: timestampToFormString(todo.deadline),
    deadlineRepeater: todo.deadline?.repeater || null,
    tags: todo.tags || [],
  };
}

export interface TodoFormFieldsHandle {
  /**
   * Commit any tag text typed but not yet added and return the resulting
   * tags, so submit handlers don't lose a half-entered tag.
   */
  flushTags: () => string[];
}

export interface TodoFormFieldsProps {
  value: TodoFormState;
  onChange: (value: TodoFormState) => void;
  /**
   * Render the tags editor after the date fields (default). The edit screen
   * turns this off and places its own TagsEditor further down the form.
   */
  showTags?: boolean;
  tagsDefaultExpanded?: boolean;
}

/**
 * The block of org-mode todo fields (state, priority, schedule/deadline with
 * repeaters, and optionally tags) shared by the capture and edit screens.
 * Controlled: renders `value` and reports every change through `onChange`.
 */
export const TodoFormFields = forwardRef<
  TodoFormFieldsHandle,
  TodoFormFieldsProps
>(function TodoFormFields(
  { value, onChange, showTags = true, tagsDefaultExpanded = false },
  ref,
) {
  const { quickScheduleIncludeTime } = useSettings();
  const { filterOptions } = useTemplates();
  const tagsRef = useRef<TagsEditorHandle>(null);

  const set = <K extends keyof TodoFormState>(
    field: K,
    fieldValue: TodoFormState[K],
  ) => onChange({ ...value, [field]: fieldValue });

  useImperativeHandle(ref, () => ({
    flushTags: () => tagsRef.current?.flush() ?? value.tags,
  }));

  return (
    <>
      <StatePicker value={value.state} onChange={(v) => set("state", v)} />

      <PriorityPicker
        value={value.priority}
        onChange={(v) => set("priority", v)}
        priorities={filterOptions?.priorities}
      />

      <DateFieldWithQuickActions
        label="Schedule"
        value={value.scheduled}
        onChange={(v) => set("scheduled", v)}
        colorKey="schedule"
        includeTime={quickScheduleIncludeTime}
      />

      <RepeaterPicker
        value={value.scheduledRepeater}
        onChange={(v) => set("scheduledRepeater", v)}
        label="Schedule Repeater"
      />

      <DateFieldWithQuickActions
        label="Deadline"
        value={value.deadline}
        onChange={(v) => set("deadline", v)}
        colorKey="deadline"
        includeTime={quickScheduleIncludeTime}
      />

      <RepeaterPicker
        value={value.deadlineRepeater}
        onChange={(v) => set("deadlineRepeater", v)}
        label="Deadline Repeater"
      />

      {showTags && (
        <TagsEditor
          ref={tagsRef}
          tags={value.tags}
          onChange={(tags) => set("tags", tags)}
          defaultExpanded={tagsDefaultExpanded}
        />
      )}
    </>
  );
});
