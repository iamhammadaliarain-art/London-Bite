# London Bite Foundation Gate

Backend work is blocked until this checklist is green.

- [ ] GitHub CI installs dependencies successfully
- [ ] TypeScript strict typecheck passes
- [ ] Next.js production build passes
- [ ] All 53 declared application routes are generated
- [ ] `/api/health` builds and responds
- [ ] `/api/platform/routes` reports the route registry
- [ ] Vercel production deployment reaches READY
- [ ] Production alias serves the application
- [ ] `londonbite.com` is attached only after a verified READY deployment

No production database, authentication secrets, employee documents, payment credentials, or live customer data should be connected before this gate passes.
