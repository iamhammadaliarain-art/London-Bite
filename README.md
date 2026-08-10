# London Bite Platform

Official source repository for the London Bite digital platform.

## Engineering standard

- **Source control:** GitHub
- **Deployment:** Vercel
- **Production branch:** `main`
- **Styling:** Tailwind CSS v4 + PostCSS
- **Feature work:** `feature/*`
- **Release path:** Pull Request → CI → Vercel Preview → review → merge → Production

## Current application

This repository contains the operational application shell for Management, iPOS, Kitchen, Rider, Employee and Customer workflows.

The platform keeps **53 route-addressable screens/states** while exposing **32 locked primary navigation screens**. Secondary workflow routes remain available for deep links and state-specific operations without cluttering the primary UI.

See [`docs/PRIMARY_SCREENS.md`](docs/PRIMARY_SCREENS.md) for the locked primary information architecture and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the foundation/backend boundary.

## Local development

```bash
npm install
npm run dev
```

Validation:

```bash
npm run typecheck
npm run build
```

## Security

Never commit production credentials, management PINs, payment secrets, employee identity documents or customer personal data. Store secrets in Vercel Environment Variables and connect durable data services through server-side adapters.
