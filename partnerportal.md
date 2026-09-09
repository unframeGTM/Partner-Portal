# Partner Portal

Partner-facing portal for Unframe. Partners sign in with their work email, see the
Unframe opportunities their organization is tied to, and register new deals that land
in Salesforce as opportunities immediately.

Built on the same foundation as the Ambassador Portal: Next.js (Pages Router),
`jsforce`, `iron-session`, and email one-time-code login. Same Unframe branding.

## Links

- **Live site:** https://partner-portal-unframe.vercel.app
- **GitHub:** https://github.com/unframeGTM/Partner-Portal (branch `main`)
- **Vercel project:** `partner-portal` (id `prj_2EhDBBU57VKsJc1oe4KYO9cXUXkk`), team `unframe`
- **Local path:** `~/Claude Code/partner-portal`

## How it works

### Login
A partner enters their work email and receives a 6-digit code by email. Access is
granted only when the email's domain matches a **recognized partner Account** in
Salesforce: the domain equals `Account.Website_Domain__c` or appears in
`Account.Alternate_Domains__c` (a comma list), and that account has `Partner_Type__c`
set (Reseller / Referral / Strategy & Execution). `IsPartner` is not used because it is
unreliable (false even for Deloitte and PwC).

Example: `jane@deloitte.com` resolves to the Deloitte partner account.

### Dashboard
- **Org pipeline:** every opportunity where the partner's org is the registered partner
  (`Opportunity.Partner_Account__c` = the partner's account).
- **Registered by me:** a toggle and a "You" tag for deals where the signed-in person's
  email is on the opp (`Opportunity.Partner_Email__c`).
- **Accounts tab:** the same deals rolled up by end customer, with open/won counts.

### Deal registration
Submitting a deal **creates a Salesforce Opportunity immediately** (Option A), modeled
field-for-field on reference opp `006aZ00000d6dLBQAY`:

| Field | Value |
| --- | --- |
| `StageName` | `Stage 0` |
| `Type` | `New Business` |
| `LeadSource` | `Partner Deal Reg` |
| `CampaignId` (primary campaign) | `701Hu0000025jszIAA` — "Website - Deal Registration" |
| `Partner_Account__c` | the partner's org |
| `Partner_Sourced__c` | `true` |
| `Partner_Email__c` / `Partner_Name__c` / `Partner_Domain__c` | the partner person |
| `Partner_Use_Case__c` | the submitted use case |
| `AccountId` | the end customer (matched or created) |
| `Amount`, `CloseDate` | optional; CloseDate defaults to today + 90 days |

The Unframe team reviews and advances the stage from there. If the selected customer
already has an open opp, the form warns the partner but still lets them submit; Unframe
de-dupes.

## Salesforce fields used

| Purpose | Field |
| --- | --- |
| Partner org domain match | `Account.Website_Domain__c`, `Account.Alternate_Domains__c` |
| "Is a partner" gate | `Account.Partner_Type__c` |
| Org ↔ opportunity tie | `Opportunity.Partner_Account__c` |
| Person ↔ opportunity tie | `Opportunity.Partner_Email__c` |
| Deal-reg provenance | `Partner_Sourced__c`, `Partner_Name__c`, `Partner_Domain__c`, `Partner_Use_Case__c` |

## Code map

```
lib/salesforce.js        SF connection, partner match, opp queries, deal-reg create
lib/session.js           iron-session config (cookie: partner_session) + withAuth guard
pages/index.js           Login (email -> code -> verify)
pages/dashboard.js       Pipeline + Accounts views, filters, "registered by me"
pages/register.js        Deal registration form
pages/api/auth.js        Send/verify code, gate to partner orgs, set session
pages/api/me.js          Session identity for the dashboard
pages/api/opportunities.js  Org opps, flags each as mine/not
pages/api/accounts.js    Customer account search (deal-reg picker)
pages/api/check-account.js  Warns if a customer already has an open opp
pages/api/registrations.js  Creates the deal-reg opportunity
styles/globals.css       Unframe brand tokens + components
```

## Deploy pipeline

One direction: **GitHub is the source of truth, Vercel deploys from it.**

1. Edit code, commit, push to `main` on GitHub.
2. Vercel sees the push and auto-builds/deploys to production (~1 min).

Changes made in the Vercel dashboard (settings, env vars, redeploy) do **not** write
back to GitHub. To change the app, always go through GitHub.

## Environment variables (set in Vercel, not in the repo)

| Var | Notes |
| --- | --- |
| `SESSION_SECRET` | random 32+ chars; generate fresh (do not reuse ambassador's) |
| `SF_LOGIN_URL` | `https://login.salesforce.com` |
| `SF_USERNAME` | SF integration user (copy from ambassador-portal) |
| `SF_PASSWORD` | password + security token (copy from ambassador-portal) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | mailer (copy from ambassador-portal) |
| `SMTP_FROM` | `Unframe Partner Portal <partners@unframe.ai>` |
| `DEAL_REG_CAMPAIGN_ID` | defaults to `701Hu0000025jszIAA` if unset |
| `DEAL_REG_OWNER_ID` | optional; if set, registered opps are owned by this user, else the integration user |

Names (no values) are also in `.env.example` in the repo. After adding or changing env
vars in Vercel, redeploy so the functions pick them up.

## Open items

- **Env vars** must be added in Vercel before login works. Until then the site builds and
  serves but auth returns a 500.
- **Repo visibility:** the GitHub repo is currently public. No secrets are in it, but
  consider switching it to Private.
- **Deal-reg owner:** registered opps default to the integration user. Set
  `DEAL_REG_OWNER_ID` to route them to a partner manager or queue.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in values; SF_* and SMTP_* required for live login
npm run dev
```

## History

Created 2026-09-08. Cloned from the Ambassador Portal foundation. Login gating,
deal-reg stage/campaign, and the org/person opportunity ties were confirmed against
live Salesforce before build.
