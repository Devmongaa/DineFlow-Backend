# Authentication Routes - Validation Documentation

This document records all validations, rules, and error handling used in `auth.routes.js`.

---

## Overview

**Base Path:** `/api/auth`

All endpoints follow a consistent response format:
```json
{
  "success": boolean,
  "message": string,
  "data": object (optional),
  "error": string (optional, development only),
  "errors": array (optional, for validation errors)
}
```

---

## Endpoints

### 1. POST `/api/auth/register`

**Description:** Register a new user account

**Access:** Public

**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required)",
  "name": "string (required)",
  "phone": "string (optional)",
  "role": "string (required)"
}
```

#### Validations Applied:

1. **Required Fields Validation**
   - **Fields:** `email`, `password`, `name`
   - **Rule:** All three fields must be provided
   - **Error Response:** 
     - Status: `400 Bad Request`
     - Message: `"Email, password, and name are required"`

2. **Role Validation**
   - **Field:** `role`
   - **Rule:** Must be one of: `"customer"`, `"restaurant_owner"`, `"rider"`
   - **Error Response:**
     - Status: `400 Bad Request`
     - Message: `"Role is required and must be one of: customer, restaurant_owner, rider"`

3. **Email Format Validation**
   - **Field:** `email`
   - **Rule:** Must match email regex pattern: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
   - **Error Response:**
     - Status: `400 Bad Request`
     - Message: `"Invalid email format"`

4. **Password Strength Validation**
   - **Field:** `password`
   - **Rule:** Minimum length of 6 characters
   - **Error Response:**
     - Status: `400 Bad Request`
     - Message: `"Password must be at least 6 characters long"`

5. **Email Uniqueness Validation**
   - **Field:** `email`
   - **Rule:** Email must not already exist in database
   - **Error Response:**
     - Status: `409 Conflict`
     - Message: `"Email already exists"`

6. **Phone Validation** (Model Level)
   - **Field:** `phone`
   - **Rule:** If provided, must be between 10-20 characters (validated by Sequelize model)
   - **Error Response:**
     - Status: `400 Bad Request`
     - Message: `"Phone number must be between 10 and 20 characters"`

7. **Name Validation** (Model Level)
   - **Field:** `name`
   - **Rule:** Must be between 2-255 characters (validated by Sequelize model)
   - **Error Response:**
     - Status: `400 Bad Request`
     - Message: `"Name must be between 2 and 255 characters"`

#### Success Response:
- **Status:** `201 Created`
- **Body:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "John Doe",
      "phone": "1234567890",
      "role": "customer",
      "is_active": true,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### Error Responses:

**Sequelize Validation Error:**
- **Status:** `400 Bad Request`
- **Body:**
```json
{
  "success": false,
  "message": "Validation error",
  "errors": ["Error message 1", "Error message 2"]
}
```

**Unique Constraint Error:**
- **Status:** `409 Conflict`
- **Body:**
```json
{
  "success": false,
  "message": "Email already exists"
}
```

**Internal Server Error:**
- **Status:** `500 Internal Server Error`
- **Body:**
```json
{
  "success": false,
  "message": "Internal server error during registration",
  "error": "Error details (development only)"
}
```

---

### 2. POST `/api/auth/login`

**Description:** Authenticate user and return JWT token

**Access:** Public

**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

#### Validations Applied:

1. **Required Fields Validation**
   - **Fields:** `email`, `password`
   - **Rule:** Both fields must be provided
   - **Error Response:**
     - Status: `400 Bad Request`
     - Message: `"Email and password are required"`

2. **User Existence Validation** (TODO - To be implemented)
   - **Field:** `email`
   - **Rule:** User must exist in database

3. **Password Verification** (TODO - To be implemented)
   - **Field:** `password`
   - **Rule:** Password must match stored hash

#### Success Response:
- **Status:** `200 OK`
- **Body:** (TODO - To be implemented)
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { /* user object */ },
    "token": "jwt_token_here"
  }
}
```

#### Error Responses:

**Invalid Credentials:**
- **Status:** `401 Unauthorized`
- **Body:**
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

**Internal Server Error:**
- **Status:** `500 Internal Server Error`
- **Body:**
```json
{
  "success": false,
  "message": "Internal server error during login",
  "error": "Error details (development only)"
}
```

