# Agent SDK Monorepo

This repository contains all the source code for the Agent SDK and Demo App that uses it.

> [!TIP]
> This repository is a monorepo containing multiple modules. It uses the pnpm workspaces concept.
> Please read more about workspaces concept here:
>
> - [pnpm workspaces](https://pnpm.io/workspaces)
> - [npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces)

The repo contains two modules:

- `sdk`: Contains the agent sdk code.
- `demo-app`: Contains a demo app built in react to use the agent sdk.

> [!IMPORTANT]
> All commands mentioned in this document are supposed to be run from the project root unless specified so.

## Requirements

- [Node JS](https://nodejs.org/en): `v24.12.0` (latest LTS)
  - Its recommended to install Node via `nvm`, refer [this](https://nodejs.org/en/download) for instructions.
  - Run `node -v` to verify.

## Setup

1. Run `corepack enable`.
   - In case you get permissions error, try running with `sudo` or from Administrator shell for Windows Users.
2. Run `pnpm i`

## Building

To build all the packages run `pnpm build`.

### SDK

To build the SDK, run the command `pnpm -F ./sdk build`.

### Demo App

To build the Demo App, run the command `pnpm -F ./demo-app build`.

## Running

The `SDK` doesn't run itself, the `demo-app` uses the SDK. To test SDK and demo-app you need to run the `demo-app`.

1. Make changes in SDK if any. Then run `pnpm -F ./sdk build` to build it.
2. Once SDK is build, make your changes in the `demo-app`.
3. To start the `demo-app` in dev mode where we get Vite Hot Reloading functionality, run: `pnpm -F ./demo-app dev`
4. To start the `demo-app` in prod mode, first build it using command `pnpm -F ./demo-app build` and then serve it using command `pnpm -F ./demo-app serve`.

## Documentation

The SDK uses [TypeDoc](https://typedoc.org/) to generate API documentation from JSDoc comments.

### Generate Documentation

```bash
# Build the SDK first (required to generate .d.ts files)
pnpm -F ./sdk build

# Generate documentation
pnpm -F ./sdk gen-doc
```

### View Documentation

```bash
# Start a local server to view the docs
pnpm -F ./sdk host-docs
```

Then open http://localhost:8888 in your browser.

### Documentation Output

Generated documentation is placed in `sdk/docs/` (ignored by git). The docs are generated from the bundled `.d.ts` file to ensure only public API is documented.

## Utility

### Managing Packages

#### Rules for managing dependencies

1. Common dependencies between all projects have to `devDependencies`. These type of dependencies are used at the time of development like compilers, linters etc. **Any runtime dependency that is also required by all project must be individually added to each project.** This is required because common dependencies placed in the root package.json won't be included in the project's package.json when its published to npm.
2. Dependencies (dev/runtime) required exclusively by a project should only be added to that project.
3. Packages not required in runtime are `devDependencies`.

#### Add a package to the project root (root workspace)

```bash
pnpm add <package-name> -w
```

_Installs the package in the root (workspace) `package.json`._

Note: Add `-D` or `--save-dev` flag to the command to save a package as `devDependency`.

#### Add a package to a specific project (workspace/package)

```bash
pnpm add <package-name> --filter <workspace-name>
```

_Installs the package in only the specified workspace. Replace `<workspace-name>` with the name or path of the workspace as defined in your `pnpm-workspace.yaml` or `package.json`._

```bash
# Alternatively
pnpm -F ./<workspace-folder-name> add <package-name>
# Example
pnpm -F ./demo-app add react
```

Note:  Add `-D` or `--save-dev` flag to the command to save a package as `devDependency`.

#### Remove a package from the project root (root workspace)

```bash
pnpm remove <package-name> -w
```

#### Remove a package from a specific project (workspace/package)

```bash
pnpm remove <package-name> --filter <workspace-name>
```

### Running Scripts

#### Run a script defined in the root `package.json`

```bash
pnpm run <script-name>
```

#### Run a script in a specific project (workspace/package)

```bash
pnpm run <script-name> --filter <workspace-name>
# Alternatively
pnpm -F ./<workspace-folder-name> add <package-name>
# Example
pnpm -F ./demo-app add react
```
