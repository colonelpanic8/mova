# Elisp Function Calling Design

## Overview

Expose custom elisp functions via org-agenda-api, allowing users to trigger server-side org-mode commands from the mobile app. Functions are discoverable via configuration.

## Use Cases

- `imalison:reschedule-past-to-today` - Bulk reschedule overdue items
- Custom archive commands
- Batch tag operations
- Any user-defined org-mode helper functions

## API Changes (org-agenda-api)

### Configuration

Server-side configuration specifying available functions:

```elisp
(setq org-agenda-api-exposed-functions
  '(("reschedule-past"
     :function imalison:reschedule-past-to-today
     :description "Reschedule all overdue items to today"
     :args nil)
    ("archive-done"
     :function my/archive-all-done
     :description "Archive all DONE items"
     :args nil)
    ("set-tag"
     :function org-toggle-tag
     :description "Toggle tag on current item"
     :args ((:name "tag" :type "string" :description "Tag to toggle")))))
```

### New Endpoint: `/get-functions`

Returns list of available functions:

```json
{
  "functions": [
    {
      "id": "reschedule-past",
      "description": "Reschedule all overdue items to today",
      "args": []
    },
    {
      "id": "archive-done",
      "description": "Archive all DONE items",
      "args": []
    },
    {
      "id": "set-tag",
      "description": "Toggle tag on current item",
      "args": [
        { "name": "tag", "type": "string", "description": "Tag to toggle" }
      ]
    }
  ]
}
```

### New Endpoint: `/call-function`

Execute a function:

Request:

```json
{
  "function": "reschedule-past",
  "args": {}
}
```

With arguments:

```json
{
  "function": "set-tag",
  "args": {
    "tag": "urgent"
  }
}
```

Response:

```json
{
  "success": true,
  "message": "Rescheduled 5 items",
  "result": null
}
```

### Security Considerations

- Only functions explicitly listed in config are callable
- No arbitrary elisp evaluation
- Consider adding auth scope for function calls
- Log all function invocations

## Mobile App Changes

### Settings Page Integration

Add "Server Actions" section to settings:

```
┌─────────────────────────────────────────┐
│ Settings                                │
├─────────────────────────────────────────┤
│ Server Configuration                    │
│ ...                                     │
├─────────────────────────────────────────┤
│ Server Actions                          │
│ ┌─────────────────────────────────────┐ │
│ │ Reschedule overdue to today     [▶] │ │
│ │ Archive all done items          [▶] │ │
│ │ Toggle tag...                   [▶] │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Function Execution Flow

1. User taps function button
2. If function has args, show input modal:
   ```
   ┌─────────────────────────────────────┐
   │ Toggle Tag                          │
   ├─────────────────────────────────────┤
   │ Tag: [____________]                 │
   │                                     │
   │ (Elisp expression supported)        │
   │                                     │
   │        [Cancel]  [Execute]          │
   └─────────────────────────────────────┘
   ```
3. Show loading indicator
4. Call `/call-function` endpoint
5. Show success/error toast
6. Trigger data refresh if successful

### Argument Input

For advanced users, support elisp expressions in argument fields:

- Simple string: `work`
- Elisp expression: `(format "%s-%s" "project" "tag")`

The server evaluates elisp expressions before passing to function.

### Components

```
components/
├── settings/
│   ├── ServerActions.tsx       # List of available functions
│   ├── FunctionButton.tsx      # Individual function trigger
│   ├── FunctionArgsModal.tsx   # Modal for function arguments
services/
├── functions.ts                # API calls for functions
```

### State Management

- Fetch available functions on settings screen mount
- Cache function list (refresh on pull-to-refresh)
- No persistent state needed for function execution

## Implementation Order

1. Define config format in org-agenda-api
2. Implement `/get-functions` endpoint
3. Implement `/call-function` endpoint
4. Add ServerActions section to settings screen
5. Build FunctionButton component
6. Build FunctionArgsModal for functions with args
7. Add success/error feedback
8. Add data refresh after function execution
