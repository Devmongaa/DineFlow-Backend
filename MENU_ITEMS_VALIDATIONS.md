# Menu Items Routes - Validation Documentation

This document records all validations, rules, and error handling used in menu item routes.

---

## Overview

**Base Paths:** 
- `/api/restaurants/:restaurantId/menu` (restaurant routes)
- `/api/menu-items/:id` (menu routes)

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

## Menu Item Model Structure

### Database Table: `menu_items`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | INTEGER | ✅ | Auto | Primary key |
| `restaurant_id` | INTEGER | ✅ | - | Foreign key to `restaurants.id` |
| `name` | STRING(255) | ✅ | - | Menu item name |
| `description` | TEXT | ❌ | null | Item description |
| `price` | DECIMAL(10,2) | ✅ | - | Item price |
| `category` | STRING(100) | ✅ | - | Item category (e.g., "Pizza", "Pasta") |
| `image_url` | STRING(500) | ❌ | null | Image URL |
| `is_available` | BOOLEAN | ✅ | true | Availability status |
| `preparation_time` | INTEGER | ❌ | null | Preparation time in minutes |
| `created_at` | TIMESTAMP | ✅ | Auto | Creation timestamp |
| `updated_at` | TIMESTAMP | ✅ | Auto | Update timestamp |

---

## Endpoints

### 1. GET `/api/restaurants/:restaurantId/menu`

**Description:** Get all menu items for a restaurant, grouped by category

**Access:** Public

**URL Parameters:**
- `restaurantId` (integer, required) - Restaurant ID

**Query Parameters:**
- `category` (string, optional) - Filter by category name
- `is_available` (boolean, optional) - Filter by availability (default: all items)

**Example Request:**
```bash
GET /api/restaurants/1/menu?category=Pizza&is_available=true
```

#### Validations Applied:

1. **Restaurant Existence Validation**
   - **Rule:** Restaurant must exist and be active
   - **Error Response:**
     - Status: `404 Not Found`
     - Message: `"Restaurant not found"`

#### Success Response:
- **Status:** `200 OK`
- **Body:**
```json
{
  "success": true,
  "message": "Menu retrieved successfully",
  "data": {
    "restaurant": {
      "id": 1,
      "name": "Pizza Palace"
    },
    "menu": {
      "Pizza": [
        {
          "id": 1,
          "restaurant_id": 1,
          "name": "Margherita Pizza",
          "description": "Classic Italian pizza",
          "price": "12.99",
          "category": "Pizza",
          "image_url": null,
          "is_available": true,
          "preparation_time": 20,
          "created_at": "2026-01-08T05:52:21.786Z",
          "updated_at": "2026-01-08T05:52:21.786Z"
        }
      ]
    },
    "categories": ["Pizza", "Pasta"],
    "totalItems": 5
  }
}
```

#### Error Responses:

