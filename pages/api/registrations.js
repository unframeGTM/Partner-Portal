import { createDealRegistration, getOpenOppForAccount } from '../../lib/salesforce';
import { withAuth } from '../../lib/session';

export default withAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    customerAccountId, customerName, customerWebsite,
    useCase, estimatedAmount, closeDate,
  } = req.body;

  if (!customerAccountId && !customerName) {
    return res.status(400).json({ error: 'A customer account is required.' });
  }
  if (!customerAccountId && !customerWebsite) {
    return res.status(400).json({ error: 'A website is required for a new company (e.g. acme.com).' });
  }
  if (!useCase || !useCase.trim()) {
    return res.status(400).json({ error: 'Please describe the deal / use case.' });
  }

  const { id, accountId } = await createDealRegistration({
    partnerAccountId: req.session.partnerAccountId,
    partnerAccountName: req.session.partnerAccountName,
    partnerEmail: req.session.email,
    partnerName: req.session.name,
    customerAccountId,
    customerName,
    customerWebsite,
    useCase,
    estimatedAmount,
    closeDate,
  });

  return res.status(201).json({ id, accountId });
});
