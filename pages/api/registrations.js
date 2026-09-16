import { createDealRegistration } from '../../lib/salesforce';
import { withAuth } from '../../lib/session';

export default withAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const b = req.body || {};

  // Required fields, mirroring the public deal-registration form.
  const required = {
    'Partner Company': b.partnerCompany,
    'Partner Email': b.partnerEmail,
    'Partner First Name': b.partnerFirstName,
    'Partner Last Name': b.partnerLastName,
    'Prospect Company': b.prospectCompany,
    'Prospect Email': b.prospectEmail,
    'Prospect Company Website': b.prospectWebsite,
    'Prospect Company HQ': b.prospectHQ,
    'Prospect First Name': b.prospectFirstName,
    'Prospect Last Name': b.prospectLastName,
    'Estimated Close Amount': b.closeAmount,
    'Estimated Close Date': b.closeDate,
    'Deal Description': b.dealDescription,
  };
  const missing = Object.keys(required).filter(k => !String(required[k] ?? '').trim());
  if (missing.length) {
    return res.status(400).json({ error: `Please complete: ${missing.join(', ')}.` });
  }

  const { id } = await createDealRegistration({
    partnerAccountName: req.session.partnerAccountName,
    partnerCompany: b.partnerCompany,
    partnerEmail: b.partnerEmail,
    partnerFirstName: b.partnerFirstName,
    partnerLastName: b.partnerLastName,
    distributor: b.distributor,
    prospectCompany: b.prospectCompany,
    prospectEmail: b.prospectEmail,
    prospectWebsite: b.prospectWebsite,
    prospectHQ: b.prospectHQ,
    prospectFirstName: b.prospectFirstName,
    prospectLastName: b.prospectLastName,
    prospectTitle: b.prospectTitle,
    prospectPhone: b.prospectPhone,
    closeAmount: b.closeAmount,
    closeDate: b.closeDate,
    meetingDate: b.meetingDate,
    dealDescription: b.dealDescription,
  });

  return res.status(201).json({ id });
});
