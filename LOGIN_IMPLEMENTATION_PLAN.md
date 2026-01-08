# Login Implementation Plan

This document outlines the complete plan for implementing user authentication (Login) functionality in DineFlow.

---

## Overview

**Endpoint:** `POST /api/auth/login`

**Purpose:** Authenticate user credentials and return JWT token for subsequent authenticated requests.

**Flow:**
1. User submits email and password
2. Validate input
3. Find user by email
4. Verify password against stored hash
5. Generate JWT token
6. Return user data + token

---

## Required Folder Structure

```
backend/
├── config/
│   └── database.js          ✅ (Already exists)
├── middleware/
│   └── auth.middleware.js  ⚠️  (To be created)
├── utils/
│   └── jwt.js              ⚠️  (To be created)
├── controllers/
│   └── auth.controller.js  ⚠️  (Optional - for cleaner code)
├── models/
│   └── User.model.js       ✅ (Already exists)
└── routes/
    └── auth.routes.js      ✅ (Already exists)
```

---

## Files to Create

### 1. `utils/jwt.js` ⚠️ **REQUIRED**

**Purpose:** JWT token generation and verification utilities

**Functions Needed:**
- `generateToken(userId, email, role)` - Generate JWT token
- `verifyToken(token)` - Verify and decode JWT token
- `decodeToken(token)` - Decode token without verification (optional)

**Dependencies:**
- `jsonwebtoken` (already installed)

**Environment Variables Required:**
- `JWT_SECRET` - Secret key for signing tokens
- `JWT_EXPIRE` - Token expiration time (e.g., "7d", "24h", "1h")

---

### 2. `middleware/auth.middleware.js` ⚠️ **REQUIRED**

**Purpose:** Protect routes by verifying JWT tokens

**Middleware Functions:**
- `authenticateToken` - Verify JWT token and attach user to request
- `optionalAuth` - Optional authentication (for routes that work with or without auth)
- `requireRole(roles)` - Role-based access control (future use)

**How it works:**
1. Extract token from `Authorization: Bearer <token>` header
2. Verify token using JWT secret
3. Extract user ID from token payload
4. Fetch user from database
5. Attach user to `req.user`
6. Call `next()` to continue to route handler

**Error Handling:**
- Missing token → 401 Unauthorized
- Invalid token → 401 Unauthorized
- Expired token → 401 Unauthorized
- User not found → 401 Unauthorized

---

### 3. `controllers/auth.controller.js` ⚠️ **OPTIONAL** (Recommended)

**Purpose:** Separate business logic from routes

**Functions:**
- `registerUser(req, res)` - Handle user registration
- `loginUser(req, res)` - Handle user login
- `logoutUser(req, res)` - Handle user logout
- `getCurrentUser(req, res)` - Get authenticated user

**Benefits:**
- Cleaner route files
- Reusable logic
- Easier testing
- Better separation of concerns

---

## Implementation Steps

### Step 1: Environment Variables Setup

Add to `.env` file:
```env
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRE=7d
```

**Note:** Use a strong, random secret key in production!

---

### Step 2: Create JWT Utility (`utils/jwt.js`)

**Responsibilities:**
- Generate tokens with user payload (id, email, role)
- Verify tokens
- Handle token expiration
- Return decoded payload

**Token Payload Structure:**
```javascript
{
  id: user.id,
  email: user.email,
  role: user.role,
  iat: issued_at_timestamp,
  exp: expiration_timestamp
}
```

---

### Step 3: Create Auth Middleware (`middleware/auth.middleware.js`)

**Responsibilities:**
- Extract token from Authorization header
- Verify token validity
- Fetch user from database
- Attach user to request object
- Handle all authentication errors

**Request Object Enhancement:**
After middleware runs, `req.user` will contain:
```javascript
{
  id: 1,
  email: "user@example.com",
  name: "John Doe",
  role: "customer",
  // ... other user fields (no password)
}
```

---

### Step 4: Implement Login Route

**In `routes/auth.routes.js`:**

1. **Input Validation** ✅ (Already done)
   - Check email and password are provided

2. **Find User**
   - Use `User.findByEmail(email)`
   - Check if user exists
   - Check if user is active (`is_active === true`)

3. **Verify Password**
   - Use `user.comparePassword(password)`
   - Throw error if password doesn't match

4. **Generate Token**
   - Use `generateToken(user.id, user.email, user.role)`

5. **Return Response**
   - User data (without password)
   - JWT token

---

### Step 5: Update Protected Routes

**Routes that need authentication:**
- `POST /api/auth/logout` - Already marked as Private
- `GET /api/auth/me` - Already marked as Private

**Implementation:**
```javascript
const { authenticateToken } = require("../middleware/auth.middleware");

router.post("/logout", authenticateToken, async (req, res) => {
  // req.user is available here
});

router.get("/me", authenticateToken, async (req, res) => {
  // req.user is available here
  // Just return req.user
});
```

---

## Detailed File Specifications

