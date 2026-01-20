# Google Assistant Integration Design

## Overview

Enable quick capture of todos via Google Assistant with support for template selection.

## User Experience

### Basic Usage

User: "Hey Google, add a todo to Mova: buy groceries"
Result: Creates todo "buy groceries" using default template

### With Template

User: "Hey Google, tell Mova to capture a work task: review PR"
Result: Creates todo "review PR" using "work" template

## Technical Approach

### App Actions

Use Android App Actions to integrate with Google Assistant:

1. Define actions in `actions.xml`
2. Handle intents in the app
3. Process in background (no UI needed for simple capture)

### actions.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<actions>
  <action intentName="actions.intent.CREATE_TASK">
    <fulfillment urlTemplate="mova://capture{?title,template}">
      <parameter-mapping
        intentParameter="task.name"
        urlParameter="title" />
      <parameter-mapping
        intentParameter="task.listName"
        urlParameter="template" />
    </fulfillment>
  </action>

  <!-- Custom action for explicit mova invocation -->
  <action intentName="custom.actions.intent.MOVA_CAPTURE">
    <fulfillment urlTemplate="mova://capture{?title,template}">
      <parameter-mapping
        intentParameter="title"
        urlParameter="title" />
      <parameter-mapping
        intentParameter="template"
        urlParameter="template" />
    </fulfillment>
  </action>
</actions>
```

### Deep Link Handling

Handle `mova://capture` deep links:

```typescript
// In app entry or dedicated handler
import * as Linking from "expo-linking";

Linking.addEventListener("url", ({ url }) => {
  const parsed = Linking.parse(url);
  if (parsed.path === "capture") {
    const { title, template } = parsed.queryParams;
    handleAssistantCapture(title, template);
  }
});
```

### Background Capture

Process capture without opening full app UI:

```typescript
async function handleAssistantCapture(title: string, template?: string) {
  // Load credentials from storage
  const credentials = await getStoredCredentials();

  if (!credentials) {
    // Open app to login screen
    return;
  }

  // Determine capture parameters based on template
  const captureParams = getTemplateParams(template);

  // Call API
  await createTodo({
    title,
    ...captureParams,
  });

  // Show brief toast/notification confirming capture
  showCaptureConfirmation(title);
}
```

### Template Configuration

Store templates in settings:

```typescript
interface CaptureTemplate {
  id: string;
  name: string; // "work", "personal", "shopping"
  voiceTriggers: string[]; // ["work task", "work todo"]
  defaults: {
    file?: string;
    tags?: string[];
    todo?: string;
    priority?: string;
  };
}
```

Settings UI:

```
┌─────────────────────────────────────────┐
│ Capture Templates                       │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ Work                           [✎]  │ │
│ │ Triggers: "work task", "work todo"  │ │
│ │ File: work.org, Tags: work          │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Shopping                       [✎]  │ │
│ │ Triggers: "shopping", "to buy"      │ │
│ │ File: personal.org, Tags: shopping  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [+ Add Template]                        │
└─────────────────────────────────────────┘
```

### Template Matching

Match voice input to template:

```typescript
function matchTemplate(listName: string | undefined): CaptureTemplate | null {
  if (!listName) return null;

  const templates = await getTemplates();
  const normalized = listName.toLowerCase();

  return templates.find(
    (t) =>
      t.name.toLowerCase() === normalized ||
      t.voiceTriggers.some((trigger) =>
        normalized.includes(trigger.toLowerCase()),
      ),
  );
}
```

## Implementation Details

### File Structure

```
android/app/src/main/res/xml/
├── actions.xml                 # App Actions definition

services/
├── assistant.ts                # Assistant capture handling
├── templates.ts                # Template storage/matching

components/settings/
├── CaptureTemplates.tsx        # Template management UI
├── TemplateEditor.tsx          # Edit individual template

app.json                        # Deep link scheme config
```

### app.json Configuration

```json
{
  "expo": {
    "scheme": "mova",
    "android": {
      "intentFilters": [
        {
          "action": "android.intent.action.VIEW",
          "data": [{ "scheme": "mova", "host": "capture" }],
          "category": [
            "android.intent.category.DEFAULT",
            "android.intent.category.BROWSABLE"
          ]
        }
      ]
    }
  }
}
```

### Permissions

- No special permissions needed for App Actions
- Network permission (already have) for API calls
- May need notification permission for capture confirmation

## Investigation - Current State

Before implementing, check:

1. Is there existing Assistant/deep link code?
2. Is `actions.xml` already present?
3. Are there existing capture templates?
4. What's the current deep link scheme?

```bash
# Check for existing Assistant integration
find android -name "actions.xml"
grep -r "intentFilter" android/
grep -r "scheme" app.json
```

## Testing

### Manual Testing

1. Build and install app
2. Open Google Assistant
3. Say "add a todo to Mova: test item"
4. Verify todo is created

### Test Cases

- [ ] Basic capture without template works
- [ ] Capture with known template applies defaults
- [ ] Capture with unknown template uses default
- [ ] Capture while logged out opens login screen
- [ ] Capture while offline queues todo
- [ ] Confirmation shown after successful capture
- [ ] Error shown if capture fails

## Implementation Order

1. Investigate current state of Assistant/deep linking
2. Add `actions.xml` if not present
3. Configure deep link handling for `mova://capture`
4. Implement background capture handler
5. Add template configuration to settings
6. Implement template matching
7. Add capture confirmation notification
8. Test with Google Assistant
