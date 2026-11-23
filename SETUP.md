# Development setup

The Twenty app tooling (`twenty` CLI, SDK) runs on **macOS or Linux**. On Windows, work inside **WSL 2** and keep this repo in the WSL file system (e.g. `~/code/twenty-crm-plugin`): `twenty app dev` watches files and is slow or unreliable on a mounted Windows drive.

## Tools

```bash
nvm install 24 && corepack enable          # Node from .nvmrc, Yarn 4
npm install -g twenty                      # the CLI version must match twenty-sdk in package.json
yarn install
```

## A local Twenty

Use TrueBeep's compose file (`truebeep/scripts/dev/twenty/docker-compose.yml`) with this repo's override, which lets Twenty run app code:

```bash
cd <truebeep>/scripts/dev/twenty
TAG=v2.61.0 TWENTY_PORT=3022 docker compose -p twenty-app \
  -f docker-compose.yml -f <this repo>/dev/twenty.override.yml up -d
```

- `LOGIC_FUNCTION_TYPE=LOCAL`: Twenty ships with app functions disabled.
- `SERVER_INTERNAL_URL`: functions call Twenty on its in-container port; the host-mapped `localhost:3022` doesn't exist inside the container.

Open `http://localhost:3022`, create a workspace, then create an API key (Settings → Developers → API) and log the CLI in with it. Browser sign-in only works in an interactive terminal.

```bash
printf '%s' "$TWENTY_API_KEY" | twenty auth login --with-token --url http://localhost:3022 --name local --use
twenty app apply --create      # first time: register and install
twenty app apply               # afterwards (or `twenty app dev` to watch)
```

## A local TrueBeep

The app talks to the TrueBeep **processor** (`/v1`), and bulk sends also go through the **truebeep** app (`/api/campaigns/internal`).

1. Postgres and Redis: `docker compose up -d postgres redis-stack` in the truebeep repo.
2. Schema: run the `migration` repo against an empty `truebeep` database (`pnpm migrate`), then in truebeep `pnpm db:seed` and `pnpm db:test-user`.
3. Install the processor and truebeep with **pnpm 11.1.3**, the version their Dockerfile and CI use (`npx pnpm@11.1.3 install --frozen-lockfile`).
4. Start the processor **with send credentials disabled**, so nothing can reach a real person:

   ```bash
   APP_ENV=local CRM_ALLOW_PRIVATE_HOSTS=localhost \
   AWS_ACCESS_KEY_ID=invalid AWS_SECRET_ACCESS_KEY=invalid SMTP_HOST=127.0.0.1 SMTP_PORT=1 \
   FLAG_ENABLE_WORKFLOWS=true PORT=7001 ./node_modules/.bin/ts-node -r tsconfig-paths/register src/app.ts
   ```

   `CRM_ALLOW_PRIVATE_HOSTS=localhost` lets it post activity events to local Twenty. Use `ts-node` without `--transpile-only`: TypeORM needs the type metadata.
5. For bulk sends, start truebeep too: `pnpm dev` (port 3001).
6. Insert an API key for a test team (`api_clients`) and paste it into the app's connection.
7. Point the app at the processor: **Settings → Apps → TrueBeep → Variables → TrueBeep API URL**. Twenty runs in Docker, so use an address the container can reach. With Kiri on Windows, `host.docker.internal` is Kiri's own VM; use the Windows address on the WSL adapter, e.g. `http://172.25.96.1:7001`.

## OAuth locally ("Connect TrueBeep")

The connection's resource is fixed in the manifest (`https://api.truebeep.com/mcp`). For a local or staging TrueBeep, build with your own:

```bash
TRUEBEEP_OAUTH_RESOURCE_URL=http://172.25.96.1:7001/mcp twenty app apply
```

TrueBeep needs `NEXT_PUBLIC_FLAG_ENABLE_MCP=true`, `OAUTH_ISSUER`, `MCP_RESOURCE_URL` and an ES256 `OAUTH_JWT_PRIVATE_KEY`; the processor needs `FLAG_ENABLE_MCP=true` and the same issuer and resource. The issuer and TrueBeep's `SITE_URL` must be one host that both your browser and the Twenty container reach (on Windows with Kiri: the WSL-adapter address), and Twenty must be allowed to call it: `TWENTY_ALLOWED_INTERNAL_HOSTS=host.docker.internal,172.25.96.1` when starting the compose stack. The signed-in TrueBeep user must be an active member of a team with a role.

## Checks

- `yarn lint`, `yarn typecheck`, `yarn test:unit`: run all three after every change.
- `yarn test`: integration tests against a disposable workspace (`TWENTY_API_URL`, `TWENTY_API_KEY`).
- UI changes: apply, open the surface in the local Twenty, and check it end to end (panel, composer, campaign mode, settings, timeline).
- Unit tests must fail when the guarded behaviour is removed (consent, signature, 401 handling). Remove it once to check.