### `utils/jwt.js` Structure

```javascript
const jwt = require("jsonwebtoken");

/**
 * Generate JWT token for user
 * @param {number} userId - User ID
 * @param {string} email - User email
 * @param {string} role - User role
 * @returns {string} JWT token
 */
function generateToken(userId, email, role) {
  const payload = {
    id: userId,
    email,
    role,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
}

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = {
  generateToken,
  verifyToken,
};
```

---

### `middleware/auth.middleware.js` Structure

```javascript
const { verifyToken } = require("../utils/jwt");
const { User } = require("../models");

/**
 * Authenticate user via JWT token
 * Attaches user to req.user if authentication succeeds
 */
async function authenticateToken(req, res, next) {
  try {
    // 1. Extract token from header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1]; // "Bearer TOKEN"

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token required",
      });
    }

    // 2. Verify token
    const decoded = verifyToken(token);

    // 3. Find user
    const user = await User.findById(decoded.id);

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    // 4. Attach user to request
    req.user = user.toJSON(); // Excludes password

    // 5. Continue to next middleware/route
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Authentication error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

module.exports = {
  authenticateToken,
};
```

---

### Login Route Implementation

```javascript
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Input validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // 2. Find user by email
    const user = await User.findByEmail(email);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // 3. Check if user is active
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated",
      });
    }

    // 4. Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // 5. Generate JWT token
    const token = generateToken(user.id, user.email, user.role);

    // 6. Return response
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: user.toJSON(), // Excludes password
        token,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during login",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});
```

---

## Security Considerations

### 1. Password Security ✅
- Passwords are hashed with bcrypt (already implemented)
- Passwords never returned in responses

### 2. Token Security
- Tokens stored in HTTP-only cookies (optional, for web apps)
- Or stored in localStorage (for mobile/web apps)
- Tokens expire after set time
- Secret key must be strong and kept secure

### 3. Error Messages
- Generic error messages for security ("Invalid email or password" instead of "User not found")
- Detailed errors only in development mode

### 4. Rate Limiting (Future)
- Implement rate limiting to prevent brute force attacks
- Limit login attempts per IP/email

---

## Testing Plan

### Test Cases:

1. **Successful Login**
   - Valid email and password
   - Should return 200 with user data and token

2. **Invalid Email**
   - Email doesn't exist
   - Should return 401 with generic message

3. **Invalid Password**
   - Wrong password
   - Should return 401 with generic message

4. **Missing Fields**
   - Missing email or password
   - Should return 400 with validation message

5. **Inactive User**
   - User exists but is_active = false
   - Should return 401

6. **Token Verification**
   - Use token in Authorization header
   - Should allow access to protected routes

7. **Invalid Token**
   - Malformed or expired token
   - Should return 401

---

## Dependencies Check

✅ **Already Installed:**
- `jsonwebtoken` - For JWT operations
- `bcrypt` - For password hashing
- `express` - Web framework

⚠️ **May Need:**
- `cookie-parser` - If using HTTP-only cookies (optional)

---

## Implementation Order

1. ✅ Create `.env` with JWT_SECRET and JWT_EXPIRE
2. ⚠️ Create `utils/jwt.js`
3. ⚠️ Create `middleware/auth.middleware.js`
4. ⚠️ Implement login route logic
5. ⚠️ Update logout route to use middleware
6. ⚠️ Update `/me` route to use middleware
7. ⚠️ Test all endpoints

---

## File Dependencies Map

```
auth.routes.js
  ├── requires: User model (✅ exists)
  ├── requires: jwt utils (⚠️ to create)
  └── uses: auth.middleware (⚠️ to create)

auth.middleware.js
  ├── requires: jwt utils (⚠️ to create)
  └── requires: User model (✅ exists)

jwt.js
  └── requires: jsonwebtoken (✅ installed)
```

---

## Next Steps After Login

1. **Logout Implementation**
   - Token blacklist (optional)
   - Or simple client-side token removal

2. **Get Current User (`/me`)**
   - Use `authenticateToken` middleware
   - Return `req.user`

3. **Password Reset** (Future)
   - Forgot password flow
   - Reset password with token

4. **Refresh Tokens** (Future)
   - Long-lived refresh tokens
   - Short-lived access tokens

---

## Summary

**Files to Create:**
1. `utils/jwt.js` - JWT token utilities
2. `middleware/auth.middleware.js` - Authentication middleware
3. `controllers/auth.controller.js` - Optional, but recommended

**Files to Update:**
1. `routes/auth.routes.js` - Implement login logic
2. `routes/auth.routes.js` - Add middleware to protected routes
3. `.env` - Add JWT configuration

**Estimated Implementation Time:**
- JWT utils: 15 minutes
- Auth middleware: 30 minutes
- Login route: 20 minutes
- Testing: 20 minutes
- **Total: ~1.5 hours**

---

## Last Updated

**Date:** Current Session  
**Status:** Planning Phase  
**Next Action:** Create `utils/jwt.js`
