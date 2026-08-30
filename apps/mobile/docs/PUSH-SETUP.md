# Production Push Setup

Last updated: 2026-08-30

## One-time setup

1. **Apple Developer account** (required for APNs prod cert + TestFlight):
   - Create App ID matching `com.healthcare.app` (matches `app.config.js`).
   - Enable Push Notifications capability.
   - Create APNs Key (.p8), download to `apps/mobile/secrets/apns-key.p8` (gitignored).
   - Note Key ID + Team ID — set as `APPLE_TEAM_ID` env var for `eas submit`.

2. **Firebase project** (required for FCM):
   - Create project at <https://console.firebase.google.com>.
   - Add Android app with package `com.healthcare.app`.
   - Download `google-services.json` to `apps/mobile/secrets/google-services.json` (gitignored).
   - Add iOS app, download `GoogleService-Info.plist` to `apps/mobile/secrets/GoogleService-Info.plist` (gitignored).

3. **EAS CLI**:
   ```bash
   npm i -g eas-cli
   eas login
   cd apps/mobile
   eas init   # if not already linked
   ```

## Build

```bash
eas build --profile production --platform ios      # → TestFlight
eas build --profile production --platform android  # → internal track
```

## Verify push on physical device

1. Install build on physical device.
2. Login as `demo+patient1@healthhub.lk` (password `demo1234`, after running `bun run seed:demo`).
3. Trigger a notification:
   - Admin broadcast from `/admin/notifications`, OR
   - Trigger cron manually via `wrangler d1 execute` insert into `notifications`, OR
   - Book an appointment <1h ahead and wait for booking-reminders cron.
4. Confirm push arrives with correct deep link (`appointment-detail`).

## Secrets path

All push credentials live under `apps/mobile/secrets/` (gitignored):

```
apps/mobile/secrets/
├── apns-key.p8
├── google-services.json
└── GoogleService-Info.plist
```

The `apps/mobile/.gitignore` already excludes `secrets/` and `*.p8`.
