/**
 * Role-Based Access Control Middleware
 * @param {string|string[]} allowedRoles 
 */
function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required prior to role verification.'
      });
    }

    if (!roles.includes(req.auth.ownerType)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Insufficient permissions. Your role '${req.auth.ownerType}' cannot access this resource. Required role(s): ${roles.join(', ')}`
      });
    }

    next();
  };
}

module.exports = {
  requireRole
};
