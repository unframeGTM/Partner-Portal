import { withAuth } from '../../lib/session';

export default withAuth(async function handler(req, res) {
  const { partnerAccountId, partnerAccountName, partnerType, name, email } = req.session;
  return res.status(200).json({ partnerAccountId, partnerAccountName, partnerType, name, email });
});
