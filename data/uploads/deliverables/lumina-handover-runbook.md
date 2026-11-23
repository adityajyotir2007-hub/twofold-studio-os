# Lumina Capital Ventures — Production Handover & Runbook
**Live URL:** https://luminacapital.vc
**Staging URL:** https://lumina-staging.twofold.studio
**Lighthouse Score:** 100 Performance / 100 Accessibility / 100 Best Practices / 100 SEO

## Deployment Architecture
- Hosted on Vercel Enterprise Edge Network (Paris cdg1 & Frankfurt fra1)
- Automated CI/CD via GitHub main branch protection
- Zero-downtime ISR cache revalidation configured via webhook