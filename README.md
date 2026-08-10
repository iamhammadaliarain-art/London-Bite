# London Bite Platform

Official source repository for the London Bite digital platform.

## Engineering standard
- Source control: **GitHub**
- Deployment: **Vercel**
- Production branch: `main`
- Styling: **Tailwind CSS v4 + PostCSS**
- Visual system: **iOS-inspired glassmorphism using the original London Bite logo**

## Information architecture
The application retains **53 route-addressable screens/states** while exposing **32 locked primary navigation screens**. This preserves workflow depth without cluttering role navigation.

See `docs/PRIMARY_SCREENS.md`, `docs/DESIGN_SYSTEM.md` and `docs/ARCHITECTURE.md`.

## Validation
```bash
npm install
npm run typecheck
npm run build
```

CI also starts the production server, validates health, checks the 53/32 route contract and smoke-tests representative primary and secondary routes.

## Security
Never commit production credentials, management PINs, payment secrets, employee identity documents or customer personal data. Store secrets in Vercel Environment Variables and connect durable data services server-side only.
