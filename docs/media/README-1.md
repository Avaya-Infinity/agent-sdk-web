# Agent SDK Standalone Test Harness

A zero-build-step HTML page for testing the Avaya Infinity Agent SDK in isolation — without the demo-app. Use it to quickly reproduce customer issues and determine whether a bug is in the SDK or the demo-app.

## Issue Isolation Workflow

1. Customer reports issue → open test harness
2. Configure same connection settings as customer
3. Reproduce the operation that failed
4. **Fails in harness → SDK bug**
5. **Works in harness, fails in demo-app → demo-app bug**

## Prerequisites

- Node.js v24+ and pnpm v10+
- SDK must be built first (produces `sdk/lib/avaya-infinity-agent-sdk.min.js`)
- A static file server (e.g., `http-server`)

## Quick Start

```bash
# 1. Build the SDK (from repo root)
pnpm -F ./sdk build

# 2. Launch the harness (builds are served from sdk/, opens browser automatically)
pnpm -F ./sdk run-harness

# 3. Browser opens at http://localhost:3000/test-harness/
```

## Configuration Fields


| Field                   | Description                                         | Example                                  |
| ----------------------- | --------------------------------------------------- | ---------------------------------------- |
| **Avaya Infinity Host** | API host URL                                        | `https://na.cc.avayacloud.com`           |
| **Client ID**           | OAuth client ID registered with the IdP             | `abc123-def456`                          |
| **OAuth Endpoint**      | Token endpoint URL for the Identity Provider        | `https://login.bpo.avaya.com/oauth2/...` |
| **OAuth Redirect URI**  | Must match the URL where the harness is served      | `http://localhost:8080`                  |
| **OAuth Mode**          | `redirect` (default) or `popup`                     | --                                       |
| **Log Level**           | SDK internal logging: DEBUG, INFO, WARN, ERROR, OFF | --                                       |


All configuration is saved to `localStorage` automatically and persists between sessions.

## OAuth Setup

### Redirect Mode (default)

1. Register `http://localhost:8080` (or your harness URL) as an allowed redirect URI in your OAuth provider
2. Fill in all config fields and click **Initialize**
3. The page will redirect to the IdP login
4. After login, the page reloads and automatically completes initialization

### Popup Mode

1. Register the `sdk/callback.html` URL as the redirect URI (e.g., `http://localhost:8080/../callback.html`)
2. Set OAuth Mode to **Popup** and set the redirect URI to the callback.html URL
3. Click **Initialize** — a popup window opens for login
4. After login, the popup closes and initialization completes

## Console Debugging

The harness exposes global variables for browser console access:


| Global               | Description                                                       |
| -------------------- | ----------------------------------------------------------------- |
| `window.SDK`         | `AvayaInfinityAgentSdk` static class                              |
| `window.user`        | Authenticated `User` object (after init)                          |
| `window.intr`        | Currently selected `Interaction` object (from the dropdown)       |
| `window.interactions`| All active interactions as `{ interactionId: Interaction, ... }`  |
| `window.queues`      | Array of `Queue` objects (after loading queues)                   |


### Example Console Commands

```javascript
// Check SDK version
SDK.version()

// Get WebSocket status
SDK.getWebSocketConnectionStatus()

// Change agent status
user.changeStatus({ type: 'available', reason: 'Available' })

// Accept incoming interaction
intr.accept()

// Get assigned queues
await user.getAssignedQueues()

// Blind transfer to a queue
intr.blindTransfer({ type: 'queue', queueId: 'queue-123', queueName: 'Sales' })

// Blind transfer to an external number
intr.blindTransfer({ type: 'external', externalNumber: '+12005551234' })
```

## Event Log

The right panel shows a live event log for all SDK events:

- **Color-coded badges**: USER (blue), INTR (green), WS (orange), MEDIA (purple), ACTION (gray), ERROR (red)
- **Click any entry** to expand and see the full JSON payload
- **Filter** by category using the dropdown
- **Export** downloads the full event log as a JSON file
- **Clear** empties the log
- **Auto-scroll** keeps the log scrolled to the latest entry

## Troubleshooting

### "Failed to resolve module specifier" error

The SDK bundle is an ES module. Make sure you're serving via HTTP (not `file://`). Use `npx http-server` as shown above.

### SDK bundle not found (404)

Build the SDK first: `pnpm -F ./sdk build`. The harness loads `../lib/avaya-infinity-agent-sdk.min.js` relative to its location. You must serve from the `sdk/` directory (not `sdk/test-harness/`) so that both `test-harness/` and `lib/` are within the server root.

### OAuth redirect loops or fails

- Ensure the redirect URI in the config matches exactly where the harness is served (including port)
- The redirect URI must be registered in your OAuth provider's allowed redirect URIs
- Check browser console for CORS errors

### socketcluster-client loading issues

The harness loads `socketcluster-client` from `esm.sh` CDN. If you're behind a corporate proxy or firewall that blocks CDN access, you may need to configure proxy settings or whitelist `esm.sh`.

### Operations fail with "SDK not initialized"

Click **Initialize** first. For redirect mode, the page must complete the full OAuth redirect cycle before the SDK is usable.

### Interaction buttons don't work

Interaction operations require an active interaction. Wait for an incoming call (the `interactionReceived` event will appear in the log, and `window.intr` will be set automatically).

## Multiple Simultaneous Interactions

The harness supports testing multiple concurrent interactions:

- Each incoming interaction is added to the **Active Interactions** dropdown in the Interaction panel
- The dropdown shows interaction ID, customer name, and current status
- Select which interaction to operate on via the dropdown — all buttons act on the selected interaction
- `window.intr` always points to the currently selected interaction
- `window.interactions` contains all active interactions keyed by ID
- When an interaction completes, it's removed from the dropdown and the next one is auto-selected

### Console examples with multiple interactions

```javascript
// List all active interaction IDs
Object.keys(interactions)

// Access a specific interaction by ID
interactions['abc-123'].holdCall()

// Check status of all interactions
Object.entries(interactions).forEach(([id, i]) => console.log(id, i.currentStatus))
```