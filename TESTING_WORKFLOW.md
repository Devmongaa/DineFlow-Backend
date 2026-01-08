# Complete Workflow Testing Guide

This document provides curl commands to test the complete ordering workflow.

---

## Prerequisites

1. **Server running:** `http://localhost:4000`
2. **Customer user created:** `avdeep@example.com` / `Avdeep@123`
3. **Restaurant owner user created** (for checking orders)
4. **At least one restaurant created**
5. **Menu items added to restaurant**

---

## Step-by-Step Workflow Testing

### Step 1: Customer Login ✅

**Get JWT token for customer:**

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "avdeep@example.com",
    "password": "Avdeep@123"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "email": "avdeep@example.com",
      "name": "Avdeep",
      "role": "customer"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Save the token:** `CUSTOMER_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`

---

### Step 2: Select Restaurant ✅

**List all restaurants:**

```bash
curl http://localhost:4000/api/restaurants
```

**List restaurants by city:**

```bash
curl "http://localhost:4000/api/restaurants?city=Mumbai"
```

**Get available cities:**

```bash
curl http://localhost:4000/api/restaurants/cities
```

**Get restaurant details:**

```bash
curl http://localhost:4000/api/restaurants/1
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Restaurant retrieved successfully",
  "data": {
    "restaurant": {
      "id": 1,
      "name": "Pizza Palace",
      "description": "...",
      "city": "Mumbai",
      "is_active": true,
      "is_accepting_orders": true
    }
  }
}
```

**Note the restaurant ID:** `RESTAURANT_ID=1`

---

### Step 3: Fetch Menu Items ✅

**Get restaurant menu (all items grouped by category):**

```bash
curl http://localhost:4000/api/restaurants/1/menu
```

**Get menu with filters:**

```bash
# Filter by category
curl "http://localhost:4000/api/restaurants/1/menu?category=Pizza"

# Filter by availability
curl "http://localhost:4000/api/restaurants/1/menu?is_available=true"
```

**Get specific menu item:**

```bash
curl http://localhost:4000/api/menu-items/1
```

**Expected Response:**
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
          "name": "Margherita Pizza",
          "price": "12.99",
          "category": "Pizza",
          "is_available": true
        }
      ]
    },
    "categories": ["Pizza"],
    "totalItems": 1
  }
}
```

**Note menu item IDs:** `MENU_ITEM_ID=1`

---

### Step 4: Add Items to Cart ✅

**Add item to cart:**

```bash
curl -X POST http://localhost:4000/api/cart/items \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "menu_item_id": 1,
    "quantity": 2
  }'
```

**Add another item:**

```bash
curl -X POST http://localhost:4000/api/cart/items \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "menu_item_id": 2,
    "quantity": 1
  }'
```

**View cart:**

```bash
curl http://localhost:4000/api/cart \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Cart retrieved successfully",
  "data": {
    "cart": {
      "id": 1,
      "restaurant": {
        "id": 1,
        "name": "Pizza Palace"
      },
      "items": [
        {
          "id": 1,
          "menu_item": {
            "id": 1,
            "name": "Margherita Pizza",
            "price": "12.99"
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
      "item_count": 1
    }
  }
}
```

---

### Step 5: Create Address (if not exists) ✅

**Create delivery address:**

```bash
curl -X POST http://localhost:4000/api/addresses \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "address_line": "123 Main Street, Building A",
    "city": "Mumbai",
    "state": "Maharashtra",
    "zip_code": "400001",
    "is_default": true,
    "label": "Home"
  }'
```

**Get all addresses:**

```bash
curl http://localhost:4000/api/addresses \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Address created successfully",
  "data": {
    "address": {
      "id": 1,
      "address_line": "123 Main Street, Building A",
      "city": "Mumbai",
      "is_default": true
    }
  }
}
```

**Note the address ID:** `ADDRESS_ID=1`

---

### Step 6: Place Order ✅

**Create order from cart:**

```bash
curl -X POST http://localhost:4000/api/orders \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "address_id": 1
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Order placed successfully",
  "data": {
    "order": {
      "id": 1,
      "order_number": "ORD-20260108-001",
      "status": "pending",
      "subtotal": "25.98",
      "delivery_fee": "5.00",
      "total_amount": "30.98",
      "created_at": "2026-01-08T06:00:00.000Z"
    },
    "items": [
      {
        "id": 1,
        "menu_item_id": 1,
        "item_name": "Margherita Pizza",
        "quantity": 2,
        "price": "12.99"
      }
    ]
  }
}
```

**Note the order ID:** `ORDER_ID=1`

**Verify cart is cleared:**

```bash
curl http://localhost:4000/api/cart \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```

