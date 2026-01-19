# Mova

A mobile client for [org-agenda-api](../README.md) - access and manage your Emacs org-mode tasks from Android and iOS.

## Overview

Mova is a React Native/Expo application that connects to an org-agenda-api server, providing a native mobile interface for:

- Viewing your daily agenda with scheduled items and deadlines
- Capturing new tasks using org-mode capture templates
- Searching across all your TODO items
- Running custom agenda views
- Receiving notifications for upcoming tasks

## Relationship to org-agenda-api

Mova is the mobile frontend for [org-agenda-api](../README.md), a JSON HTTP API that exposes org-mode data from GNU Emacs. The architecture:

```
+--------+         +----------------+         +-------+
|  Mova  |  <--->  | org-agenda-api |  <--->  | Emacs |
| (this) |  HTTP   |    (server)    |  elisp  |       |
+--------+         +----------------+         +-------+
```

- **org-agenda-api** runs as a Docker container or server, exposing your org files via REST endpoints
- **Mova** connects to that server using HTTP Basic Auth to provide a native mobile experience

You need a running org-agenda-api instance for Mova to connect to. See the [org-agenda-api README](../README.md) for setup instructions.

## Features

### Agenda View

- Daily agenda with date navigation
- Shows scheduled items, deadlines, and overdue tasks
- Pull-to-refresh synchronization
- Inline task completion and editing

### Capture

- Template-based task capture using your org-mode capture templates
- Dynamic form fields (text, dates, tags) defined by templates
- Priority and TODO state selection
- Scheduled/deadline date pickers
- Remembers your last-used template

### Search

- Full-text search across all TODO items
- Searches title, tags, and TODO state
- Real-time filtering

### Custom Views

- Access your custom org-agenda commands
- Dynamic view rendering from server-defined views

### Android Widget

- Quick Capture widget for home screen
- Capture tasks without opening the app
- Configurable template per widget instance

### Notifications

- Background sync for upcoming tasks
- Configurable notification intervals
- Scheduled and deadline reminders

## Getting Started

### Prerequisites

- Node.js 18+
- Yarn or npm
- A running [org-agenda-api](../README.md) server
- For development: Android Studio (Android) or Xcode (iOS)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd mova

# Install dependencies
yarn install

# Start the development server
yarn start
```

### Running the App

```bash
# Android
yarn android

# iOS
yarn ios

# Or use Expo Go for quick testing
npx expo start
```

### Connecting to org-agenda-api

1. Launch Mova
2. Enter your org-agenda-api server URL (e.g., `https://your-server.com`)
3. Enter your username and password
4. Tap Login

## Development

### Project Structure

```
mova/
├── app/                    # Expo Router screens
│   ├── (tabs)/             # Main tab navigation
│   │   ├── index.tsx       # Agenda screen
│   │   ├── capture.tsx     # Capture screen
│   │   ├── search.tsx      # Search screen
│   │   ├── views.tsx       # Custom views
│   │   └── settings/       # Settings screens
│   └── login.tsx           # Login screen
├── services/               # API client and background tasks
│   ├── api.ts              # org-agenda-api client
│   ├── backgroundSync.ts   # Background task registration
│   └── notifications.ts    # Push notifications
├── components/             # Reusable UI components
├── context/                # React context providers
├── hooks/                  # Custom React hooks
├── widgets/                # Android widget implementation
└── tests/                  # Jest unit/integration tests
```

### Commands

```bash
yarn start          # Start Expo dev server
yarn android        # Run on Android
yarn ios            # Run on iOS
yarn test           # Run Jest tests
yarn typecheck      # TypeScript validation
yarn lint           # ESLint check
yarn e2e:android    # Run Detox E2E tests
```

### Testing

```bash
# Unit tests
yarn test

# E2E tests (requires Android emulator)
yarn e2e:build:android
yarn e2e:android
```

## Tech Stack

- **React Native** + **Expo** - Cross-platform mobile framework
- **Expo Router** - File-based navigation
- **React Native Paper** - Material Design 3 components
- **TypeScript** - Type safety
- **Jest** + **Detox** - Testing

## Configuration

### Capture Templates

Capture templates are defined in your Emacs org-mode configuration and exposed via the org-agenda-api `/capture-templates` endpoint. Mova automatically fetches and renders forms based on your template definitions.

Example template structure from org-agenda-api:

```json
{
  "todo": {
    "name": "Todo",
    "prompts": [
      { "name": "title", "type": "string", "required": true },
      { "name": "scheduled", "type": "date", "required": false },
      { "name": "tags", "type": "tags", "required": false }
    ]
  }
}
```

### Notifications

Configure notification preferences in Settings:

- Enable/disable notifications
- Set reminder intervals (e.g., 15 minutes before)
- Background sync frequency (default: 15 minutes)

## License

GPL v3
