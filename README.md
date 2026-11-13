# Pozea

Pozea is an AI personal photographer: it guides you into a pose on the camera screen and takes the photo when the pose matches. The architecture is described in the "Pozea system architecture" document in Amp.

## Repository layout

```text
apps/
  landing/    Landing page and waitlist (plain HTML, CSS, JS; Brevo form). No build step.
  mobile/     The app: React Native + Expo (TypeScript), Expo Router.
supabase/
  migrations/ Postgres schema and Row Level Security, one timestamped SQL file per change.
```

Inside `apps/mobile/src/`:

```text
app/        Routes (Expo Router). Every file is a screen; keep other code out of here.
core/       Theme tokens and shared UI.
features/   One folder per feature (setup, pose catalog, camera, pose engine, ...).
data/       Repositories: the only code that talks to Supabase, R2, or SQLite (added in phase 1).
```

## Commands

Landing page:

```sh
cd apps/landing
python3 -m http.server 8000   # or VS Code Live Server
```

Mobile app:

```sh
cd apps/mobile
npm install
npx expo start      # dev server; camera features need a development build, not Expo Go
npm run lint
npm run typecheck
npx expo install <package>   # add dependencies with this, so versions match the Expo SDK
```

Database:

```sh
supabase db push    # apply supabase/migrations to the linked Supabase project
```

## Conventions

- TypeScript everywhere outside the landing page. Code, identifiers, and comments are in English; user-facing copy is in Indonesian.
- Pose scoring and other logic stays in pure TypeScript under `features/`, with no camera or React imports, so it can be unit tested.
- Per-frame camera data lives in Reanimated shared values and is drawn with Skia, never in React state.
- Every table has Row Level Security. The app only holds the Supabase anon key; service keys and AI keys live in Edge Function secrets.
- The database stores R2 object keys, not full URLs.
- Migrations only add. Drop a column only after no released app version reads it.