**Restaurant Not Found:**
- **Status:** `404 Not Found`
- **Body:**
```json
{
  "success": false,
  "message": "Restaurant not found"
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

### 2. GET `/api/menu-items/:id`

**Description:** Get menu item details by ID

**Access:** Public

**URL Parameters:**
- `id` (integer, required) - Menu item ID

#### Validations Applied:

1. **Menu Item Existence Validation**
   - **Rule:** Menu item must exist
   - **Error Response:**
     - Status: `404 Not Found`
     - Message: `"Menu item not found"`

#### Success Response:
- **Status:** `200 OK`
- **Body:**
```json
{
  "success": true,
  "message": "Menu item retrieved successfully",
  "data": {
    "menuItem": {
      "id": 1,
      "restaurant_id": 1,
      "name": "Margherita Pizza",
      "description": "Classic Italian pizza",
      "price": "12.99",
      "category": "Pizza",
      "image_url": null,
      "is_available": true,
      "preparation_time": 20,
      "created_at": "2026-01-08T05:52:21.786Z",
      "updated_at": "2026-01-08T05:52:21.786Z"
    }
  }
}
```

#### Error Responses:

**Menu Item Not Found:**
- **Status:** `404 Not Found`
- **Body:**
```json
{
  "success": false,
  "message": "Menu item not found"
}
```

---

### 3. POST `/api/restaurants/:restaurantId/menu-items`

**Description:** Create a new menu item for a restaurant

**Access:** Private (restaurant_owner only, must own restaurant)

**Request Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
- `restaurantId` (integer, required) - Restaurant ID

**Request Body:**
```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "price": "number (required)",
  "category": "string (required)",
  "image_url": "string (optional)",
  "preparation_time": "integer (optional)"
}
```

#### Validations Applied:

1. **Required Fields Validation**
   - **Fields:** `name`, `price`, `category`
   - **Rule:** All three fields must be provided
   - **Error Response:**
     - Status: `400 Bad Request`
     - Message: `"Name, price, and category are required"`

2. **Restaurant Existence Validation**
   - **Rule:** Restaurant must exist
   - **Error Response:**
     - Status: `404 Not Found`
     - Message: `"Restaurant not found"`

3. **Restaurant Ownership Validation**
   - **Rule:** User must own the restaurant
   - **Error Response:**
     - Status: `403 Forbidden`
     - Message: `"You can only add menu items to your own restaurants"`

4. **Name Validation** (Model Level)
   - **Field:** `name`
   - **Rule:** Must be between 2-255 characters
   - **Error Response:**
     - Status: `400 Bad Request`
     - Message: `"Menu item name must be between 2 and 255 characters"`

5. **Price Validation** (Model Level)
   - **Field:** `price`
   - **Rule:** Must be >= 0
   - **Error Response:**
     - Status: `400 Bad Request`
     - Message: `"Price must be greater than or equal to 0"`

6. **Category Validation** (Model Level)
   - **Field:** `category`
   - **Rule:** Must not be empty
   - **Error Response:**
     - Status: `400 Bad Request`
     - Message: `"Category is required"`

7. **Preparation Time Validation** (Model Level)
   - **Field:** `preparation_time`
   - **Rule:** If provided, must be >= 0
   - **Error Response:**
     - Status: `400 Bad Request`
     - Message: `"Preparation time must be greater than or equal to 0"`

#### Success Response:
- **Status:** `201 Created`
- **Body:**
```json
{
  "success": true,
  "message": "Menu item created successfully",
  "data": {
    "menuItem": {
      "id": 1,
      "restaurant_id": 1,
      "name": "Margherita Pizza",
      "description": "Classic Italian pizza",
      "price": "12.99",
      "category": "Pizza",
      "image_url": null,
      "is_available": true,
      "preparation_time": 20,
      "created_at": "2026-01-08T05:52:21.786Z",
      "updated_at": "2026-01-08T05:52:21.786Z"
    }
  }
}
```

#### Error Responses:

**Validation Error:**
- **Status:** `400 Bad Request`
- **Body:**
```json
{
  "success": false,
  "message": "Validation error",
  "errors": ["Error message 1", "Error message 2"]
}
```

**Restaurant Not Found:**
- **Status:** `404 Not Found`
- **Body:**
```json
{
  "success": false,
  "message": "Restaurant not found"
}
```

**Forbidden (Not Owner):**
- **Status:** `403 Forbidden`
- **Body:**
```json
{
  "success": false,
  "message": "You can only add menu items to your own restaurants"
}
```

**Unauthorized:**
- **Status:** `401 Unauthorized`
- **Body:**
```json
{
  "success": false,
  "message": "Invalid or expired token"
}
```

---

### 4. PUT `/api/menu-items/:id`

**Description:** Update a menu item

**Access:** Private (restaurant_owner only, must own restaurant)

**Request Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
- `id` (integer, required) - Menu item ID

**Request Body:**
```json
{
  "name": "string (optional)",
  "description": "string (optional)",
  "price": "number (optional)",
  "category": "string (optional)",
  "image_url": "string (optional)",
  "preparation_time": "integer (optional)",
  "is_available": "boolean (optional)"
}
```

#### Validations Applied:

1. **Menu Item Existence Validation**
   - **Rule:** Menu item must exist
   - **Error Response:**
     - Status: `404 Not Found`
     - Message: `"Menu item not found"`

2. **Restaurant Existence Validation**
   - **Rule:** Associated restaurant must exist
   - **Error Response:**
     - Status: `404 Not Found`
     - Message: `"Restaurant not found"`

3. **Restaurant Ownership Validation**
   - **Rule:** User must own the restaurant
   - **Error Response:**
     - Status: `403 Forbidden`
     - Message: `"You can only update menu items from your own restaurants"`

4. **Field-Level Validations** (Model Level)
   - Same validations as create endpoint apply to updated fields

#### Success Response:
- **Status:** `200 OK`
- **Body:**
```json
{
  "success": true,
  "message": "Menu item updated successfully",
  "data": {
    "menuItem": {
      "id": 1,
      "restaurant_id": 1,
      "name": "Updated Pizza Name",
      "price": "14.99",
      "category": "Pizza",
      "is_available": true,
      "updated_at": "2026-01-08T06:00:00.000Z"
    }
  }
}
```

#### Error Responses:

**Validation Error:**
- **Status:** `400 Bad Request`
- **Body:**
```json
{
  "success": false,
  "message": "Validation error",
  "errors": ["Error message 1"]
}
```

**Forbidden (Not Owner):**
- **Status:** `403 Forbidden`
- **Body:**
```json
{
  "success": false,
  "message": "You can only update menu items from your own restaurants"
}
```

---

### 5. DELETE `/api/menu-items/:id`

**Description:** Delete a menu item (soft delete by setting `is_available = false`)

**Access:** Private (restaurant_owner only, must own restaurant)

**Request Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
- `id` (integer, required) - Menu item ID

#### Validations Applied:

1. **Menu Item Existence Validation**
   - **Rule:** Menu item must exist
   - **Error Response:**
     - Status: `404 Not Found`
     - Message: `"Menu item not found"`

2. **Restaurant Ownership Validation**
   - **Rule:** User must own the restaurant
   - **Error Response:**
     - Status: `403 Forbidden`
     - Message: `"You can only delete menu items from your own restaurants"`

#### Success Response:
- **Status:** `200 OK`
- **Body:**
```json
{
  "success": true,
  "message": "Menu item deleted successfully"
}
```

**Note:** This is a soft delete. The menu item's `is_available` field is set to `false`, but the record remains in the database.

---

### 6. PUT `/api/menu-items/:id/toggle-availability`

**Description:** Toggle menu item availability (enable/disable)

**Access:** Private (restaurant_owner only, must own restaurant)

**Request Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
- `id` (integer, required) - Menu item ID

#### Validations Applied:

1. **Menu Item Existence Validation**
   - **Rule:** Menu item must exist
   - **Error Response:**
     - Status: `404 Not Found`
     - Message: `"Menu item not found"`

2. **Restaurant Ownership Validation**
   - **Rule:** User must own the restaurant
   - **Error Response:**
     - Status: `403 Forbidden`
     - Message: `"You can only toggle availability of menu items from your own restaurants"`

#### Success Response:
- **Status:** `200 OK`
- **Body:**
```json
{
  "success": true,
  "message": "Menu item enabled successfully",
  "data": {
    "menuItem": {
      "id": 1,
      "is_available": true,
      "updated_at": "2026-01-08T06:00:00.000Z"
    }
  }
}
```

**Note:** Message will say "enabled" or "disabled" based on the new state.

---

## HTTP Status Codes Used

| Status Code | Meaning | Used In |
|------------|---------|---------|
| `200` | OK | Get menu, Get item, Update item, Delete item, Toggle availability |
| `201` | Created | Create menu item |
| `400` | Bad Request | Validation errors |
| `401` | Unauthorized | Missing/invalid token |
| `403` | Forbidden | Not restaurant owner, not owner of restaurant |
| `404` | Not Found | Restaurant not found, menu item not found |
| `500` | Internal Server Error | Server errors |

---

## Validation Summary

### Field-Level Validations

| Field | Required | Type | Min Length | Max Length | Min Value | Max Value | Format/Pattern |
|-------|----------|------|------------|------------|-----------|-----------|----------------|
| `restaurant_id` | ✅ | integer | - | - | - | - | Must exist in restaurants table |
| `name` | ✅ | string | 2 | 255 | - | - | - |
| `description` | ❌ | text | - | - | - | - | - |
| `price` | ✅ | decimal(10,2) | - | - | 0 | - | - |
| `category` | ✅ | string | - | 100 | - | - | - |
| `image_url` | ❌ | string | - | 500 | - | - | URL format |
| `is_available` | ✅ | boolean | - | - | - | - | Default: true |
| `preparation_time` | ❌ | integer | - | - | 0 | - | Minutes |

### Business Rules

1. **Restaurant Ownership:** Only restaurant owners can create, update, delete, or toggle availability of menu items
2. **Ownership Verification:** Users can only manage menu items for restaurants they own
3. **Soft Delete:** Deleting a menu item sets `is_available = false` instead of removing the record
4. **Category Grouping:** Menu items are automatically grouped by category when retrieved
5. **Availability Filtering:** Menu items can be filtered by `is_available` status
6. **Price Precision:** Prices are stored as DECIMAL(10,2) for accurate currency handling

---

## Access Control

### Public Endpoints
- `GET /api/restaurants/:restaurantId/menu` - Anyone can view restaurant menus
- `GET /api/menu-items/:id` - Anyone can view menu item details

### Private Endpoints (Restaurant Owner Only)
- `POST /api/restaurants/:restaurantId/menu-items` - Create menu item
- `PUT /api/menu-items/:id` - Update menu item
- `DELETE /api/menu-items/:id` - Delete menu item
- `PUT /api/menu-items/:id/toggle-availability` - Toggle availability

**Authentication Requirements:**
- All private endpoints require `Authorization: Bearer <token>` header
- Token must be valid and not expired
- User must have role `restaurant_owner`
- User must own the restaurant associated with the menu item

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
- **Source:** User doesn't own restaurant, wrong role
- **Status:** `403 Forbidden`
- **Response:** Clear message about permission denial

### 4. Not Found Errors
- **Source:** Restaurant or menu item doesn't exist
- **Status:** `404 Not Found`
- **Response:** Clear message about resource not found

### 5. Server Errors
- **Source:** Unexpected errors, database errors
- **Status:** `500 Internal Server Error`
- **Response:** Generic message in production, detailed in development

---

## Model Methods

### Static Methods (MenuItem)

| Method | Description | Parameters |
|--------|-------------|------------|
| `findById(id)` | Find menu item by ID | `id` (integer) |
| `findByRestaurant(restaurantId, options)` | Find all menu items for a restaurant | `restaurantId` (integer), `options` (object) |
| `findByCategory(restaurantId, category)` | Find menu items by category | `restaurantId` (integer), `category` (string) |
| `getCategories(restaurantId)` | Get all unique categories for a restaurant | `restaurantId` (integer) |
| `createMenuItem(menuItemData)` | Create a new menu item | `menuItemData` (object) |
| `updateMenuItem(id, updateData)` | Update a menu item | `id` (integer), `updateData` (object) |
| `toggleAvailability(id)` | Toggle menu item availability | `id` (integer) |

---

## Example Use Cases

### 1. Restaurant Owner Creates Menu Item
```bash
POST /api/restaurants/1/menu-items
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Margherita Pizza",
  "description": "Classic Italian pizza with tomato and mozzarella",
  "price": 12.99,
  "category": "Pizza",
  "preparation_time": 20
}
```

### 2. Customer Views Restaurant Menu
```bash
GET /api/restaurants/1/menu
```

### 3. Restaurant Owner Updates Price
```bash
PUT /api/menu-items/1
Authorization: Bearer <token>
Content-Type: application/json

{
  "price": 14.99
}
```

### 4. Restaurant Owner Temporarily Disables Item
```bash
PUT /api/menu-items/1/toggle-availability
Authorization: Bearer <token>
```

---

## Notes

- Menu items are automatically grouped by category when retrieved via the menu endpoint
- Prices are stored as DECIMAL(10,2) to ensure precision for currency calculations
- Soft delete is used (setting `is_available = false`) to preserve order history
- Category names are case-sensitive and should be consistent (e.g., "Pizza" vs "pizza")
- Preparation time is stored in minutes
- Image URLs can be up to 500 characters
- All timestamps are automatically managed by Sequelize
- Menu items are ordered by category and name when retrieved

---

## Last Updated

**Date:** 2026-01-08  
**Files:** 
- `routes/menu.routes.js`
- `routes/restaurant.routes.js` (menu endpoints)
- `models/MenuItem.model.js`
