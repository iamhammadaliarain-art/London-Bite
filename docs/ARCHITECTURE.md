# London Bite Platform Architecture

## Source and deployment

GitHub is the source of truth. Vercel is the deployment platform. Production is deployed from `main`; feature work should use pull requests and Vercel previews.

## Application surface

The platform currently declares **53 operational routes** across six modules:

- Management: 20
- iPOS: 8
- Kitchen: 6
- Rider: 6
- Employee: 10
- Customer: 3

The route registry lives in `lib/platform.ts` and is exposed at `/api/platform/routes` for verification.

## Domain rules already executable

`lib/business-rules.ts` contains deterministic logic for:

- Membership discounts capped at 10%
- 2% online-payment eligibility
- Azadi 14% offer for qualifying orders from 9–14 August 2026
- Attendance geofence and late-fine rules
- Checkout window enforcement
- Rider delivery KPI thresholds

When multiple discounts are eligible, the current engine applies the single highest discount and does not stack promotions. Change this only after an explicit business-rule decision.

## Production data boundary

The current repository contains the application shell, route structure and deterministic business rules. It deliberately does **not** hardcode production credentials, management PINs, customer data, employee documents or payment secrets.

Before production data migration, connect a durable database and object storage through Vercel environment variables. Authentication must be role-scoped for Management, iPOS, Kitchen, Rider and Employee access. Customer tracking links must be order-scoped and expire after completion.

## API surface

- `GET /api/health`
- `GET /api/platform/routes`
- `POST /api/orders/quote`
- `POST /api/attendance/evaluate`

These endpoints are foundations for the production services and can be replaced by durable repository/service adapters without changing the 53-page information architecture.
