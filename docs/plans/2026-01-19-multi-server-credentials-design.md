# Multi-Server Credentials Management

## Overview

Enable users to save multiple server credentials and switch between them. Primary focus on mobile, with web support via existing AsyncStorage abstraction.

## Data Model

```typescript
interface SavedServer {
  id: string; // UUID for stable identification
  nickname?: string; // Optional user-provided name, falls back to URL
  apiUrl: string;
  username: string;
  password: string;
}
```

**Storage keys:**

- `mova_saved_servers` - JSON array of SavedServer objects
- `mova_active_server_id` - ID of currently connected server (or null)
- Existing keys (`mova_api_url`, `mova_username`, `mova_password`) continue to hold active credentials for backward compatibility and widget access

## UI Changes

### Login Screen

- **Saved servers list** at top (if any exist)
  - Shows: nickname (or URL), username, URL subtitle if nickname set
  - Tap to immediately connect
  - Visual indicator for last-used server
- **Divider** with "Or connect to a new server"
- **Existing form** for new server credentials
- **"Save server" checkbox** (checked by default)
- **Show password toggle** (eye icon) in password field

### Settings Screen

**Connection section updates:**

- Server URL display
- Username display
- Password display (hidden by default, eye icon to reveal)
- "Manage Servers" button

**New "Manage Servers" screen** (`servers.tsx`):

- List of all saved servers with active indicator
- Tap to switch servers immediately
- Swipe/long-press for edit and delete actions
- "Add Server" button at bottom

**Edit Server form:**

- Nickname (optional), URL, username, password fields
- Show password toggle
- Save and Cancel buttons

## AuthContext Changes

```typescript
interface AuthContextType {
  // Existing
  apiUrl: string | null;
  username: string | null;
  password: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login(
    apiUrl: string,
    username: string,
    password: string,
    save?: boolean,
  ): Promise<boolean>;
  logout(): Promise<void>;
  getAuthHeader(): string | null;

  // New
  savedServers: SavedServer[];
  activeServerId: string | null;
  switchServer(serverId: string): Promise<boolean>;
  saveServer(server: Omit<SavedServer, "id">): Promise<SavedServer>;
  updateServer(id: string, updates: Partial<SavedServer>): Promise<void>;
  deleteServer(id: string): Promise<void>;
}
```

## Behavior

### Server Switch Flow

1. `switchServer(id)` finds server in `savedServers`
2. Validates credentials via API call
3. On success: updates active credentials, SharedPreferences for widgets
4. On failure: shows error snackbar, stays on current server

### Login with Save

- `login()` accepts optional `save: boolean` parameter (default true)
- If save=true and login succeeds, adds server to saved list

### Logout Flow

- Clears active credentials
- Sets `activeServerId` to null
- Does NOT remove server from saved list
- Navigates to login screen showing server picker

## Files to Modify

1. `context/AuthContext.tsx` - Add multi-server state and methods
2. `app/login.tsx` - Add saved servers list, save checkbox, show password
3. `app/(tabs)/settings/index.tsx` - Add password display with toggle, "Manage Servers" link
4. `app/(tabs)/settings/servers.tsx` - New server management screen
5. `app/(tabs)/settings/_layout.tsx` - Register new servers screen

## Settings Scope

App-level settings (color palette, notifications) remain global across all servers.
