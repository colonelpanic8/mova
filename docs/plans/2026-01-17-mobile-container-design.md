# Mobile Container Design

## Overview

Investigate running the org-agenda-api container directly on the mobile device, enabling offline capability without requiring a separate server.

## Goals

- Full offline capability for mova
- No need for users to maintain a separate server
- User can specify their own container image (different Emacs configs)
- Sync org files between device and container

## Technical Challenges

### 1. Running Containers on Mobile

Android doesn't natively support Docker/containers. Options:

#### Option A: Termux + proot/chroot

- Termux provides Linux environment on Android
- Can run Emacs in Termux
- No actual containerization, but can simulate
- Requires user to install Termux separately

#### Option B: QEMU/VM

- Run lightweight Linux VM on device
- Heavy resource usage
- Complex setup

#### Option C: WebAssembly Emacs

- Emacs compiled to WASM
- Runs in JavaScript environment
- Limited functionality, experimental

#### Option D: Native org-mode parser

- Reimplement org parsing in JS/native code
- No Emacs dependency
- Lose elisp customizations
- Significant effort

### 2. Org File Storage

Where do org files live?

#### Local to device

- Store in app's document directory
- Sync with external service (Dropbox, Git, Syncthing)
- Container reads from this location

#### In container

- Container has its own filesystem
- Need to sync files in/out
- More complex data management

### 3. Container Image Specification

Users need different Emacs configurations:

```
┌─────────────────────────────────────────┐
│ Container Settings                      │
├─────────────────────────────────────────┤
│ Image: [ghcr.io/user/org-api:latest  ] │
│                                         │
│ Or select preset:                       │
│ ○ Default (minimal org-agenda-api)      │
│ ○ Doom Emacs                            │
│ ○ Spacemacs                             │
│ ○ Custom image URL                      │
│                                         │
│ Org directory: [/storage/org]           │
│                                         │
│ [Start Container]  [Stop Container]     │
└─────────────────────────────────────────┘
```

## Recommended Approach

### Phase 1: Termux Integration

Most practical short-term solution:

1. **Companion Setup Script**
   - Provide script user runs in Termux
   - Installs Emacs + org-agenda-api
   - Configures to start on boot

2. **Mova connects to localhost**
   - Termux runs API on localhost:8080
   - Mova connects to 127.0.0.1:8080
   - No network needed for local use

3. **Org File Location**
   - User configures org-directory in Termux Emacs
   - Can be shared storage accessible to both apps
   - Or Syncthing/git for sync

### Phase 2: Integrated Solution (Future)

Longer-term, more seamless:

1. **Termux:Tasker integration**
   - Mova triggers Termux commands via Tasker plugin
   - Start/stop Emacs server programmatically

2. **Or: Embedded Termux**
   - Bundle Termux-like environment in mova
   - Significant engineering effort
   - App size increases dramatically

## Implementation Details

### Termux Setup Script

```bash
#!/bin/bash
# mova-setup.sh - Run in Termux

# Install dependencies
pkg update && pkg install emacs git

# Clone org-agenda-api
git clone https://github.com/user/org-agenda-api ~/.emacs.d/org-agenda-api

# Configure Emacs
cat >> ~/.emacs.d/init.el << 'EOF'
(load "~/.emacs.d/org-agenda-api/org-agenda-api.el")
(setq org-agenda-api-port 8080)
(org-agenda-api-start)
EOF

# Create startup script
cat > ~/start-org-api.sh << 'EOF'
#!/bin/bash
emacs --daemon
emacsclient --eval "(org-agenda-api-start)"
EOF
chmod +x ~/start-org-api.sh

# Add to shell startup
echo "~/start-org-api.sh" >> ~/.bashrc

echo "Setup complete! Restart Termux to start the server."
```

### Mova Configuration

Add "Local Server" option in settings:

```typescript
interface ServerConfig {
  type: "remote" | "local";
  // Remote
  url?: string;
  username?: string;
  password?: string;
  // Local (Termux)
  localPort?: number; // default 8080
}
```

### Connection Logic

```typescript
async function getApiUrl(): Promise<string> {
  const config = await getServerConfig();

  if (config.type === "local") {
    // Check if local server is running
    const localUrl = `http://127.0.0.1:${config.localPort || 8080}`;
    try {
      await fetch(`${localUrl}/health`, { timeout: 1000 });
      return localUrl;
    } catch {
      throw new Error("Local server not running. Please start Termux.");
    }
  }

  return config.url;
}
```

### Health Check / Server Status

Show server status in app:

```
┌─────────────────────────────────────────┐
│ Server Status                           │
├─────────────────────────────────────────┤
│ Mode: Local (Termux)                    │
│ Status: ● Running                       │
│ Port: 8080                              │
│                                         │
│ [Open Termux]  [Restart Server]         │
└─────────────────────────────────────────┘
```

## Investigation Tasks

### Research Questions

1. **Termux API access** - Can mova detect if Termux is installed? Can it launch Termux?
2. **Termux:Tasker** - How to trigger Termux commands from another app?
3. **Shared storage** - What paths are accessible to both mova and Termux?
4. **Background execution** - Can Termux keep Emacs running when app is closed?
5. **Battery impact** - How much battery does background Emacs use?

### Technical Spikes

1. Test basic Termux + Emacs + org-agenda-api setup manually
2. Test connectivity from mova to Termux localhost
3. Test org file access from shared storage
4. Measure battery impact of background Emacs

## File Structure

```
docs/
├── termux-setup.md            # User-facing setup guide

components/settings/
├── ServerConfig.tsx           # Server configuration UI
├── LocalServerStatus.tsx      # Status display for local mode

services/
├── serverConnection.ts        # Connection logic with local support
```

## Implementation Order

1. **Research phase**
   - Test Termux + org-agenda-api manually
   - Document findings
   - Validate approach is viable

2. **Basic integration**
   - Add "Local" server type to settings
   - Implement localhost connection
   - Add server status display

3. **Setup assistance**
   - Create Termux setup script
   - Write user documentation
   - Add "Open Termux" button

4. **Enhanced integration** (future)
   - Termux:Tasker integration
   - Automatic server start/stop
   - Health monitoring

## Risks and Mitigations

| Risk                     | Mitigation                                     |
| ------------------------ | ---------------------------------------------- |
| User doesn't have Termux | Clear setup instructions, link to Play Store   |
| Termux killed by Android | Use Termux:Boot for auto-restart, or wake lock |
| Storage permissions      | Document required permissions                  |
| Battery drain            | Optimize Emacs config, allow stopping server   |
| Complexity for users     | Good documentation, setup wizard               |
