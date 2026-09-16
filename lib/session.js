import { getIronSession } from 'iron-session';

const sessionOptions = {
  password: process.env.SESSION_SECRET,
  cookieName: 'partner_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  },
};

export function getSession(req, res) {
  return getIronSession(req, res, sessionOptions);
}

export function withAuth(handler) {
  return async (req, res) => {
    const session = await getSession(req, res);
    if (!session.partnerAccountId && !session.isAdmin) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    req.session = session;
    return handler(req, res);
  };
}

export function withAdminAuth(handler) {
  return async (req, res) => {
    const session = await getSession(req, res);
    if (!session.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.session = session;
    return handler(req, res);
  };
}
