# org-projectile Integration Design

## Overview

Integrate with org-projectile to enable project listing, project-aware capture, and project-filtered views in mova.

## Background

org-projectile links projectile projects with org-mode, allowing todos to be associated with specific projects. Each project can have its own org file or heading for todos.

## API Changes (org-agenda-api)

### New Endpoint: `/get-projects`

Returns list of projects with their org-projectile configuration:

```json
{
  "projects": [
    {
      "name": "mova",
      "path": "/home/user/Projects/mova",
      "orgFile": "~/org/projects/mova.org",
      "todoCount": 5,
      "activeTodoCount": 3
    },
    {
      "name": "dotfiles",
      "path": "/home/user/dotfiles",
      "orgFile": "~/org/projects.org",
      "heading": "dotfiles",
      "todoCount": 2,
      "activeTodoCount": 1
    }
  ]
}
```

### Implementation

1. Use `projectile-known-projects` to get project list
2. Use org-projectile functions to get org file/heading for each project
3. Count todos per project from org files

### Modified `/get-all-todos` Response

Add project association to todos:

```json
{
  "title": "Fix widget crash",
  "project": "mova",
  ...
}
```

### New Endpoint: `/create` with Project

Extend `/create` to accept project parameter:

```json
{
  "title": "New feature",
  "project": "mova"
}
```

Captures to the project's configured org file/heading.

## Mobile App Changes

### Projects Tab or Section

Option A: New "Projects" tab
Option B: Projects section in existing Views tab

Display:

```
┌─────────────────────────────────────────┐
│ Projects                                │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ mova                          3/5   │ │
│ │ Mobile app for org-mode             │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ dotfiles                      1/2   │ │
│ │ Configuration files                 │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

- Shows project name, active/total todo count
- Tap to view project-specific todos

### Project Detail View

Shows todos filtered to specific project:

```
┌─────────────────────────────────────────┐
│ ← mova                                  │
├─────────────────────────────────────────┤
│ [Filter bar applies here too]           │
├─────────────────────────────────────────┤
│ □ Fix widget crash                      │
│ □ Add filtering support                 │
│ ☑ Setup CI                              │
└─────────────────────────────────────────┘
```

### Project-Aware Capture

Add project selection to enhanced capture options:

```
│ Project: [mova ▼]                       │
```

- Dropdown populated from `/get-projects`
- Optional - if not selected, uses default capture location
- When selected, capture goes to project's org location

### Integration with Filtering

Project becomes another filter type in FilterBar:

```
[+ Add Filter]  [Project: mova ×]  [TODO ×]
```

### File Structure

```
components/
├── projects/
│   ├── ProjectList.tsx        # List of projects
│   ├── ProjectCard.tsx        # Individual project card
│   ├── ProjectPicker.tsx      # Dropdown for capture
app/
├── projects/
│   ├── index.tsx              # Projects list screen
│   ├── [project].tsx          # Project detail screen
services/
├── projects.ts                # API calls for projects
```

## Implementation Order

1. Add `/get-projects` endpoint to org-agenda-api
2. Add project field to `/get-all-todos` response
3. Extend `/create` to accept project parameter
4. Build ProjectList and ProjectCard components
5. Add Projects section to Views tab (or new tab)
6. Build project detail screen
7. Add ProjectPicker to capture screen
8. Add project filter to FilterBar
