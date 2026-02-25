# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Meridian is a pnpm + Turborepo monorepo with two apps (`apps/web` Next.js, `apps/mobile` Expo) and four shared packages (`packages/api`, `packages/types`, `packages/ui`, `packages/inngest`). See root `package.json` for available scripts (`dev`, `build`, `lint`, `typecheck`, `format`).

### Prerequisites (already installed in the VM snapshot)

- **Node.js 22**, **pnpm 9.15.4** (matches `packageManager` field)
- **Docker** with `fuse-overlayfs` storage driver and `iptables-legacy` (required for nested container environment)
- **Supabase CLI** (installed from GitHub `.deb` release)

### Starting services

1. **Start Docker** (if not already running): `sudo dockerd &>/tmp/dockerd.log &` — wait a few seconds.
2. **Fix Docker socket permissions** (if needed): `sudo chmod 666 /var/run/docker.sock`
3. **Start Supabase local**: `supabase start` from the workspace root. This pulls/starts ~13 Docker containers (Postgres, Auth, REST, Storage, Studio, etc.) and applies migrations. First run takes ~90s; subsequent runs are faster.
4. **Configure env vars**: After `supabase start`, run `supabase status -o env` to get the keys, then create `apps/web/.env.local` with:
   ```
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from status output>
   SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from status output>
   ```
5. **Start Next.js dev server**: `pnpm dev` from root (uses Turborepo to start all apps with `dev` scripts). The web app runs on `http://localhost:3000`.

### Key caveats

- The Google OAuth env vars (`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`) are not set locally; `supabase start` warns about them but still works. Email/password auth works without Google credentials.
- The `@meridian/mobile` app has pre-existing lint and typecheck errors related to the `@/` path alias not being mapped in its `tsconfig.json` or ESLint config. This does not affect the web app.
- `eslint-config-next` must match the Next.js major version (v15). Installing v16 causes circular JSON errors with the legacy `.eslintrc.json` format.
- Inngest is stubbed (event schemas only, no functions wired up). The app runs fine without it.
- The Supabase local anon/service-role JWT keys are deterministic demo keys and do not change between `supabase start` runs.

### Running checks

- **Lint**: `pnpm lint` (runs `turbo lint` — only `@meridian/web` and `@meridian/mobile` have lint scripts)
- **Typecheck**: `pnpm typecheck` (runs `turbo typecheck` across all 6 packages)
- **Build**: `pnpm build` (runs `turbo build` — only `@meridian/web` produces a build)
- **Format**: `pnpm format` (runs Prettier)
