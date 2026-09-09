import { searchCustomerAccounts } from '../../lib/salesforce';
import { withAuth } from '../../lib/session';

export default withAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { q } = req.query;
  if (!q || q.length < 2) return res.status(200).json([]);
  const accounts = await searchCustomerAccounts(q);
  return res.status(200).json(accounts);
});
