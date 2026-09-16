import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';

const LOST_STAGES = ['Closed Lost', 'Disqualified', 'Churned'];

function stageBadge(stage) {
  if (stage === 'Closed Won') return 'converted';
  if (LOST_STAGES.includes(stage)) return 'rejected';
  if (stage === 'Negotiate' || stage === 'POC') return 'active';
  return 'intro-made';
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
function fmtMoney(n) {
  if (n === null || n === undefined || n === '') return '—';
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function Stat({ label, value }) {
  return <div className="stat"><div className="stat-value">{value}</div><div className="stat-label">{label}</div></div>;
}

function PartnerRow({ acct, expanded, onToggle, opps, loading }) {
  const open = Number(acct.Open_Opps_as_Partner__c || 0);
  const won = Number(acct.Won_Opps_as_Partner__c || 0);
  return (
    <div className={`acc-item ${expanded ? 'open' : ''}`}>
      <button className="acc-head" onClick={onToggle} aria-expanded={expanded}>
        <span className="acc-caret" aria-hidden="true">▸</span>
        <span className="acc-name">{acct.Name}</span>
        <span className="acc-meta">
          {acct.Partner_Type__c && <span className="badge badge-intro-made">{acct.Partner_Type__c}</span>}
          <span className="acc-count">{open} open</span>
          <span className="acc-count">{won} won</span>
        </span>
      </button>

      {expanded && (
        <div className="acc-body">
          {loading && <p className="acc-note">Loading opportunities…</p>}
          {!loading && opps && opps.length === 0 && <p className="acc-note">No opportunities tied to this partner.</p>}
          {!loading && opps && opps.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Account</th><th>Opportunity</th><th>Region</th><th>Owner</th>
                    <th>Stage</th><th>Registered by</th><th>Amount</th><th>Close</th>
                  </tr>
                </thead>
                <tbody>
                  {opps.map(o => (
                    <tr key={o.Id}>
                      <td>{o.Account?.Name || '—'}</td>
                      <td>{o.Name}</td>
                      <td style={{ fontSize: 13 }}>{o.region || '—'}</td>
                      <td style={{ fontSize: 13, color: 'var(--ink-2)' }}>{o.owner || '—'}</td>
                      <td><span className={`badge badge-${stageBadge(o.StageName)}`}>{o.StageName}</span></td>
                      <td style={{ fontSize: 13, color: 'var(--ink-2)' }}>{o.Partner_Email__c || '—'}</td>
                      <td>{fmtMoney(o.Amount)}</td>
                      <td>{fmtDate(o.CloseDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const [me, setMe] = useState(null);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [expandedId, setExpandedId] = useState(null);
  const [oppsCache, setOppsCache] = useState({});
  const [loadingOpps, setLoadingOpps] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/me').then(r => (r.ok ? r.json() : null)).then(m => {
      if (!m || !m.isAdmin) { router.push('/'); return; }
      setMe(m);
      return fetch('/api/admin/partners').then(r => (r.ok ? r.json() : [])).then(setPartners);
    }).catch(() => setError('Failed to load partners.')).finally(() => setLoading(false));
  }, []);

  const toggle = useCallback(async (acct) => {
    if (expandedId === acct.Id) { setExpandedId(null); return; }
    setExpandedId(acct.Id);
    if (!oppsCache[acct.Id]) {
      setLoadingOpps(true);
      try {
        const res = await fetch(`/api/admin/opportunities?accountId=${encodeURIComponent(acct.Id)}`);
        const data = res.ok ? await res.json() : [];
        setOppsCache(c => ({ ...c, [acct.Id]: data }));
      } catch { setOppsCache(c => ({ ...c, [acct.Id]: [] })); }
      setLoadingOpps(false);
    }
  }, [expandedId, oppsCache]);

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/');
  }

  const types = Array.from(new Set(partners.map(p => p.Partner_Type__c).filter(Boolean))).sort();
  const filtered = partners
    .filter(p => typeFilter === 'All' || p.Partner_Type__c === typeFilter)
    .filter(p => !search.trim() || (p.Name || '').toLowerCase().includes(search.trim().toLowerCase()));

  const totalOpen = partners.reduce((s, p) => s + Number(p.Open_Opps_as_Partner__c || 0), 0);
  const totalWon = partners.reduce((s, p) => s + Number(p.Won_Opps_as_Partner__c || 0), 0);

  return (
    <>
      <nav className="nav">
        <img src="/logo-on-dark.svg" alt="Unframe" className="nav-logo" />
        <span className="nav-user">
          <span className="admin-tag">Admin</span>
          {me?.name && <span className="nav-org">{me.name}</span>}
          <button className="btn btn-secondary btn-sm" onClick={logout}>Sign out</button>
        </span>
      </nav>

      <div className="container">
        {error && <div className="error-msg" style={{ marginTop: 24 }}>{error}</div>}
        {loading && <p style={{ color: 'var(--ink-3)', fontSize: 14, marginTop: 32 }}>Loading…</p>}

        {!loading && me?.isAdmin && (
          <>
            <div className="page-header"><h1>All Partners</h1></div>

            <div className="stat-row">
              <Stat label="Partner accounts" value={partners.length} />
              <Stat label="Open partner deals" value={totalOpen} />
              <Stat label="Won partner deals" value={totalWon} />
              <Stat label="Partner types" value={types.length} />
            </div>

            <div className="filter-row">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search partner accounts…"
                className="mini-search"
              />
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="mini-select">
                <option value="All">All partner types</option>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <span style={{ fontSize: 13, color: 'var(--ink-3)', marginLeft: 'auto' }}>
                {filtered.length} of {partners.length}
              </span>
            </div>

            {filtered.length === 0 ? (
              <div className="empty"><h2>No partners</h2><p>No partner accounts match the current filters.</p></div>
            ) : (
              <div className="acc-list">
                {filtered.map(acct => (
                  <PartnerRow
                    key={acct.Id}
                    acct={acct}
                    expanded={expandedId === acct.Id}
                    onToggle={() => toggle(acct)}
                    opps={oppsCache[acct.Id]}
                    loading={loadingOpps && expandedId === acct.Id && !oppsCache[acct.Id]}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
