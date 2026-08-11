# London Bite Native App

Pre-store native customer client for Android and iOS using Expo SDK 57 / React Native 0.86.

Implemented before store activation:
- Live London Bite menu via the same Supabase RPC boundary as the web app.
- Native cart and quantity controls.
- Delivery / pickup cash checkout.
- Scheduled orders and referral attribution through `lb_create_order_v2`.
- Private order tracking with automatic refresh.
- Shared server-authoritative pricing, availability, order state and security rules.
- EAS `preview` and `production` build profiles.

Run locally from this directory:

```bash
npm install
npm run start
```

Validation / activation boundary:
- `npm run typecheck` should be run in an environment with npm registry access before the first native binary build.
- Store signing, Apple Developer / App Store Connect, Google Play Console and final submission are deliberately deferred until the real developer accounts are supplied.
- Final app icon, screenshots, store metadata and bundle ownership should be confirmed before the first signed production build.
