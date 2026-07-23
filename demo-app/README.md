# Sample Agent Desktop Application

## Introduction

This sample application demonstrates how to integrate with the [Avaya Infinity™ Agent SDK](TODO_PLACEHOLDER_LINK) and build a contact center agent desktop. It showcases core agent workflows including OAuth authentication, voice call handling, queue management, and real-time interaction management.

## Key Features

- **OAuth Authentication** — supports both redirect and popup modes
- **Voice Call Management** — accept, reject, hold, resume, mute, unmute, blind transfer, DTMF
- **Private Messaging** — real-time private chat between agents (owner and viewers) on an active interaction, invisible to the customer; includes message history and a collapsible chat panel
- **Outbound Dialing** — initiate outbound calls from the agent desktop
- **Queue Management** — login/logout of queues, view queue statistics
- **Agent Status** — change availability status with reason codes
- **Interaction Classification** — set interaction type and end result codes during or after a call
- **Custom Fields** — view and edit custom metadata associated with an interaction
- **Customer Details** — view customer information during an active interaction
- **Team View** — supervisor dashboard to monitor team members, their status, queue assignments, and active interactions; includes agent CX login management and queue login/logout controls
- **Audio Device Selection** — choose microphone and speaker devices
- **Real-time Notifications** — toast notifications for call events and connection status changes
- **WebSocket & WebRTC Indicators** — visual connection status in the header

## Prerequisites

- [Node.js](https://nodejs.org/) v24 or later (LTS recommended)
- [pnpm](https://pnpm.io/) v10 or later (`corepack enable`)
- A modern browser with WebRTC support (e.g., Chrome, Edge, Firefox)
- Access to an Avaya Infinity environment

### Details Required from Your Avaya Infinity Account Administrator

Reach out to your Avaya Infinity account administrator to obtain the following information:


| Detail                    | Description                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Avaya Infinity Host**   | The URL of your Avaya Infinity environment (e.g., `https://your-instance.avayacloud.com`)                         |
| **OAuth Client ID**       | The client ID obtained by creating an SDK integration in the Avaya Infinity admin console                         |
| **OAuth Redirect URI(s)** | The redirect URI(s) registered for the OAuth Client. See [OAuth Configuration](#oauth-configuration) for details. |
| **Agent Credentials**     | An agent account provisioned in the Avaya Infinity system                                                         |


## Steps to Run the Sample Application

1. **Clone or download this repository**
  ```bash
   git clone <repository-url>
   cd <repository-name>
  ```
2. **Install dependencies**
  Run the following command to install the dependencies:
  ```bash
   pnpm install
   ```
3. **Start the development server**
  ```bash
   pnpm dev
  ```
   The application will start on `http://localhost:3000`.
4. **Provide configuration**
  When the application loads, you will be presented with a Settings form. Fill in the required fields:
  - **Avaya Infinity Host** — the URL of your Avaya Infinity environment
  - **OAuth Client ID** — the client ID obtained from your SDK integration in the Avaya Infinity admin console
  - **Redirect URI** — the OAuth redirect URI (defaults to the current origin, e.g., `http://localhost:3000`)
  - **OAuth Mode** — choose between **Redirect** or **Popup** (see [OAuth Configuration](#oauth-configuration))
  - **IdP Hint** *(optional)* — bypasses Keycloak's login and identity provider selection screens by routing directly to a configured federated identity provider. The value must match the IdP alias configured in Keycloak by your Avaya Infinity administrator (e.g., `entra-id` for Microsoft Entra ID). When left blank, the standard Keycloak login page is shown.
5. **Sign in**
  Click **Connect** to initiate OAuth authentication. After successful login, the agent desktop interface will load.

## OAuth Configuration

The application supports two OAuth modes. Your Account Administrator must register the appropriate redirect URI(s) on the OAuth Client in the Avaya Infinity admin console.


| Mode                   | Behavior                                                                                       | Redirect URI to Register                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Redirect** (default) | Navigates the page to the identity provider for login, then redirects back to the application. | Your application origin (e.g., `http://localhost:3000`)                                            |
| **Popup**              | Opens the identity provider login in a popup window. The main page stays intact.               | Your application origin followed by `/callback.html` (e.g., `http://localhost:3000/callback.html`) |


> **Note:** In popup mode, the included `callback.html` file handles the OAuth response. Ensure this file is served at the registered redirect URI.

## Production Build

```bash
pnpm build
```

To preview the production build locally:

```bash
pnpm preview
```

> **Note:** Voice features require HTTPS and microphone permissions in production environments.

## Next Steps

1. Explore the sample application source code to understand how the SDK is initialized and used.
2. Refer to the [Avaya Infinity Agent SDK](TODO_PLACEHOLDER_LINK) package on npm and the [API documentation](TODO_PLACEHOLDER_LINK) for detailed reference.
3. Use this sample application as a starting point to build your own agent desktop tailored to your business requirements.

## License

View [LICENSE](https://support.avaya.com/css/public/documents/101038288)