---

### 3. POST `/api/auth/logout`

**Description:** Logout user (invalidate token)

**Access:** Private (requires authentication)

**Request Headers:**
```
Authorization: Bearer <token>
```

#### Validations Applied:

- **Authentication Token Validation** (TODO - To be implemented)
  - **Rule:** Valid JWT token must be provided in Authorization header

#### Success Response:
- **Status:** `200 OK`
- **Body:**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

#### Error Responses:

**Internal Server Error:**
- **Status:** `500 Internal Server Error`
- **Body:**
```json
{
  "success": false,
  "message": "Internal server error during logout",
  "error": "Error details (development only)"
}
```

---

### 4. GET `/api/auth/me`

**Description:** Get current authenticated user information

**Access:** Private (requires authentication)

**Request Headers:**
```
Authorization: Bearer <token>
```

#### Validations Applied:

1. **Token Validation** (TODO - To be implemented)
   - **Rule:** Valid JWT token must be provided
   - **Error Response:**
     - Status: `401 Unauthorized`
     - Message: `"Invalid or expired token"`

2. **Token Expiration Validation** (TODO - To be implemented)
   - **Rule:** Token must not be expired
   - **Error Response:**
     - Status: `401 Unauthorized`
     - Message: `"Invalid or expired token"`

#### Success Response:
- **Status:** `200 OK`
- **Body:** (TODO - To be implemented)
```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "user": { /* user object */ }
  }
}
```

#### Error Responses:

**Invalid/Expired Token:**
- **Status:** `401 Unauthorized`
- **Body:**
```json
{
  "success": false,
  "message": "Invalid or expired token"
}
```

**Internal Server Error:**
- **Status:** `500 Internal Server Error`
- **Body:**
```json
{
  "success": false,
  "message": "Internal server error",
  "error": "Error details (development only)"
}
```

---

## HTTP Status Codes Used

| Status Code | Meaning | Used In |
|------------|---------|---------|
| `200` | OK | Login, Logout, Get User |
| `201` | Created | Register |
| `400` | Bad Request | Validation errors |
| `401` | Unauthorized | Invalid credentials, invalid token |
| `409` | Conflict | Email already exists |
| `500` | Internal Server Error | Server errors |

---

## Validation Summary

### Field-Level Validations

| Field | Required | Type | Min Length | Max Length | Format/Pattern | Unique |
|-------|----------|------|------------|------------|----------------|--------|
| `email` | ✅ | string | - | 255 | Email regex | ✅ |
| `password` | ✅ | string | 6 | - | - | ❌ |
| `name` | ✅ | string | 2 | 255 | - | ❌ |
| `phone` | ❌ | string | 10 | 20 | - | ❌ |
| `role` | ✅ | enum | - | - | customer, restaurant_owner, rider | ❌ |

### Business Rules

1. **Email Uniqueness:** Each email can only be registered once
2. **Password Hashing:** Passwords are automatically hashed using bcrypt (10 salt rounds) before storage
3. **Role Assignment:** Users must select one of three valid roles during registration
4. **Soft Delete:** Users have an `is_active` flag (default: `true`) for soft deletion

---

## Error Handling Patterns

### 1. Validation Errors
- **Source:** Input validation, Sequelize model validation
- **Status:** `400 Bad Request`
- **Response:** Includes specific error messages

### 2. Conflict Errors
- **Source:** Unique constraint violations (duplicate email)
- **Status:** `409 Conflict`
- **Response:** Clear message about the conflict

### 3. Authentication Errors
- **Source:** Invalid credentials, invalid/expired tokens
- **Status:** `401 Unauthorized`
- **Response:** Generic message (security best practice)

### 4. Server Errors
- **Source:** Unexpected errors, database errors
- **Status:** `500 Internal Server Error`
- **Response:** Generic message in production, detailed in development

---

## Notes

- All passwords are hashed using bcrypt before storage
- User passwords are never returned in API responses (excluded via `toJSON()` method)
- Email validation uses regex pattern: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Phone validation is optional but enforced if provided (10-20 characters)
- Role validation ensures only valid roles are accepted
- All timestamps are automatically managed by Sequelize

---

## Last Updated

**Date:** Current Session  
**File:** `routes/auth.routes.js`  
**Model:** `models/User.model.js`
