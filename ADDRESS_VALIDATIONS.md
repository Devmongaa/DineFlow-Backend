# Address Management Routes - Validation Documentation

This document records all validations, rules, and error handling used in address management routes.

---

## Overview

**Base Path:** `/api/addresses`

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

## Address Model Structure

### Database Table: `addresses`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | INTEGER | ✅ | Auto | Primary key |
| `user_id` | INTEGER | ✅ | - | Foreign key to `users.id` |
| `address_line` | TEXT | ✅ | - | Street address |
| `city` | STRING(100) | ✅ | - | City name |
| `state` | STRING(100) | ❌ | null | State/Province |
| `zip_code` | STRING(20) | ❌ | null | Postal/ZIP code |
| `country` | STRING(100) | ❌ | "India" | Country name |
| `latitude` | DECIMAL(10,8) | ❌ | null | Latitude coordinate |
| `longitude` | DECIMAL(11,8) | ❌ | null | Longitude coordinate |
| `is_default` | BOOLEAN | ✅ | false | Default address flag |
| `label` | STRING(50) | ❌ | null | Address label (e.g., "Home", "Work") |
| `phone` | STRING(20) | ❌ | null | Contact phone for delivery |
| `created_at` | TIMESTAMP | ✅ | Auto | Creation timestamp |
| `updated_at` | TIMESTAMP | ✅ | Auto | Update timestamp |

---

## Endpoints

### 1. GET `/api/addresses`

**Description:** Get all addresses for current user

**Access:** Private (customer only)

**Request Headers:**
```
Authorization: Bearer <token>
```

#### Validations Applied:

1. **Authentication Validation**
   - **Rule:** Valid JWT token must be provided
   - **Error Response:**
     - Status: `401 Unauthorized`
     - Message: `"Invalid or expired token"`

2. **Role Validation**
   - **Rule:** User must have role `customer`
   - **Error Response:**
     - Status: `403 Forbidden`
     - Message: `"Access denied"`

#### Success Response:
- **Status:** `200 OK`
- **Body:**
```json
{
  "success": true,
  "message": "Addresses retrieved successfully",
  "data": {
    "addresses": [
      {
        "id": 1,
        "user_id": 1,
        "address_line": "123 Main Street, Building A",
        "city": "Mumbai",
        "state": "Maharashtra",
        "zip_code": "400001",
        "country": "India",
        "latitude": "19.07600000",
        "longitude": "72.87770000",
        "is_default": true,
        "label": "Home",
        "phone": "1234567890",
        "created_at": "2026-01-08T06:00:00.000Z",
        "updated_at": "2026-01-08T06:00:00.000Z"
      }
    ],
    "count": 1
  }
}
```

**Note:** Addresses are ordered by `is_default` (default first) and then by `created_at` (newest first).

---

### 2. GET `/api/addresses/default`

**Description:** Get default address for current user

**Access:** Private (customer only)

**Request Headers:**
```
Authorization: Bearer <token>
```

#### Validations Applied:

1. **Authentication Validation**
   - **Rule:** Valid JWT token must be provided
   - **Error Response:**
     - Status: `401 Unauthorized`
     - Message: `"Invalid or expired token"`

2. **Default Address Existence**
   - **Rule:** User must have a default address
   - **Error Response:**
     - Status: `404 Not Found`
     - Message: `"No default address found"`

#### Success Response:
- **Status:** `200 OK`
- **Body:**
```json
{
  "success": true,
  "message": "Default address retrieved successfully",
  "data": {
    "address": {
      "id": 1,
      "user_id": 1,
      "address_line": "123 Main Street",
      "city": "Mumbai",
      "is_default": true
    }
  }
}
```

---

### 3. GET `/api/addresses/:id`

**Description:** Get address by ID

**Access:** Private (customer only)

**Request Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
- `id` (integer, required) - Address ID

#### Validations Applied:

1. **Address Existence Validation**
   - **Rule:** Address must exist
   - **Error Response:**
     - Status: `404 Not Found`
     - Message: `"Address not found"`

2. **Address Ownership Validation**
   - **Rule:** Address must belong to the authenticated user
   - **Error Response:**
     - Status: `403 Forbidden`
     - Message: `"You can only view your own addresses"`

