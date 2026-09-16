import { getAllPartnerAccounts } from '../../../lib/salesforce';
import { withAdminAuth } from '../../../lib/session';

export default withAdminAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const accounts = await getAllPartnerAccounts();
  return res.status(200).json(accounts);
});
