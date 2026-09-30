# Demo Agent Web Application

## Introduction

This sample application demonstrates how to integrate with the [Avaya Infinity™ Agent SDK](https://avaya-infinity.github.io/agent-sdk-web/) and build a contact center agent desktop. It showcases core agent workflows including OAuth authentication, voice call handling, queue management, and real-time interaction management.

> ⚠️ WARNING
> 
> This application is provided as a sample for the purpose of reference only and shouldn't be used in production.

## Prerequisites

- [Node.js](https://nodejs.org/) v24 or later (LTS recommended)
- [npm](https://www.npmjs.com/) v10 or later
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


## Steps to Run the Demo Application

1. **Clone or download this repository**
  ```bash
   git clone https://github.com/Avaya-Infinity/agent-sdk-web.git
   cd ./demo-app
  ```
2. **Install dependencies**
  Run the following command to install the dependencies:
  ```bash
   npm install
   ```
3. **Build the demo-app**
  Run the following command to build:
  ```bash
    npm run build
  ```
4. **Start the server**
  ```bash
   npm run serve
  ```
   The application will start on `http://localhost:3000`.
5. **Provide configuration**
  When the application loads, you will be presented with a Settings form. Fill in the required fields:
  - **Avaya Infinity Host** — the URL of your Avaya Infinity environment
  - **OAuth Client ID** — the client ID obtained from your SDK integration in the Avaya Infinity admin console
  - **Redirect URI** — the OAuth redirect URI (defaults to the current origin, e.g., `http://localhost:3000`)
  - **OAuth Mode** — choose between **Redirect** or **Popup** (see [OAuth Configuration](#oauth-configuration))
  - **IdP Hint** *(optional)* — bypasses Keycloak's login and identity provider selection screens by routing directly to a configured federated identity provider. The value must match the IdP alias configured in Keycloak by your Avaya Infinity administrator (e.g., `entra-id` for Microsoft Entra ID). When left blank, the standard Keycloak login page is shown.
6. **Sign in**
  Click **Connect** to initiate OAuth authentication. After successful login, the agent desktop interface will load.

## OAuth Configuration

The application supports two OAuth modes. Your Account Administrator must register the appropriate redirect URI(s) on the OAuth Client in the Avaya Infinity admin console.


| Mode                   | Behavior                                                                                       | Redirect URI to Register                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Redirect** (default) | Navigates the page to the identity provider for login, then redirects back to the application. | Your application origin (e.g., `http://localhost:3000`)                                            |
| **Popup**              | Opens the identity provider login in a popup window. The main page stays intact.               | Your application origin followed by `/callback.html` (e.g., `http://localhost:3000/callback.html`) |


> **Note:** In popup mode, the included `callback.html` file handles the OAuth response. Ensure this file is served at the registered redirect URI.

## Next Steps

1. Explore the `demo-app` source code to understand how the SDK is initialized and used.
2. Refer to the [Avaya Infinity Agent SDK](https://www.npmjs.com/package/@avaya/infinity-agent-sdk) package on npm and the [API documentation](https://avaya-infinity.github.io/agent-sdk-web/) for detailed reference.
3. Use this demo application as a starting point to build your own agent desktop tailored to your business requirements.