#### Success Response:
- **Status:** `200 OK`
- **Body:**
```json
{
  "success": true,
  "message": "Address retrieved successfully",
  "data": {
    "address": {
      "id": 1,
      "user_id": 1,
      "address_line": "123 Main Street",
      "city": "Mumbai",
      "state": "Maharashtra",
      "zip_code": "400001",
      "country": "India",
      "latitude": "19.07600000",
      "longitude": "72.87770000",
      "is_default": true,
      "label": "Home",
      "phone": "1234567890",
      "created_at": "2026-01-08T06:00:00.000Z",
      "updated_at": "2026-01-08T06:00:00.000Z"
    }
  }
}
```

---

### 4. POST `/api/addresses`

**Description:** Create a new address

**Access:** Private (customer only)

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "address_line": "123 Main Street, Building A",
  "city": "Mumbai",
  "state": "Maharashtra",
  "zip_code": "400001",
  "country": "India",
  "latitude": 19.0760,
  "longitude": 72.8777,
  "is_default": true,
  "label": "Home",
  "phone": "1234567890"
}
```

#### Validations Applied:

1. **Required Fields Validation**
   - **Fields:** `address_line`, `city`
   - **Rule:** Both fields must be provided
   - **Error Response:**
     - Status: `400 Bad Request`
     - Message: `"Address line and city are required"`

2. **Address Line Validation** (Model Level)
   - **Field:** `address_line`
   - **Rule:** Must be between 5-500 characters
   - **Error Response:**
     - Status: `400 Bad Request`
     - Message: `"Address must be between 5 and 500 characters"`

3. **City Validation** (Model Level)
   - **Field:** `city`
   - **Rule:** Must be between 2-100 characters
   - **Error Response:**
     - Status: `400 Bad Request`
     - Message: `"City must be between 2 and 100 characters"`

4. **Zip Code Validation** (Model Level)
   - **Field:** `zip_code`
   - **Rule:** If provided, must be at most 20 characters
   - **Error Response:**
     - Status: `400 Bad Request`
     - Message: `"Zip code must be at most 20 characters"`

5. **Latitude Validation** (Model Level)
   - **Field:** `latitude`
   - **Rule:** If provided, must be between -90 and 90
   - **Error Response:**
     - Status: `400 Bad Request`
     - Message: `"Latitude must be between -90 and 90"`

6. **Longitude Validation** (Model Level)
   - **Field:** `longitude`
   - **Rule:** If provided, must be between -180 and 180
   - **Error Response:**
     - Status: `400 Bad Request`
     - Message: `"Longitude must be between -180 and 180"`

7. **Label Validation** (Model Level)
   - **Field:** `label`
   - **Rule:** If provided, must be at most 50 characters
   - **Error Response:**
     - Status: `400 Bad Request`
     - Message: `"Label must be at most 50 characters"`

8. **Phone Validation** (Model Level)
   - **Field:** `phone`
   - **Rule:** If provided, must be at most 20 characters
   - **Error Response:**
     - Status: `400 Bad Request`
     - Message: `"Phone must be at most 20 characters"`

9. **Default Address Management**
   - **Rule:** If setting as default, automatically unsets other default addresses
   - **Behavior:** Automatic, no error

#### Success Response:
- **Status:** `201 Created`
- **Body:**
```json
{
  "success": true,
  "message": "Address created successfully",
  "data": {
    "address": {
      "id": 1,
      "user_id": 1,
      "address_line": "123 Main Street, Building A",
      "city": "Mumbai",
      "state": "Maharashtra",
      "zip_code": "400001",
      "country": "India",
      "latitude": "19.07600000",
      "longitude": "72.87770000",
      "is_default": true,
      "label": "Home",
      "phone": "1234567890",
      "created_at": "2026-01-08T06:00:00.000Z",
      "updated_at": "2026-01-08T06:00:00.000Z"
    }
  }
}
```

---

### 5. PUT `/api/addresses/:id`

**Description:** Update address

**Access:** Private (customer only)

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**URL Parameters:**
- `id` (integer, required) - Address ID

**Request Body:**
```json
{
  "address_line": "Updated address line",
  "city": "Delhi",
  "is_default": true
}
```

#### Validations Applied:

1. **Address Existence Validation**
   - **Rule:** Address must exist
   - **Error Response:**
     - Status: `404 Not Found`
     - Message: `"Address not found"`

2. **Address Ownership Validation**
   - **Rule:** Address must belong to the authenticated user
   - **Error Response:**
     - Status: `403 Forbidden`
     - Message: `"You can only update your own addresses"`

3. **Field-Level Validations** (Model Level)
   - Same validations as create endpoint apply to updated fields

4. **Default Address Management**
   - **Rule:** If setting as default, automatically unsets other default addresses
   - **Behavior:** Automatic, no error

#### Success Response:
- **Status:** `200 OK`
- **Body:**
```json
{
  "success": true,
  "message": "Address updated successfully",
  "data": {
    "address": {
      "id": 1,
      "user_id": 1,
      "address_line": "Updated address line",
      "city": "Delhi",
      "is_default": true,
      "updated_at": "2026-01-08T07:00:00.000Z"
    }
  }
}
```

---

### 6. PUT `/api/addresses/:id/set-default`

**Description:** Set address as default

**Access:** Private (customer only)

**Request Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
- `id` (integer, required) - Address ID

#### Validations Applied:

1. **Address Existence Validation**
   - **Rule:** Address must exist
   - **Error Response:**
     - Status: `404 Not Found`
     - Message: `"Address not found"`

2. **Address Ownership Validation**
   - **Rule:** Address must belong to the authenticated user
   - **Error Response:**
     - Status: `403 Forbidden`
     - Message: `"You can only set your own addresses as default"`

3. **Default Address Management**
   - **Rule:** Automatically unsets other default addresses
   - **Behavior:** Automatic, no error

#### Success Response:
- **Status:** `200 OK`
- **Body:**
```json
{
  "success": true,
  "message": "Address set as default successfully",
  "data": {
    "address": {
      "id": 1,
      "is_default": true,
      "updated_at": "2026-01-08T07:00:00.000Z"
    }
  }
}
```

---

### 7. DELETE `/api/addresses/:id`

**Description:** Delete address

**Access:** Private (customer only)

**Request Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
- `id` (integer, required) - Address ID

#### Validations Applied:

1. **Address Existence Validation**
   - **Rule:** Address must exist
   - **Error Response:**
     - Status: `404 Not Found`
     - Message: `"Address not found"`

2. **Address Ownership Validation**
   - **Rule:** Address must belong to the authenticated user
   - **Error Response:**
     - Status: `403 Forbidden`
     - Message: `"You can only delete your own addresses"`

#### Success Response:
- **Status:** `200 OK`
- **Body:**
```json
{
  "success": true,
  "message": "Address deleted successfully"
}
```

---

## HTTP Status Codes Used

| Status Code | Meaning | Used In |
|------------|---------|---------|
| `200` | OK | Get addresses, Get address, Update address, Set default, Delete address |
| `201` | Created | Create address |
| `400` | Bad Request | Validation errors |
| `401` | Unauthorized | Missing/invalid token |
| `403` | Forbidden | Not customer role, not address owner |
| `404` | Not Found | Address not found, no default address |
| `500` | Internal Server Error | Server errors |

---

## Validation Summary

### Field-Level Validations

| Field | Required | Type | Min Length | Max Length | Min Value | Max Value | Description |
|-------|----------|------|------------|------------|-----------|-----------|-------------|
| `user_id` | ✅ | integer | - | - | - | - | Must exist in users table |
| `address_line` | ✅ | text | 5 | 500 | - | - | Street address |
| `city` | ✅ | string | 2 | 100 | - | - | City name |
| `state` | ❌ | string | - | 100 | - | - | State/Province |
| `zip_code` | ❌ | string | - | 20 | - | - | Postal code |
| `country` | ❌ | string | - | 100 | - | - | Default: "India" |
| `latitude` | ❌ | decimal(10,8) | - | - | -90 | 90 | Latitude coordinate |
| `longitude` | ❌ | decimal(11,8) | - | - | -180 | 180 | Longitude coordinate |
| `is_default` | ✅ | boolean | - | - | - | - | Default: false |
| `label` | ❌ | string | - | 50 | - | - | Address label |
| `phone` | ❌ | string | - | 20 | - | - | Contact phone |

### Business Rules

1. **Multiple Addresses:** Users can save multiple delivery addresses

2. **Default Address:** Only one address can be marked as default per user. Setting a new default automatically unsets the previous default.

3. **Address Labels:** Optional labels (e.g., "Home", "Work", "Office") help users identify addresses

4. **Location Coordinates:** Optional latitude/longitude for future distance calculations and delivery routing

5. **Ownership Validation:** Users can only manage their own addresses

6. **Ordering:** Addresses are returned with default address first, then by creation date (newest first)

---

## Access Control

### Private Endpoints (Customer Only)
- `GET /api/addresses` - Get all addresses
- `GET /api/addresses/default` - Get default address
- `GET /api/addresses/:id` - Get address by ID
- `POST /api/addresses` - Create address
- `PUT /api/addresses/:id` - Update address
- `PUT /api/addresses/:id/set-default` - Set as default
- `DELETE /api/addresses/:id` - Delete address

**Authentication Requirements:**
- All endpoints require `Authorization: Bearer <token>` header
- Token must be valid and not expired
- User must have role `customer`
- Users can only manage their own addresses

---

## Error Handling Patterns

### 1. Validation Errors
- **Source:** Input validation, Sequelize model validation
- **Status:** `400 Bad Request`
- **Response:** Includes specific error messages in `errors` array

### 2. Authentication Errors
- **Source:** Missing/invalid token, expired token
- **Status:** `401 Unauthorized`
- **Response:** Generic message (security best practice)

### 3. Authorization Errors
- **Source:** Wrong role, not address owner
- **Status:** `403 Forbidden`
- **Response:** Clear message about permission denial

### 4. Not Found Errors
- **Source:** Address doesn't exist, no default address
- **Status:** `404 Not Found`
- **Response:** Clear message about resource not found

### 5. Server Errors
- **Source:** Unexpected errors, database errors
- **Status:** `500 Internal Server Error`
- **Response:** Generic message in production, detailed in development

---

## Model Methods

### Address Model Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `findById(id)` | Find address by ID | `id` (integer) |
| `findByUser(userId)` | Find all addresses for user | `userId` (integer) |
| `findDefault(userId)` | Find default address for user | `userId` (integer) |
| `createAddress(addressData)` | Create a new address | `addressData` (object) |
| `updateAddress(id, updateData)` | Update address | `id` (integer), `updateData` (object) |
| `setAsDefault(id)` | Set address as default | `id` (integer) |
| `deleteAddress(id)` | Delete address | `id` (integer) |

---

## Example Use Cases

### 1. Customer Creates Address
```bash
POST /api/addresses
Authorization: Bearer <token>
Content-Type: application/json

