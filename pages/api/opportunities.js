import { getOrgOpportunities, regionForTerritory } from '../../lib/salesforce';
import { withAuth } from '../../lib/session';

export default withAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const email = (req.session.email || '').toLowerCase();
  const opps = await getOrgOpportunities(req.session.partnerAccountId);

  const enriched = opps.map(o => ({
    ...o,
    // Flag the ones this specific person is tied to (their email on the deal).
    mine: !!o.Partner_Email__c && o.Partner_Email__c.toLowerCase() === email,
    territory: o.Account?.Territory__c || null,
    region: regionForTerritory(o.Account?.Territory__c),
    owner: o.Owner?.Name || null,
  }));

  return res.status(200).json(enriched);
});
