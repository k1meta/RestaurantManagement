const jwt = require('jsonwebtoken');

/**
 * Verifies the JWT token sent in the Authorization header.
 * Attaches the decoded user payload to req.user.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'Access denied — no token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, name, email, role, location_id }
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Role-based access control factory.
 * Usage: authorize('owner', 'manager')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied — requires one of: ${roles.join(', ')}`,
      });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
