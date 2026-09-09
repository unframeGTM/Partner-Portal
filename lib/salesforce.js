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

// Match a login email to a recognized partner Account by its Website Domain
// (or an Alternate Domain). Only accounts flagged as partners (Partner_Type__c
// set) qualify. Returns the partner org plus a Contact match for display, or null.
export async function findPartnerByEmail(email) {
  const domain = normalizeDomain(email);
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
  };
}

// ---- opportunities the partner can see -----------------------------------

// Every opportunity where this partner ORG is the registered partner.
export async function getOrgOpportunities(partnerAccountId) {
  const conn = await getSFConnection();
  const result = await conn.query(`
    SELECT Id, Name, StageName, Type, Amount, CloseDate, CreatedDate, LastModifiedDate,
           LeadSource, Partner_Email__c, Partner_Name__c, Partner_Sourced__c,
           Partner_Use_Case__c, AccountId, Account.Name, Account.Website,
           Owner.Name
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

async function resolveCustomerAccount(conn, { customerAccountId, customerName, customerWebsite }) {
  if (customerAccountId) return customerAccountId;
  if (!customerWebsite) throw new Error('A website/domain is required for a new company.');

  const domain = normalizeDomain(customerWebsite);
  const existing = await conn.query(
    `SELECT Id FROM Account WHERE Website_Domain__c = '${soql(domain)}' OR Website LIKE '%${soql(domain)}%' LIMIT 1`
  );
  if (existing.records.length > 0) return existing.records[0].Id;

  const created = await conn.sobject('Account').create({
    Name: customerName,
    Website: customerWebsite.startsWith('http') ? customerWebsite : `https://${domain}`,
    Website_Domain__c: domain,
  });
  if (!created.success) throw new Error('Could not create account: ' + created.errors.join(', '));
  return created.id;
}

// Create the Opportunity for a submitted deal registration. Modeled on the
// reference deal-reg opp: Stage 0, New Business, LeadSource "Partner Deal Reg",
// primary campaign "Website - Deal Registration", partner-sourced.
export async function createDealRegistration({
  partnerAccountId, partnerAccountName, partnerEmail, partnerName,
  customerAccountId, customerName, customerWebsite,
  useCase, estimatedAmount, closeDate,
}) {
  const conn = await getSFConnection();

  const accountId = await resolveCustomerAccount(conn, { customerAccountId, customerName, customerWebsite });

  const displayName = customerName || 'New Company';
  const useCaseTitle = (useCase || '').trim().split('\n')[0].slice(0, 60);
  const oppName = `${displayName} - ${useCaseTitle || 'Use Case TBD'}`;

  const defaultClose = new Date();
  defaultClose.setDate(defaultClose.getDate() + 90);
  const closeIso = closeDate || defaultClose.toISOString().split('T')[0];

  const fields = {
    Name: oppName,
    AccountId: accountId,
    StageName: 'Stage 0',
    Type: 'New Business',
    LeadSource: 'Partner Deal Reg',
    CampaignId: process.env.DEAL_REG_CAMPAIGN_ID || '701Hu0000025jszIAA',
    CloseDate: closeIso,
    Partner_Account__c: partnerAccountId,
    Partner_Sourced__c: true,
    Partner_Email__c: partnerEmail || null,
    Partner_Name__c: partnerName || partnerAccountName || null,
    Partner_Domain__c: normalizeDomain(partnerEmail) || null,
    Partner_Use_Case__c: useCase || null,
  };
  if (estimatedAmount) fields.Amount = Number(estimatedAmount);
  if (process.env.DEAL_REG_OWNER_ID) fields.OwnerId = process.env.DEAL_REG_OWNER_ID;

  const result = await conn.sobject('Opportunity').create(fields);
  if (!result.success) throw new Error(result.errors.join(', '));
  return { id: result.id, accountId };
}
