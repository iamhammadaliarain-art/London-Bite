# London Bite Platform

Official source repository for the London Bite digital platform.

## Engineering standard

- **Source control:** GitHub
- **Deployment:** Vercel
- **Production branch:** `main`
- **Feature work:** `feature/*`
- **Release path:** Pull Request → CI → Vercel Preview → review → merge → Production

## Current application

This repository now contains the operational application shell for:

- Management
- iPOS / counter
- Kitchen
- Rider and delivery tracking
- Employee portal
- Customer tracking

The platform declares **53 routes** from one typed route registry and includes executable rules for discounts, attendance/geofence fines, checkout windows and rider KPIs.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the migration boundary and backend plan.

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
