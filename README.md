# Unframe Partner Portal

A partner-facing portal built on the same foundation as the Ambassador Portal:
Next.js (Pages Router) + `jsforce` + `iron-session`, with email one-time-code login.

## What it does

- **Login by work email.** A partner enters their work email and receives a 6-digit
  code. Access is granted only when the email domain matches a **recognized partner
  Account** in Salesforce (`Account.Website_Domain__c` or `Alternate_Domains__c`, and
  the account has `Partner_Type__c` set). Example: `jane@deloitte.com` → the Deloitte
  partner account.
- **Pipeline visibility.** The dashboard shows every opportunity where the partner's
  organization is the registered partner (`Opportunity.Partner_Account__c`), and flags
  the ones the signed-in person is specifically tied to (`Opportunity.Partner_Email__c`).
  An Accounts tab rolls the deals up by end customer.
- **Deal registration.** Submitting a deal **immediately creates an Opportunity**
  (Option A) modeled on Unframe's reference deal-reg opp:
  - `StageName = "Stage 0"`, `Type = "New Business"`
  - `LeadSource = "Partner Deal Reg"`
  - Primary campaign = **"Website - Deal Registration"**
  - `Partner_Account__c` = the partner org, `Partner_Sourced__c = true`,
    `Partner_Email__c` / `Partner_Name__c` / `Partner_Domain__c` = the partner person,
    `Partner_Use_Case__c` = the submitted use case.

  The Unframe team advances the stage from there (or disqualifies it).

## Salesforce fields used

| Purpose | Field |
| --- | --- |
| Partner org domain match | `Account.Website_Domain__c`, `Account.Alternate_Domains__c` |
| "Is a partner" gate | `Account.Partner_Type__c` |
| Org ↔ opportunity tie | `Opportunity.Partner_Account__c` |
| Person ↔ opportunity tie | `Opportunity.Partner_Email__c` |
| Deal-reg provenance | `Partner_Sourced__c`, `Partner_Name__c`, `Partner_Domain__c`, `Partner_Use_Case__c` |

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the values (see below)
npm run dev
```

Live login needs valid `SF_*` and `SMTP_*` values (the same integration user and
mailer the Ambassador Portal uses). Set them in `.env.local` locally and in the
Vercel project for production.

## Deployment

Push to `main` → Vercel builds and deploys, same as the Ambassador Portal.