{
  "address_line": "123 Main Street, Building A",
  "city": "Mumbai",
  "state": "Maharashtra",
  "zip_code": "400001",
  "is_default": true,
  "label": "Home"
}
```

### 2. Customer Gets All Addresses
```bash
GET /api/addresses
Authorization: Bearer <token>
```

### 3. Customer Gets Default Address
```bash
GET /api/addresses/default
Authorization: Bearer <token>
```

### 4. Customer Updates Address
```bash
PUT /api/addresses/1
Authorization: Bearer <token>
Content-Type: application/json

{
  "address_line": "Updated address",
  "city": "Delhi"
}
```

### 5. Customer Sets Address as Default
```bash
PUT /api/addresses/2/set-default
Authorization: Bearer <token>
```

### 6. Customer Deletes Address
```bash
DELETE /api/addresses/1
Authorization: Bearer <token>
```

---

## Notes

- Only one address can be marked as default per user
- Setting a new default automatically unsets the previous default
- Address labels are optional but helpful for identification
- Location coordinates (latitude/longitude) are optional and can be used for distance calculations
- Country defaults to "India" if not provided
- All timestamps are automatically managed by Sequelize
- Addresses are ordered by default status (default first) and creation date (newest first)
- Users can have unlimited addresses
- Phone number is optional and can be used for delivery contact

---

## Last Updated

**Date:** 2026-01-08  
**Files:** 
- `routes/address.routes.js`
- `models/Address.model.js`
