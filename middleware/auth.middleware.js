const { verifyToken } = require("../utils/jwt");
const { User } = require("../models");

/**
 * Authentication Middleware
 * 
 * Verifies JWT token and attaches authenticated user to request object
 * Use this middleware on routes that require authentication
 */

/**
 * Authenticate user via JWT token
 * 
 * Extracts token from Authorization header, verifies it, and attaches
 * the authenticated user to req.user
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function authenticateToken(req, res, next) {
  try {
    // 1. Extract token from Authorization header
    // Format: "Bearer <token>"
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Access token required. Please provide Authorization header",
      });
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token required. Format: Bearer <token>",
      });
    }

    // 2. Verify token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      if (error.message === "Invalid token") {
        return res.status(401).json({
          success: false,
          message: "Invalid token",
        });
      }
      if (error.message === "Token expired") {
        return res.status(401).json({
          success: false,
          message: "Token expired. Please login again",
        });
      }
      throw error;
    }

    // 3. Find user by ID from token
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found. Token is invalid",
      });
    }

    // 4. Check if user is active
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated",
      });
    }

    // 5. Attach user to request object (password excluded via toJSON)
    req.user = user.toJSON();

    // 6. Continue to next middleware/route handler
    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Optional authentication middleware
 * 
 * Tries to authenticate user but doesn't fail if token is missing/invalid
 * Useful for routes that work with or without authentication
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      const token = authHeader.split(" ")[1];
      if (token) {
        try {
          const decoded = verifyToken(token);
          const user = await User.findById(decoded.id);
          if (user && user.is_active) {
            req.user = user.toJSON();
          }
        } catch (error) {
          // Silently fail for optional auth
          // req.user will remain undefined
        }
      }
    }

    next();
  } catch (error) {
    // Continue even if there's an error
    next();
  }
}

/**
 * Role-based access control middleware
 * 
 * Checks if authenticated user has one of the required roles
 * 
 * @param {Array<string>} allowedRoles - Array of allowed roles
 * @returns {Function} Express middleware function
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(" or ")}`,
      });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRole,
};
