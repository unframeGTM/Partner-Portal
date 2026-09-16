import { getOrgOpportunities, regionForTerritory } from '../../../lib/salesforce';
import { withAdminAuth } from '../../../lib/session';

export default withAdminAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { accountId } = req.query;
  if (!accountId) return res.status(400).json({ error: 'accountId required' });

  const opps = await getOrgOpportunities(accountId);
  const enriched = opps.map(o => ({
    ...o,
    territory: o.Account?.Territory__c || null,
    region: regionForTerritory(o.Account?.Territory__c),
    owner: o.Owner?.Name || null,
  }));
  return res.status(200).json(enriched);
});
