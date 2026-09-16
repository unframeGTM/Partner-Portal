import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

const EMPTY = {
  partnerCompany: '', partnerEmail: '', partnerFirstName: '', partnerLastName: '', distributor: '',
  prospectCompany: '', prospectEmail: '', prospectWebsite: '', prospectHQ: '',
  prospectFirstName: '', prospectLastName: '', prospectTitle: '', prospectPhone: '',
  closeAmount: '', closeDate: '', meetingDate: '', dealDescription: '',
};

const REQUIRED = [
  'partnerCompany', 'partnerEmail', 'partnerFirstName', 'partnerLastName',
  'prospectCompany', 'prospectEmail', 'prospectWebsite', 'prospectHQ',
  'prospectFirstName', 'prospectLastName', 'prospectTitle',
  'closeAmount', 'closeDate', 'dealDescription',
];

function Field({ label, name, required, type = 'text', value, onChange, placeholder, textarea }) {
  return (
    <div className="form-group">
      <label htmlFor={name}>
        {label}{required && <span className="req">*</span>}
      </label>
      {textarea ? (
        <textarea id={name} name={name} value={value} onChange={onChange} placeholder={placeholder} required={required} />
      ) : (
        <input id={name} name={name} type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} autoComplete="off" />
      )}
    </div>
  );
}

export default function Register() {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  // Pre-fill the partner section from the signed-in partner's session.
  useEffect(() => {
    fetch('/api/me')
      .then(r => (r.ok ? r.json() : null))
      .then(me => {
        if (!me) return;
        const parts = (me.name || '').trim().split(/\s+/).filter(Boolean);
        setForm(f => ({
          ...f,
          partnerCompany: me.partnerAccountName || '',
          partnerEmail: me.email || '',
          partnerFirstName: parts[0] || '',
          partnerLastName: parts.length > 1 ? parts.slice(1).join(' ') : '',
        }));
      })
      .catch(() => {});
  }, []);

  function update(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const missing = REQUIRED.filter(k => !String(form[k] ?? '').trim());
    if (missing.length) {
      setError('Please complete all required fields marked with *.');
      return;
    }
    setLoading(true);
    setError('');

    const res = await fetch('/api/registrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 1800);
    } else {
      const data = await res.json();
      setError(data.error || 'Submission failed.');
      setLoading(false);
    }
  }

  const v = name => form[name];

  return (
    <>
      <nav className="nav">
        <img src="/logo-on-dark.svg" alt="Unframe" className="nav-logo" />
        <span className="nav-user">
          <Link href="/dashboard" className="btn btn-secondary btn-sm">Back to dashboard</Link>
        </span>
      </nav>

      <div className="reg-page">
        <div className="container">
          <div className="reg-hero">
            <span className="reg-pill">Partners</span>
            <h1>Register an Opportunity</h1>
            <p>Fill out the registration form to provide details about your opportunity. We’ll follow up with you shortly.</p>
          </div>

          {success && (
            <div className="success-msg">Opportunity registered. It’s now in Unframe’s pipeline. Redirecting…</div>
          )}
          {error && <div className="error-msg">{error}</div>}

          <form onSubmit={handleSubmit} className="reg-card">
            <div className="form-section">Partner Information</div>
            <div className="field-row">
              <Field label="Partner Company" name="partnerCompany" required value={v('partnerCompany')} onChange={update} />
              <Field label="Partner Email" name="partnerEmail" type="email" required value={v('partnerEmail')} onChange={update} />
            </div>
            <div className="field-row">
              <Field label="Partner First Name" name="partnerFirstName" required value={v('partnerFirstName')} onChange={update} />
              <Field label="Partner Last Name" name="partnerLastName" required value={v('partnerLastName')} onChange={update} />
            </div>
            <Field label="Distributor" name="distributor" value={v('distributor')} onChange={update} placeholder="If this deal is through a distributor" />

            <div className="form-section">Prospect Information</div>
            <div className="field-row">
              <Field label="Prospect Company" name="prospectCompany" required value={v('prospectCompany')} onChange={update} />
              <Field label="Prospect Email" name="prospectEmail" type="email" required value={v('prospectEmail')} onChange={update} />
            </div>
            <div className="field-row">
              <Field label="Prospect Company Website" name="prospectWebsite" required value={v('prospectWebsite')} onChange={update} placeholder="e.g. acme.com" />
              <Field label="Prospect Company HQ" name="prospectHQ" required value={v('prospectHQ')} onChange={update} placeholder="City, Country" />
            </div>
            <div className="field-row">
              <Field label="Prospect First Name" name="prospectFirstName" required value={v('prospectFirstName')} onChange={update} />
              <Field label="Prospect Last Name" name="prospectLastName" required value={v('prospectLastName')} onChange={update} />
            </div>
            <div className="field-row">
              <Field label="Prospect Title" name="prospectTitle" required value={v('prospectTitle')} onChange={update} />
              <Field label="Prospect Phone" name="prospectPhone" type="tel" value={v('prospectPhone')} onChange={update} />
            </div>

            <div className="form-section">Deal Information</div>
            <div className="field-row">
              <Field label="Estimated Close Amount" name="closeAmount" type="number" required value={v('closeAmount')} onChange={update} placeholder="e.g. 100000" />
              <Field label="Estimated Close Date" name="closeDate" type="date" required value={v('closeDate')} onChange={update} />
            </div>
            <Field label="Prospect Date of Meeting" name="meetingDate" type="date" value={v('meetingDate')} onChange={update} />
            <Field label="Deal Description" name="dealDescription" required textarea value={v('dealDescription')} onChange={update} placeholder="Describe the opportunity: the use case, the buyer, and why now." />

            <button className="btn btn-primary btn-lg" type="submit" disabled={loading || success}>
              {loading ? 'Registering…' : 'Register opportunity'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
