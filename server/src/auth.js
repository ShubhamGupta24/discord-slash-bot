const jwt = require('jsonwebtoken');

const TOKEN_EXPIRY = '12h';

function issueToken() {
  return jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

// Handles POST /api/auth/login
function login(req, res) {
  const { username, password } = req.body;
  console.log('[auth] login attempt', { username });

  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    const token = issueToken();
    console.log('[auth] login success', { username });
    return res.json({ token });
  }

  console.log('[auth] login failed', { username });
  return res.status(401).json({ error: 'Invalid credentials' });
}

// Middleware: protects any route that requires a logged-in admin.
// Expects header: Authorization: Bearer <token>
function requireAuth(req, res, next) {
  const header = req.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    console.log('[auth] request authorized');
    next();
  } catch (err) {
    console.log('[auth] request rejected', { error: err.message });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { login, requireAuth };
