import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Login() {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState('email'); // 'email' | 'otp'
  const [otp, setOtp] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function sendCode(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'send', email }),
    });

    const data = await res.json();
    if (res.ok) {
      if (data.testLogin) {
        router.push('/dashboard');
        return;
      }
      setPartnerName(data.partnerName || '');
      setStep('otp');
    } else {
      setError(data.error || 'Something went wrong.');
    }
    setLoading(false);
  }

  async function verifyCode(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'verify', otp }),
    });

    const data = await res.json();
    if (res.ok) {
      router.push('/dashboard');
    } else {
      setError(data.error || 'Something went wrong.');
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <img src="/logo-on-light.svg" alt="Unframe" className="login-logo" />
        <h1>Partner Portal</h1>

        {step === 'email' && (
          <>
            <p>Sign in with your work email to register deals and track your pipeline with Unframe.</p>
            {error && <div className="error-msg">{error}</div>}
            <form onSubmit={sendCode}>
              <div className="form-group">
                <label htmlFor="email">Work email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@yourcompany.com"
                  required
                  autoFocus
                />
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Sending code…' : 'Send code'}
              </button>
            </form>
          </>
        )}

        {step === 'otp' && (
          <>
            <p>
              {partnerName && <>Welcome, <strong>{partnerName}</strong>. </>}
              We sent a 6-digit code to <strong>{email}</strong>. Enter it below.
            </p>
            {error && <div className="error-msg">{error}</div>}
            <form onSubmit={verifyCode}>
              <div className="form-group">
                <label htmlFor="otp">Login code</label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  required
                  autoFocus
                  style={{ letterSpacing: 6, fontSize: 22, textAlign: 'center' }}
                />
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading || otp.length < 6}>
                {loading ? 'Verifying…' : 'Verify'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', marginTop: 10 }}
                onClick={() => { setStep('email'); setOtp(''); setError(''); }}
              >
                Use a different email
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
