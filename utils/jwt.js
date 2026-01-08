const jwt = require("jsonwebtoken");
require("dotenv").config();

/**
 * JWT Utility Functions
 * 
 * Handles JWT token generation and verification for authentication
 */

/**
 * Generate JWT token for user
 * 
 * @param {number} userId - User ID
 * @param {string} email - User email
 * @param {string} role - User role (customer, restaurant_owner, rider)
 * @returns {string} JWT token
 * @throws {Error} If JWT_SECRET is not configured
 */
function generateToken(userId, email, role) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured in environment variables");
  }

  const payload = {
    id: userId,
    email,
    role,
  };

  const options = {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  };

  return jwt.sign(payload, process.env.JWT_SECRET, options);
}

/**
 * Verify JWT token
 * 
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 * @throws {JsonWebTokenError} If token is invalid
 * @throws {TokenExpiredError} If token has expired
 */
function verifyToken(token) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured in environment variables");
  }

  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    // Re-throw with more context
    if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid token");
    }
    if (error.name === "TokenExpiredError") {
      throw new Error("Token expired");
    }
    throw error;
  }
}

/**
 * Decode JWT token without verification
 * Useful for debugging or getting token info
 * 
 * @param {string} token - JWT token to decode
 * @returns {Object} Decoded token payload (not verified)
 */
function decodeToken(token) {
  return jwt.decode(token);
}

module.exports = {
  generateToken,
  verifyToken,
  decodeToken,
};
