# London Bite Platform

Official source repository for the London Bite digital platform.

## Engineering standard
- Source control: GitHub
- Deployment: Vercel
- Production branch: `main`
- Feature work: `feature/*`
- Changes reach production through reviewed pull requests
- Every pull request should receive a Vercel Preview deployment before merge

## Applications
- Customer ordering and tracking
- iPOS / counter
- Kitchen
- Rider portal and delivery tracking
- Employee portal
- Management portal

## Deployment policy
`feature/*` -> Pull Request -> checks + Vercel Preview -> review -> merge to `main` -> Vercel Production

Secrets must never be committed to GitHub. Configure them through Vercel Environment Variables.
