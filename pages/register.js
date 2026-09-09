import { useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Register() {
  const [accountQuery, setAccountQuery] = useState('');
  const [accountSuggestions, setAccountSuggestions] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [openOppWarning, setOpenOppWarning] = useState(null);
  const [isNewCompany, setIsNewCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyWebsite, setNewCompanyWebsite] = useState('');
  const [useCase, setUseCase] = useState('');
  const [estimatedAmount, setEstimatedAmount] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const searchTimeout = useRef(null);
  const router = useRouter();

  function handleAccountInput(e) {
    const val = e.target.value;
    setAccountQuery(val);
    setSelectedAccount(null);
    setOpenOppWarning(null);
    setIsNewCompany(false);

    clearTimeout(searchTimeout.current);
    if (val.length < 2) { setAccountSuggestions([]); return; }

    searchTimeout.current = setTimeout(async () => {
      const res = await fetch(`/api/accounts?q=${encodeURIComponent(val)}`);
      if (res.ok) setAccountSuggestions(await res.json());
    }, 300);
  }

  async function selectAccount(acct) {
    setSelectedAccount(acct);
    setAccountQuery(acct.Name);
    setAccountSuggestions([]);
    setIsNewCompany(false);
    setOpenOppWarning(null);
    try {
      const res = await fetch(`/api/check-account?accountId=${encodeURIComponent(acct.Id)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.hasOpenOpp) setOpenOppWarning(data.opp);
      }
    } catch (_) { /* non-blocking */ }
  }

  function chooseNewCompany() {
    setSelectedAccount(null);
    setNewCompanyName(accountQuery);
    setIsNewCompany(true);
    setAccountSuggestions([]);
    setOpenOppWarning(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!isNewCompany && !selectedAccount) {
      setError('Please select a customer account, or register a new company.');
      return;
    }
    if (isNewCompany && !newCompanyWebsite) {
      setError('A website is required for a new company (e.g. acme.com).');
      return;
    }
    if (!useCase.trim()) {
      setError('Please describe the deal / use case.');
      return;
    }
    setLoading(true);
    setError('');

    const body = isNewCompany
      ? { customerName: newCompanyName, customerWebsite: newCompanyWebsite, useCase, estimatedAmount, closeDate }
      : { customerAccountId: selectedAccount.Id, customerName: selectedAccount.Name, useCase, estimatedAmount, closeDate };

    const res = await fetch('/api/registrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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

  return (
    <>
      <nav className="nav">
        <img src="/logo-on-dark.svg" alt="Unframe" className="nav-logo" />
        <span className="nav-user">
          <Link href="/dashboard" className="btn btn-secondary btn-sm">Back to dashboard</Link>
        </span>
      </nav>

      <div className="container">
        <div className="page-header">
          <h1>Register a Deal</h1>
        </div>

        <div style={{ maxWidth: 560 }}>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 24, marginTop: -4 }}>
            Registering a deal creates an opportunity in Unframe’s pipeline, tied to your organization. The Unframe team reviews and advances it from there.
          </p>

          {success && (
            <div className="success-msg">Deal registered. It’s now in Unframe’s pipeline. Redirecting…</div>
          )}
          {error && <div className="error-msg">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="account">Customer account *</label>
              {!isNewCompany ? (
                <div className="autocomplete-wrap">
                  <input
                    id="account"
                    type="text"
                    value={accountQuery}
                    onChange={handleAccountInput}
                    placeholder="Search for the end customer…"
                    autoComplete="off"
                  />
                  {accountSuggestions.length > 0 && (
                    <div className="autocomplete-list">
                      {accountSuggestions.map(a => (
                        <div key={a.Id} className="autocomplete-item" onClick={() => selectAccount(a)}>
                          <span>{a.Name}</span>
                          {a.Website && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{a.Website}</div>}
                        </div>
                      ))}
                      {accountQuery.length >= 2 && (
                        <div className="autocomplete-item" style={{ borderTop: '1px solid var(--line)', color: 'var(--brand-blue)' }} onClick={chooseNewCompany}>
                          + Register "{accountQuery}" as a new company
                        </div>
                      )}
                    </div>
                  )}
                  {selectedAccount && (
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ok-fg)' }}>
                      Selected: {selectedAccount.Name}
                    </div>
                  )}
                  {openOppWarning && (
                    <div style={{ marginTop: 8, padding: '10px 14px', background: 'var(--warn-bg)', border: '1px solid #F2D9A6', borderRadius: 6, fontSize: 13, color: 'var(--warn-fg)' }}>
                      Heads up: this account already has an open opportunity
                      {openOppWarning.partner ? ` tied to ${openOppWarning.partner}` : ''} ({openOppWarning.stage}). You can still register — the Unframe team will de-dupe if needed.
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <input type="text" value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)} placeholder="Company name" required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 4 }}>
                    <input type="text" value={newCompanyWebsite} onChange={e => setNewCompanyWebsite(e.target.value)} placeholder="Website (e.g. acme.com) — required" required />
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 6 }} onClick={() => { setIsNewCompany(false); setAccountQuery(''); }}>
                    Search existing accounts instead
                  </button>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="useCase">Deal / use case *</label>
              <textarea
                id="useCase"
                value={useCase}
                onChange={e => setUseCase(e.target.value)}
                placeholder="What is the opportunity? Describe the use case, the buyer, and why now."
                required
              />
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: '1 1 200px' }}>
                <label htmlFor="amount">Estimated deal size <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>(optional)</span></label>
                <input id="amount" type="number" min="0" step="1000" value={estimatedAmount} onChange={e => setEstimatedAmount(e.target.value)} placeholder="e.g. 100000" />
              </div>
              <div className="form-group" style={{ flex: '1 1 200px' }}>
                <label htmlFor="close">Expected close <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>(optional)</span></label>
                <input id="close" type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)} />
              </div>
            </div>

            <button className="btn btn-primary" type="submit" disabled={loading || success}>
              {loading ? 'Registering…' : 'Register deal'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
