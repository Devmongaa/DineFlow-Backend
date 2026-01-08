# Cart Management Routes - Validation Documentation

This document records all validations, rules, and error handling used in cart management routes.

---

## Overview

**Base Path:** `/api/cart`

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

## Model Structures

### Database Table: `carts`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | INTEGER | ✅ | Auto | Primary key |
| `user_id` | INTEGER | ✅ | - | Foreign key to `users.id` |
| `restaurant_id` | INTEGER | ✅ | - | Foreign key to `restaurants.id` |
| `created_at` | TIMESTAMP | ✅ | Auto | Creation timestamp |
| `updated_at` | TIMESTAMP | ✅ | Auto | Update timestamp |

### Database Table: `cart_items`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | INTEGER | ✅ | Auto | Primary key |
| `cart_id` | INTEGER | ✅ | - | Foreign key to `carts.id` |
| `menu_item_id` | INTEGER | ✅ | - | Foreign key to `menu_items.id` |
| `quantity` | INTEGER | ✅ | 1 | Item quantity |
| `price` | DECIMAL(10,2) | ✅ | - | Price snapshot when added to cart |
| `created_at` | TIMESTAMP | ✅ | Auto | Creation timestamp |
| `updated_at` | TIMESTAMP | ✅ | Auto | Update timestamp |

---

## Endpoints

### 1. GET `/api/cart`

**Description:** Get current user's cart with all items and summary

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

#### Success Response (Empty Cart):
- **Status:** `200 OK`
- **Body:**
```json
{
  "success": true,
  "message": "Cart is empty",
  "data": {
    "cart": null,
    "summary": {
      "subtotal": "0.00",
      "delivery_fee": "0.00",
      "total": "0.00",
      "item_count": 0
    }
  }
}
```

#### Success Response (Cart with Items):
- **Status:** `200 OK`
- **Body:**
```json
{
  "success": true,
  "message": "Cart retrieved successfully",
  "data": {
    "cart": {
      "id": 1,
      "restaurant": {
        "id": 1,
        "name": "Pizza Palace",
        "image_url": null
      },
      "items": [
        {
          "id": 1,
          "menu_item": {
            "id": 1,
            "name": "Margherita Pizza",
            "description": "Classic Italian pizza",
            "image_url": null,
            "category": "Pizza",
            "current_price": "12.99",
            "is_available": true
          },
          "quantity": 2,
          "price": "12.99",
          "subtotal": "25.98"
        }
      ]
    },
    "summary": {
      "subtotal": "25.98",
      "delivery_fee": "5.00",
      "total": "30.98",
      "item_count": 2
    }
  }
}
```

#### Error Responses:

**Unauthorized:**
- **Status:** `401 Unauthorized`
- **Body:**
```json
{
  "success": false,
  "message": "Invalid or expired token"
}
```

**Forbidden:**
- **Status:** `403 Forbidden`
- **Body:**
```json
{
  "success": false,
  "message": "Access denied"
}
```

---

### 2. POST `/api/cart/items`

**Description:** Add item to cart or update quantity if item already exists

