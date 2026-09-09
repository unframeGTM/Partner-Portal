import { getOpenOppForAccount } from '../../lib/salesforce';
import { withAuth } from '../../lib/session';

export default withAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { accountId } = req.query;
  if (!accountId) return res.status(400).json({ error: 'accountId required' });

  const openOpp = await getOpenOppForAccount(accountId);
  return res.status(200).json({
    hasOpenOpp: !!openOpp,
    opp: openOpp
      ? {
          name: openOpp.Name,
          stage: openOpp.StageName,
          partner: openOpp['Partner_Account__r']?.Name || null,
          owner: openOpp['Owner']?.Name || null,
        }
      : null,
  });
});
