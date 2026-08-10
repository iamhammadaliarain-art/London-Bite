# London Bite Platform Architecture

## Source and deployment
GitHub is the source of truth. Vercel is the deployment platform. Production is deployed from `main` after CI is green.

## Information architecture
The platform keeps **53 route-addressable screens/states** but exposes **32 primary navigation screens**:
- Management: 13 primary / 20 total
- iPOS: 5 primary / 8 total
- Kitchen: 3 primary / 6 total
- Rider: 4 primary / 6 total
- Employee: 6 primary / 10 total
- Customer: 1 primary / 3 total

The registries live in `lib/platform.ts`; `/api/platform/routes` exposes both counts for automated verification.

## Styling foundation
Tailwind CSS v4 + PostCSS is the standard. London Bite brand tokens live in `app/globals.css`. The UI follows the locked iOS-inspired glassmorphism rule in `docs/DESIGN_SYSTEM.md`, and uses the original logo asset under `public/brand/`.

## Domain rules already executable
`lib/business-rules.ts` contains deterministic logic for membership discounts, online-payment eligibility, the current promotional rule, attendance/geofence fines, checkout windows and rider KPI thresholds.

## Production data boundary
The foundation deliberately contains no production credentials, employee identity documents, payment secrets or live customer data. Durable database/storage and role-scoped authentication are backend work and remain gated behind the foundation checks.