**Should return:** `"Cart is empty"`

---

### Step 7: Check Order on Restaurant's End ✅

**First, login as restaurant owner:**

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "restaurant@owner.com",
    "password": "Restaurant@123"
  }'
```

**Save restaurant owner token:** `RESTAURANT_OWNER_TOKEN="..."`

**Get all orders for restaurant owner:**

```bash
curl "http://localhost:4000/api/orders/restaurant/my-orders" \
  -H "Authorization: Bearer $RESTAURANT_OWNER_TOKEN"
```

**Get only pending orders (new orders):**

```bash
curl "http://localhost:4000/api/orders/restaurant/my-orders?status=pending" \
  -H "Authorization: Bearer $RESTAURANT_OWNER_TOKEN"
```

**Get orders for specific restaurant:**

```bash
curl "http://localhost:4000/api/orders/restaurant/my-orders?restaurant_id=1" \
  -H "Authorization: Bearer $RESTAURANT_OWNER_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Restaurant orders retrieved successfully",
  "data": {
    "orders": [
      {
        "id": 1,
        "order_number": "ORD-20260108-001",
        "status": "pending",
        "customer": {
          "id": 1,
          "name": "Avdeep",
          "phone": "1234567890"
        },
        "restaurant": {
          "id": 1,
          "name": "Pizza Palace"
        },
        "delivery_address": {
          "address_line": "123 Main Street, Building A",
          "city": "Mumbai"
        },
        "subtotal": "25.98",
        "delivery_fee": "5.00",
        "total_amount": "30.98",
        "item_count": 1,
        "created_at": "2026-01-08T06:00:00.000Z"
      }
    ],
    "count": 1
  }
}
```

**Get specific order details:**

```bash
curl http://localhost:4000/api/orders/1 \
  -H "Authorization: Bearer $RESTAURANT_OWNER_TOKEN"
```

---

## Complete Workflow Script

Here's a complete bash script to test the entire workflow:

```bash
#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== DineFlow Workflow Testing ===${NC}\n"

# Step 1: Customer Login
echo -e "${GREEN}Step 1: Customer Login${NC}"
CUSTOMER_RESPONSE=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "avdeep@example.com",
    "password": "Avdeep@123"
  }')

CUSTOMER_TOKEN=$(echo $CUSTOMER_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "Customer Token: $CUSTOMER_TOKEN"
echo ""

# Step 2: List Restaurants
echo -e "${GREEN}Step 2: List Restaurants${NC}"
curl -s http://localhost:4000/api/restaurants | jq '.'
echo ""

# Step 3: Get Restaurant Menu
echo -e "${GREEN}Step 3: Get Restaurant Menu${NC}"
curl -s http://localhost:4000/api/restaurants/1/menu | jq '.'
echo ""

# Step 4: Add to Cart
echo -e "${GREEN}Step 4: Add Items to Cart${NC}"
curl -s -X POST http://localhost:4000/api/cart/items \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "menu_item_id": 1,
    "quantity": 2
  }' | jq '.'
echo ""

# Step 5: View Cart
echo -e "${GREEN}Step 5: View Cart${NC}"
curl -s http://localhost:4000/api/cart \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" | jq '.'
echo ""

# Step 6: Create Address (if needed)
echo -e "${GREEN}Step 6: Create Address${NC}"
ADDRESS_RESPONSE=$(curl -s -X POST http://localhost:4000/api/addresses \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "address_line": "123 Main Street, Building A",
    "city": "Mumbai",
    "state": "Maharashtra",
    "zip_code": "400001",
    "is_default": true,
    "label": "Home"
  }')

