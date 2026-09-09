import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

const OPEN_STAGES = ['Stage 0', 'Discovery', 'Use Case', 'POC', 'Negotiate'];
const LOST_STAGES = ['Closed Lost', 'Disqualified', 'Churned'];

function stageBadge(stage) {
  if (stage === 'Closed Won') return 'converted';
  if (LOST_STAGES.includes(stage)) return 'rejected';
  if (stage === 'Negotiate' || stage === 'POC') return 'active';
  return 'intro-made';
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function fmtMoney(n) {
  if (n === null || n === undefined || n === '') return '—';
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const [me, setMe] = useState(null);
  const [opps, setOpps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('deals'); // 'deals' | 'accounts'
  const [scope, setScope] = useState('org'); // 'org' | 'mine'
  const [stageFilter, setStageFilter] = useState('All');
  const [search, setSearch] = useState('');
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      fetch('/api/me').then(r => { if (r.status === 401) { router.push('/'); return null; } return r.json(); }),
      fetch('/api/opportunities').then(r => (r.ok ? r.json() : [])),
    ]).then(([meData, oppsData]) => {
      if (meData) setMe(meData);
      if (oppsData) setOpps(oppsData);
      setLoading(false);
    }).catch(() => { setError('Failed to load your data.'); setLoading(false); });
  }, []);

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/');
  }

  const scoped = opps.filter(o => (scope === 'mine' ? o.mine : true));
  const stages = Array.from(new Set(opps.map(o => o.StageName))).sort();

  const filteredDeals = scoped
    .filter(o => stageFilter === 'All' || o.StageName === stageFilter)
    .filter(o => {
      if (!search.trim()) return true;
      const hay = `${o.Account?.Name || ''} ${o.Name || ''} ${o.Partner_Email__c || ''}`.toLowerCase();
      return hay.includes(search.trim().toLowerCase());
    });

  // Distinct customer accounts derived from the scoped opps.
  const accountsMap = new Map();
  for (const o of scoped) {
    const id = o.AccountId;
    if (!id) continue;
    if (!accountsMap.has(id)) {
      accountsMap.set(id, { id, name: o.Account?.Name || '—', total: 0, open: 0, won: 0, stages: new Set() });
    }
    const a = accountsMap.get(id);
    a.total += 1;
    a.stages.add(o.StageName);
    if (o.StageName === 'Closed Won') a.won += 1;
    else if (!LOST_STAGES.includes(o.StageName)) a.open += 1;
  }
  const accounts = Array.from(accountsMap.values())
    .filter(a => !search.trim() || a.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((x, y) => y.total - x.total);

  const stats = {
    total: opps.length,
    mine: opps.filter(o => o.mine).length,
    accounts: new Set(opps.map(o => o.AccountId).filter(Boolean)).size,
    open: opps.filter(o => OPEN_STAGES.includes(o.StageName)).length,
    won: opps.filter(o => o.StageName === 'Closed Won').length,
  };

  return (
    <>
      <nav className="nav">
        <img src="/logo-on-dark.svg" alt="Unframe" className="nav-logo" />
        <span className="nav-user">
          {me?.partnerAccountName && <span className="nav-org">{me.partnerAccountName}</span>}
          <Link href="/register" className="btn btn-primary btn-sm">+ Register a Deal</Link>
          <button className="btn btn-secondary btn-sm" onClick={logout}>Sign out</button>
        </span>
      </nav>

      <div className="container">
        {error && <div className="error-msg" style={{ marginTop: 24 }}>{error}</div>}
        {loading && <p style={{ color: 'var(--ink-3)', fontSize: 14, marginTop: 32 }}>Loading…</p>}

        {!loading && (
          <>
            <div className="page-header">
              <h1>{me?.partnerAccountName ? `${me.partnerAccountName} — Pipeline` : 'Partner Pipeline'}</h1>
            </div>

            <div className="stat-row">
              <Stat label="Registered deals" value={stats.total} />
              <Stat label="Open" value={stats.open} />
              <Stat label="Closed Won" value={stats.won} />
              <Stat label="Accounts" value={stats.accounts} />
              <Stat label="Registered by you" value={stats.mine} />
            </div>

            {opps.length === 0 ? (
              <div className="empty">
                <h2>No deals yet</h2>
                <p>Register your first deal and it will appear here, along with any opportunity your organization is tied to.</p>
                <Link href="/register" className="btn btn-primary">Register a deal</Link>
              </div>
            ) : (
              <>
                <div className="tabs">
                  <button className={`tab ${tab === 'deals' ? 'active' : ''}`} onClick={() => setTab('deals')}>Deals</button>
                  <button className={`tab ${tab === 'accounts' ? 'active' : ''}`} onClick={() => setTab('accounts')}>Accounts</button>
                </div>

                <div className="filter-row">
                  <div className="seg">
                    <button className={scope === 'org' ? 'on' : ''} onClick={() => setScope('org')}>My organization</button>
                    <button className={scope === 'mine' ? 'on' : ''} onClick={() => setScope('mine')}>Registered by me</button>
                  </div>
                  {tab === 'deals' && (
                    <select value={stageFilter} onChange={e => setStageFilter(e.target.value)} className="mini-select">
                      <option value="All">All stages</option>
                      {stages.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={tab === 'deals' ? 'Search deals…' : 'Search accounts…'}
                    className="mini-search"
                  />
                </div>

                {tab === 'deals' && (
                  filteredDeals.length === 0 ? (
                    <div className="empty"><h2>No results</h2><p>No deals match the current filters.</p></div>
                  ) : (
                    <div className="table-wrap" style={{ marginBottom: 40 }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Account</th>
                            <th>Opportunity</th>
                            <th>Stage</th>
                            <th>Registered by</th>
                            <th>Amount</th>
                            <th>Close</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDeals.map(o => (
                            <tr key={o.Id}>
                              <td>{o.Account?.Name || '—'}</td>
                              <td>
                                {o.Name}
                                {o.mine && <span className="you-tag">You</span>}
                              </td>
                              <td><span className={`badge badge-${stageBadge(o.StageName)}`}>{o.StageName}</span></td>
                              <td style={{ fontSize: 13, color: 'var(--ink-2)' }}>{o.Partner_Email__c || '—'}</td>
                              <td>{fmtMoney(o.Amount)}</td>
                              <td>{fmtDate(o.CloseDate)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}

                {tab === 'accounts' && (
                  accounts.length === 0 ? (
                    <div className="empty"><h2>No results</h2><p>No accounts match the current filters.</p></div>
                  ) : (
                    <div className="table-wrap" style={{ marginBottom: 40 }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Account</th>
                            <th>Deals</th>
                            <th>Open</th>
                            <th>Won</th>
                            <th>Stages</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accounts.map(a => (
                            <tr key={a.id}>
                              <td>{a.name}</td>
                              <td>{a.total}</td>
                              <td>{a.open}</td>
                              <td>{a.won}</td>
                              <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{Array.from(a.stages).join(', ')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
