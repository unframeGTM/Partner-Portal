import jsforce from 'jsforce';

let _conn = null;

export async function getSFConnection() {
  if (_conn && _conn.accessToken) return _conn;

  const conn = new jsforce.Connection({
    loginUrl: process.env.SF_LOGIN_URL || 'https://login.salesforce.com',
  });

  await conn.login(process.env.SF_USERNAME, process.env.SF_PASSWORD);
  _conn = conn;
  return conn;
}

// ---- helpers -------------------------------------------------------------

function soql(str) {
  return String(str).replace(/'/g, "\\'");
}

// Reduce an email or URL to a bare, lowercase registrable domain:
// "Jane@Deloitte.com" -> "deloitte.com", "https://www.acme.co.uk/x" -> "acme.co.uk"
export function normalizeDomain(input) {
  if (!input) return '';
  let d = String(input).trim().toLowerCase();
  if (d.includes('@')) d = d.split('@').pop();
  d = d.replace(/^https?:\/\//, '').replace(/^www\./, '');
  d = d.split('/')[0].split('?')[0].split('#')[0];
  return d.trim();
}

function altDomainList(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[\s,;]+/)
    .map(s => normalizeDomain(s))
    .filter(s => s && s !== 'none');
}

// ---- partner identity ----------------------------------------------------

// TEST LOGINS (demo only): map specific personal emails to a partner domain so
// they can be tried without a matching corporate email. These bypass the emailed
// code — see pages/api/auth.js. Disable in production with DISABLE_TEST_LOGINS=true,
// or extend with TEST_PARTNER_LOGINS='{"me@gmail.com":"deloitte.com"}'.
export function getTestLoginDomain(email) {
  if (process.env.DISABLE_TEST_LOGINS === 'true') return null;
  const map = { 'llevitte@gmail.com': 'deloitte.com' };
  try {
    if (process.env.TEST_PARTNER_LOGINS) {
      const parsed = JSON.parse(process.env.TEST_PARTNER_LOGINS);
      for (const k of Object.keys(parsed)) map[k.trim().toLowerCase()] = normalizeDomain(parsed[k]);
    }
  } catch (_) { /* ignore malformed override */ }
  return map[(email || '').trim().toLowerCase()] || null;
}

// Match a login email to a recognized partner Account by its Website Domain
// (or an Alternate Domain). Only accounts flagged as partners (Partner_Type__c
// set) qualify. Returns the partner org plus a Contact match for display, or null.
export async function findPartnerByEmail(email) {
  const testDomain = getTestLoginDomain(email);
  const domain = testDomain || normalizeDomain(email);
  if (!domain) return null;

  const conn = await getSFConnection();
  const result = await conn.query(`
    SELECT Id, Name, Website_Domain__c, Alternate_Domains__c, Partner_Type__c, IsPartner
    FROM Account
    WHERE Partner_Type__c != null
      AND (Website_Domain__c = '${soql(domain)}' OR Alternate_Domains__c LIKE '%${soql(domain)}%')
    ORDER BY LastModifiedDate DESC
    LIMIT 25
  `);

  // Confirm an exact domain match in JS (SOQL LIKE on the comma list can match
  // substrings), preferring a primary Website_Domain__c hit over an alternate.
  const candidates = result.records || [];
  let primary = null;
  let alternate = null;
  for (const acct of candidates) {
    if (normalizeDomain(acct.Website_Domain__c) === domain) { primary = acct; break; }
    if (!alternate && altDomainList(acct.Alternate_Domains__c).includes(domain)) alternate = acct;
  }
  const account = primary || alternate;
  if (!account) return null;

  // Best-effort Contact lookup for a friendly display name; not required to log in.
  let contact = null;
  try {
    const c = await conn.query(
      `SELECT Id, Name, FirstName FROM Contact WHERE Email = '${soql(email.trim().toLowerCase())}' LIMIT 1`
    );
    contact = c.records[0] || null;
  } catch (_) { /* ignore */ }

  return {
    accountId: account.Id,
    accountName: account.Name,
    partnerType: account.Partner_Type__c || '',
    domain,
    contactId: contact?.Id || null,
    contactName: contact?.Name || null,
    firstName: contact?.FirstName || null,
    isTest: !!testDomain,
  };
}

// ---- territory -> region -------------------------------------------------

// Territory -> Region per the Unframe territory sheet
// (docs.google.com/spreadsheets/d/1ssjgmRyREDQjxKfvDZo2JrFEW_Fh3W8IY-tK3IkId04).
// The account's Region__c field uses a different, coarser taxonomy ("Americas")
// and is often blank, so region is derived from Account.Territory__c instead.
const TERRITORY_TO_REGION = {
  // North America — East
  'Northeast': 'NA East',
  'NY Metro': 'NA East',
  'Mid Atlantic': 'NA East',
  'Midwest': 'NA East',
  'Southeast': 'NA East',
  'Great Lakes': 'NA East',
  // North America — West
  'TOLA': 'NA West',
  'Great Plains': 'NA West',
  'Rocky Mountains': 'NA West',
  'Northwest': 'NA West',
  'Southwest': 'NA West',
  // Canada spans NA East and NA West in the sheet; rolled up
  'Canada': 'North America',
  // Northern Europe
  'UK/I': 'Northern Europe',
  'Benelux': 'Northern Europe',
  'DACH': 'Northern Europe',
  'Nordics': 'Northern Europe',
  // Southern Europe
  'France': 'Southern Europe',
  'Southern Europe': 'Southern Europe',
  // Central + Eastern Europe
  'CEE (Central + Eastern Europe)': 'CEE',
  'CEE': 'CEE',
  'Eastern Europe': 'CEE',
  'Central Europe': 'CEE',
  // Middle East
  'Middle East': 'Middle East',
  // APAC (not region-defined in the sheet; grouped for filtering)
  'APAC': 'APAC',
  'Japan': 'APAC',
  'Greater China': 'APAC',
  'Korea': 'APAC',
  'Bangkok City': 'APAC',
  // Other broad buckets
  'Africa': 'Africa',
  'EMEA': 'EMEA',
  'Other': 'Other',
};

export function regionForTerritory(territory) {
  if (!territory) return null;
  const key = String(territory).trim();
  if (TERRITORY_TO_REGION[key]) return TERRITORY_TO_REGION[key];
  const lower = key.toLowerCase();
  for (const k of Object.keys(TERRITORY_TO_REGION)) {
    if (k.toLowerCase() === lower) return TERRITORY_TO_REGION[k];
  }
  return null;
}

// ---- opportunities the partner can see -----------------------------------

// Every opportunity where this partner ORG is the registered partner.
export async function getOrgOpportunities(partnerAccountId) {
  const conn = await getSFConnection();
  const result = await conn.query(`
    SELECT Id, Name, StageName, Type, Amount, CloseDate, CreatedDate, LastModifiedDate,
           LeadSource, Partner_Email__c, Partner_Name__c, Partner_Sourced__c,
           Partner_Use_Case__c, AccountId, Account.Name, Account.Website,
           Account.Territory__c, Owner.Name
    FROM Opportunity
    WHERE Partner_Account__c = '${soql(partnerAccountId)}'
    ORDER BY LastModifiedDate DESC
    LIMIT 500
  `);
  return result.records || [];
}

// ---- deal registration ---------------------------------------------------

export async function searchCustomerAccounts(query) {
  const conn = await getSFConnection();
  const escaped = soql(query);
  const result = await conn.query(`
    SELECT Id, Name, Website, Website_Domain__c, Industry
    FROM Account
    WHERE Name LIKE '%${escaped}%'
    ORDER BY Name
    LIMIT 20
  `);
  return result.records || [];
}

// The most recent open opportunity already on a customer account, if any —
// used to warn a partner that a deal may already be in flight.
export async function getOpenOppForAccount(accountId) {
  const conn = await getSFConnection();
  const result = await conn.query(`
    SELECT Id, Name, StageName, Partner_Account__r.Name, Owner.Name, CreatedDate
    FROM Opportunity
    WHERE AccountId = '${soql(accountId)}'
      AND StageName NOT IN ('Closed Won', 'Closed Lost', 'Disqualified', 'Churned')
    ORDER BY CreatedDate DESC
    LIMIT 1
  `);
  return result.records[0] || null;
}

// The exact form-submission string the "Create Deal Registration Opp - Lead"
// flow keys on. Setting it makes the flow fire after the Lead is saved and
// create the Account / Contact / Opportunity / contact roles, then delete the
// Lead. Must match the flow's entry filter exactly.
const DEAL_REG_FORM_SUBMISSION = 'Partner Deal Registration | Unframe AI: Deal Registration';

// Create a Partner Deal Reg Lead that mirrors the public deal-registration form.
// The record-triggered flow does all downstream work (find-or-create Contact and
// Account, create the Opportunity and contact roles, email the partner, delete
// the Lead). The portal only writes the Lead.
export async function createDealRegistration({
  partnerAccountName,
  partnerCompany, partnerEmail, partnerFirstName, partnerLastName, distributor,
  prospectCompany, prospectEmail, prospectWebsite, prospectHQ,
  prospectFirstName, prospectLastName, prospectTitle, prospectPhone,
  closeAmount, closeDate, meetingDate, dealDescription,
}) {
  const conn = await getSFConnection();

  const today = new Date().toISOString().split('T')[0];

  // The flow derives the prospect website from the email domain and ignores HQ
  // and the meeting date, and it deletes the Lead afterward — so carry those
  // extras in the deal description, which the flow maps to Opportunity.Notes__c.
  const extras = [
    prospectHQ ? `Prospect HQ: ${prospectHQ}` : null,
    prospectWebsite ? `Prospect website: ${prospectWebsite}` : null,
    meetingDate ? `Requested meeting date: ${meetingDate}` : null,
  ].filter(Boolean).join('\n');
  const notes = [dealDescription ? dealDescription.trim() : null, extras].filter(Boolean).join('\n\n');

  const websiteUrl = prospectWebsite
    ? (prospectWebsite.startsWith('http') ? prospectWebsite : `https://${normalizeDomain(prospectWebsite)}`)
    : null;

  const lead = {
    // Prospect (the Lead itself)
    FirstName: prospectFirstName || null,
    LastName: prospectLastName || 'Unknown',
    Company: prospectCompany,
    Email: prospectEmail,
    Title: prospectTitle || null,
    Phone: prospectPhone || null,
    Website: websiteUrl,
    LeadSource: 'Partner Deal Reg',
    // Trigger the deal-registration flow
    Most_Recent_Form_Submission__c: DEAL_REG_FORM_SUBMISSION,
    Most_Recent_Form_Submission_Date__c: today,
    Most_Recent_Campaign__c: process.env.DEAL_REG_CAMPAIGN_ID || '701Hu0000025jszIAA',
    // Partner (copied by the flow onto the Opportunity)
    Partner_Company__c: partnerCompany || partnerAccountName || null,
    Partner_Email__c: partnerEmail || null,
    Partner_First_Name__c: partnerFirstName || null,
    Partner_Last_Name__c: partnerLastName || null,
    Partner_Distributor__c: distributor || null,
    // Deal (read by the flow to build the Opportunity)
    Partner_Deal_Description__c: notes || null,
    Partner_Use_Case__c: dealDescription || null,
    Partner_Close_Amount__c: closeAmount ? Number(closeAmount) : null,
    Partner_Close_Date__c: closeDate || null,
  };

  const result = await conn.sobject('Lead').create(lead);
  if (!result.success) throw new Error(result.errors.join(', '));
  return { id: result.id, leadId: result.id };
}