**Access:** Private (customer only)

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "menu_item_id": 1,
  "quantity": 2
}
```

#### Validations Applied:

1. **Required Fields Validation**
   - **Field:** `menu_item_id`
   - **Rule:** Must be provided
   - **Error Response:**
     - Status: `400 Bad Request`
     - Message: `"Menu item ID is required"`

2. **Quantity Validation**
   - **Field:** `quantity`
   - **Rule:** Must be a positive integer (default: 1)
   - **Error Response:**
     - Status: `400 Bad Request`
     - Message: `"Quantity must be a positive integer"`

3. **Menu Item Existence Validation**
   - **Rule:** Menu item must exist
   - **Error Response:**
     - Status: `404 Not Found`
     - Message: `"Menu item not found"`

4. **Menu Item Availability Validation**
   - **Rule:** Menu item must be available (`is_available = true`)
   - **Error Response:**
     - Status: `400 Bad Request`
     - Message: `"This item is currently unavailable"`

5. **Restaurant Status Validation**
   - **Rule:** Restaurant must be active and accepting orders
   - **Error Response:**
     - Status: `400 Bad Request`
     - Message: `"This restaurant is currently not accepting orders"`

6. **Single Restaurant Rule**
   - **Rule:** All items in cart must be from the same restaurant
   - **Error Response:**
     - Status: `400 Bad Request`
     - Message: `"You already have items from another restaurant in your cart. Please clear your cart first."`

#### Success Response:
- **Status:** `200 OK`
- **Body:**
```json
{
  "success": true,
  "message": "Item added to cart successfully",
  "data": {
    "cart_item": {
      "id": 1,
      "menu_item_id": 1,
      "quantity": 2,
      "price": "12.99"
    },
    "cart": {
      "id": 1,
      "restaurant_id": 1,
      "item_count": 1,
      "subtotal": "25.98"
    }
  }
}
```

**Note:** If the item already exists in cart, the quantity is incremented by the provided quantity.

---

### 3. PUT `/api/cart/items/:id`

**Description:** Update cart item quantity

**Access:** Private (customer only)

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**URL Parameters:**
- `id` (integer, required) - Cart item ID

**Request Body:**
```json
{
  "quantity": 3
}
```

#### Validations Applied:

1. **Quantity Validation**
   - **Field:** `quantity`
   - **Rule:** Must be a positive integer
   - **Error Response:**
     - Status: `400 Bad Request`
     - Message: `"Quantity must be a positive integer"`

2. **Cart Item Existence Validation**
   - **Rule:** Cart item must exist
   - **Error Response:**
     - Status: `404 Not Found`
     - Message: `"Cart item not found"`

3. **Cart Ownership Validation**
   - **Rule:** Cart must belong to the authenticated user
   - **Error Response:**
     - Status: `403 Forbidden`
     - Message: `"You can only update items in your own cart"`

#### Success Response:
- **Status:** `200 OK`
- **Body:**
```json
{
  "success": true,
  "message": "Cart item updated successfully",
  "data": {
    "cart_item": {
      "id": 1,
      "menu_item_id": 1,
      "quantity": 3,
      "price": "12.99",
      "subtotal": "38.97"
    },
    "cart": {
      "id": 1,
      "subtotal": "38.97"
    }
  }
}
```

---

### 4. DELETE `/api/cart/items/:id`

**Description:** Remove item from cart

**Access:** Private (customer only)

**Request Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
- `id` (integer, required) - Cart item ID

#### Validations Applied:

1. **Cart Item Existence Validation**
   - **Rule:** Cart item must exist
   - **Error Response:**
     - Status: `404 Not Found`
     - Message: `"Cart item not found"`

2. **Cart Ownership Validation**
   - **Rule:** Cart must belong to the authenticated user
   - **Error Response:**
     - Status: `403 Forbidden`
     - Message: `"You can only remove items from your own cart"`

#### Success Response (Cart Still Has Items):
- **Status:** `200 OK`
- **Body:**
```json
{
  "success": true,
  "message": "Item removed from cart successfully",
  "data": {
    "cart": {
      "id": 1,
      "item_count": 1,
      "subtotal": "12.99"
    }
  }
}
```

#### Success Response (Cart Now Empty):
- **Status:** `200 OK`
- **Body:**
```json
{
  "success": true,
  "message": "Item removed from cart. Cart is now empty.",
  "data": {
    "cart": null
  }
}
```

**Note:** If removing the last item makes the cart empty, the cart is automatically deleted.

---

### 5. DELETE `/api/cart`

**Description:** Clear entire cart (remove all items and delete cart)

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

#### Success Response (Cart Exists):
- **Status:** `200 OK`
- **Body:**
```json
{
  "success": true,
  "message": "Cart cleared successfully"
}
```

#### Success Response (Cart Already Empty):
- **Status:** `200 OK`
- **Body:**
```json
{
  "success": true,
  "message": "Cart is already empty"
}
```

---

## HTTP Status Codes Used

| Status Code | Meaning | Used In |
|------------|---------|---------|
| `200` | OK | Get cart, Add item, Update item, Remove item, Clear cart |
| `400` | Bad Request | Validation errors, unavailable items, restaurant not accepting orders |
| `401` | Unauthorized | Missing/invalid token |
| `403` | Forbidden | Not customer role, not cart owner |
| `404` | Not Found | Menu item not found, cart item not found |
| `500` | Internal Server Error | Server errors |

---

## Validation Summary

### Field-Level Validations

| Field | Required | Type | Min Value | Max Value | Description |
|-------|----------|------|-----------|-----------|-------------|
| `menu_item_id` | ✅ | integer | - | - | Must exist and be available |
| `quantity` | ✅ | integer | 1 | - | Must be positive integer |
| `price` | ✅ | decimal(10,2) | 0 | - | Price snapshot when added |

### Business Rules

1. **Single Restaurant Per Cart:** All items in a cart must be from the same restaurant. If a user tries to add an item from a different restaurant, they must clear their cart first.

2. **Price Snapshot:** The menu item price is stored when added to cart. If the restaurant changes the price later, items already in the cart maintain their original price.

3. **Auto Cart Creation:** A cart is automatically created when the first item is added.

4. **Auto Cart Deletion:** If the last item is removed from the cart, the cart is automatically deleted.

5. **Quantity Updates:** If an item already exists in the cart, adding it again increments the quantity rather than creating a duplicate entry.

6. **Availability Checks:** Only available menu items can be added to cart. The system checks both item availability and restaurant status.

7. **Calculations:**
   - **Subtotal:** Sum of (quantity × price) for all cart items
   - **Delivery Fee:** Fixed at $5.00 (can be made dynamic later)
   - **Total:** Subtotal + Delivery Fee

---

## Access Control

### Private Endpoints (Customer Only)
- `GET /api/cart` - Get cart
- `POST /api/cart/items` - Add item to cart
- `PUT /api/cart/items/:id` - Update cart item
- `DELETE /api/cart/items/:id` - Remove cart item
- `DELETE /api/cart` - Clear cart

**Authentication Requirements:**
- All endpoints require `Authorization: Bearer <token>` header
- Token must be valid and not expired
- User must have role `customer`
- Users can only manage their own cart

---

## Error Handling Patterns

### 1. Validation Errors
- **Source:** Input validation, model validation
- **Status:** `400 Bad Request`
- **Response:** Includes specific error messages

### 2. Authentication Errors
- **Source:** Missing/invalid token, expired token
- **Status:** `401 Unauthorized`
- **Response:** Generic message (security best practice)

### 3. Authorization Errors
- **Source:** Wrong role, not cart owner
- **Status:** `403 Forbidden`
- **Response:** Clear message about permission denial

### 4. Not Found Errors
- **Source:** Menu item or cart item doesn't exist
- **Status:** `404 Not Found`
- **Response:** Clear message about resource not found

### 5. Business Rule Violations
- **Source:** Single restaurant rule, availability checks
- **Status:** `400 Bad Request`
- **Response:** Clear message explaining the business rule

### 6. Server Errors
- **Source:** Unexpected errors, database errors
- **Status:** `500 Internal Server Error`
- **Response:** Generic message in production, detailed in development

---

## Model Methods

### Cart Model Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `findByUser(userId)` | Find cart by user ID | `userId` (integer) |
| `findOrCreateForUser(userId, restaurantId)` | Find or create cart for user | `userId` (integer), `restaurantId` (integer) |
| `createCart(cartData)` | Create a new cart | `cartData` (object) |
| `clearCart(cartId)` | Clear all items from cart | `cartId` (integer) |
| `deleteCart(cartId)` | Delete cart and all items | `cartId` (integer) |

### CartItem Model Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `findById(id)` | Find cart item by ID | `id` (integer) |
| `findByCartAndMenuItem(cartId, menuItemId)` | Find item in cart | `cartId` (integer), `menuItemId` (integer) |
| `findByCart(cartId)` | Find all items in cart | `cartId` (integer) |
| `addOrUpdateItem(cartId, menuItemId, quantity, price)` | Add or update item | `cartId`, `menuItemId`, `quantity`, `price` |
| `updateQuantity(id, quantity)` | Update item quantity | `id` (integer), `quantity` (integer) |
| `removeItem(id)` | Remove item from cart | `id` (integer) |
| `calculateSubtotal(cartId)` | Calculate cart subtotal | `cartId` (integer) |

---

## Example Use Cases

### 1. Customer Adds Item to Cart
```bash
POST /api/cart/items
Authorization: Bearer <token>
Content-Type: application/json

{
  "menu_item_id": 1,
  "quantity": 2
}
```

### 2. Customer Views Cart
```bash
GET /api/cart
Authorization: Bearer <token>
```

### 3. Customer Updates Quantity
```bash
PUT /api/cart/items/1
Authorization: Bearer <token>
Content-Type: application/json

{
  "quantity": 3
}
```

### 4. Customer Removes Item
```bash
DELETE /api/cart/items/1
Authorization: Bearer <token>
```

### 5. Customer Clears Cart
```bash
DELETE /api/cart
Authorization: Bearer <token>
```

---

## Notes

- Cart is automatically created when first item is added
- Cart is automatically deleted when last item is removed
- Price snapshot ensures customers pay the price at time of adding to cart
- All items in cart must be from the same restaurant
- Delivery fee is currently fixed at $5.00 (can be made dynamic based on distance/restaurant settings)
- Cart items include both snapshot price and current menu price for comparison
- System validates restaurant is active and accepting orders before allowing items to be added
- Quantity must be a positive integer (minimum 1)
- All timestamps are automatically managed by Sequelize

---

## Last Updated

**Date:** 2026-01-08  
**Files:** 
- `routes/cart.routes.js`
- `models/Cart.model.js`
- `models/CartItem.model.js`