ADDRESS_ID=$(echo $ADDRESS_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
echo "Address ID: $ADDRESS_ID"
echo ""

# Step 7: Place Order
echo -e "${GREEN}Step 7: Place Order${NC}"
ORDER_RESPONSE=$(curl -s -X POST http://localhost:4000/api/orders \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"address_id\": $ADDRESS_ID
  }")

ORDER_ID=$(echo $ORDER_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
ORDER_NUMBER=$(echo $ORDER_RESPONSE | grep -o '"order_number":"[^"]*' | cut -d'"' -f4)
echo "Order ID: $ORDER_ID"
echo "Order Number: $ORDER_NUMBER"
echo $ORDER_RESPONSE | jq '.'
echo ""

# Step 8: Restaurant Owner Login
echo -e "${GREEN}Step 8: Restaurant Owner Login${NC}"
RESTAURANT_OWNER_RESPONSE=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "restaurant@owner.com",
    "password": "Restaurant@123"
  }')

RESTAURANT_OWNER_TOKEN=$(echo $RESTAURANT_OWNER_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "Restaurant Owner Token: $RESTAURANT_OWNER_TOKEN"
echo ""

# Step 9: Check Orders on Restaurant End
echo -e "${GREEN}Step 9: Check Orders on Restaurant End${NC}"
echo "All orders:"
curl -s "http://localhost:4000/api/orders/restaurant/my-orders" \
  -H "Authorization: Bearer $RESTAURANT_OWNER_TOKEN" | jq '.'
echo ""

echo "Pending orders only:"
curl -s "http://localhost:4000/api/orders/restaurant/my-orders?status=pending" \
  -H "Authorization: Bearer $RESTAURANT_OWNER_TOKEN" | jq '.'
echo ""

echo -e "${GREEN}✅ Workflow Testing Complete!${NC}"
```

---

## Quick Reference: All Curl Commands

### 1. Customer Login
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "avdeep@example.com", "password": "Avdeep@123"}'
```

### 2. List Restaurants
```bash
curl http://localhost:4000/api/restaurants
```

### 3. Get Restaurant Menu
```bash
curl http://localhost:4000/api/restaurants/1/menu
```

### 4. Add to Cart
```bash
curl -X POST http://localhost:4000/api/cart/items \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"menu_item_id": 1, "quantity": 2}'
```

### 5. View Cart
```bash
curl http://localhost:4000/api/cart \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```

### 6. Create Address
```bash
curl -X POST http://localhost:4000/api/addresses \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "address_line": "123 Main Street",
    "city": "Mumbai",
    "is_default": true
  }'
```

### 7. Place Order
```bash
curl -X POST http://localhost:4000/api/orders \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"address_id": 1}'
```

### 8. Restaurant Owner - View Orders
```bash
curl "http://localhost:4000/api/orders/restaurant/my-orders?status=pending" \
  -H "Authorization: Bearer $RESTAURANT_OWNER_TOKEN"
```

---

## Testing Checklist

- [ ] Customer can login
- [ ] Customer can list restaurants
- [ ] Customer can view restaurant menu
- [ ] Customer can add items to cart
- [ ] Customer can view cart
- [ ] Customer can create address
- [ ] Customer can place order
- [ ] Cart is cleared after order
- [ ] Restaurant owner can login
- [ ] Restaurant owner can see new orders
- [ ] Restaurant owner can filter orders by status
- [ ] Restaurant owner can view order details

---

## Troubleshooting

### If cart is empty:
- Make sure menu items exist in the restaurant
- Check if menu items are available (`is_available: true`)
- Check if restaurant is accepting orders

### If order creation fails:
- Make sure cart has items
- Make sure address belongs to the customer
- Make sure restaurant is active and accepting orders

### If restaurant owner can't see orders:
- Make sure restaurant owner owns the restaurant
- Check if order was created successfully
- Verify restaurant_id matches

---

**Last Updated:** 2026-01-08
