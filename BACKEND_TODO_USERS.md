# Backend TODO - User Features

This document lists all features that need to be implemented for users (customers) in the DineFlow backend.

---

## ✅ Completed Features

1. **User Authentication**
   - ✅ User Registration (customer, restaurant_owner, rider)
   - ✅ User Login
   - ✅ User Logout
   - ✅ Get Current User (`/api/auth/me`)
   - ✅ JWT Token Authentication
   - ✅ Password Hashing (bcrypt)

---

## 📋 Features To Implement

### 1. **User Profile Management**

#### 1.1 Update User Profile
- **Route:** `PUT /api/users/profile`
- **Access:** Private (authenticated)
- **Features:**
  - Update name
  - Update phone number
  - Update email (with verification)
  - Profile picture upload (if needed later)

#### 1.2 Change Password
- **Route:** `PUT /api/users/change-password`
- **Access:** Private (authenticated)
- **Features:**
  - Change password with old password verification
  - Password strength validation

#### 1.3 Delete Account
- **Route:** `DELETE /api/users/account`
- **Access:** Private (authenticated)
- **Features:**
  - Soft delete (deactivate account)
  - Option to permanently delete

---

### 2. **Address Management** ⚠️ **HIGH PRIORITY**

#### 2.1 Save Delivery Address
- **Route:** `POST /api/users/addresses`
- **Access:** Private (customer only)
- **Features:**
  - Save multiple delivery addresses
  - Set default address
  - Address validation
  - Location coordinates (lat/long)

#### 2.2 Get User Addresses
- **Route:** `GET /api/users/addresses`
- **Access:** Private (customer only)
- **Features:**
  - List all saved addresses
  - Mark default address

#### 2.3 Update Address
- **Route:** `PUT /api/users/addresses/:id`
- **Access:** Private (customer only)
- **Features:**
  - Update address details
  - Change default address

#### 2.4 Delete Address
- **Route:** `DELETE /api/users/addresses/:id`
- **Access:** Private (customer only)

**Database Model Needed:**
- `Address` model (user_id, address_line, city, state, zip, latitude, longitude, is_default)

---

### 3. **Restaurant Management** ⚠️ **HIGH PRIORITY**

#### 3.1 List Restaurants
- **Route:** `GET /api/restaurants`
- **Access:** Public
- **Features:**
  - Pagination
  - Filter by cuisine type
  - Filter by location/area
  - Sort by rating, distance, popularity
  - Search by name

#### 3.2 Get Restaurant Details
- **Route:** `GET /api/restaurants/:id`
- **Access:** Public
- **Features:**
  - Restaurant info
  - Menu items
  - Reviews/ratings
  - Opening hours
  - Delivery time estimate

#### 3.3 Restaurant Registration (for restaurant owners)
- **Route:** `POST /api/restaurants`
- **Access:** Private (restaurant_owner only)
- **Features:**
  - Create restaurant profile
  - Add location, cuisine type, etc.

**Database Model Needed:**
- `Restaurant` model (owner_id, name, description, address, cuisine_type, etc.)

---

### 4. **Menu Items Management** ⚠️ **HIGH PRIORITY**

#### 4.1 Get Restaurant Menu
- **Route:** `GET /api/restaurants/:id/menu`
- **Access:** Public
- **Features:**
  - List all menu items
  - Group by category
  - Filter by availability

#### 4.2 Get Menu Item Details
- **Route:** `GET /api/menu-items/:id`
- **Access:** Public
- **Features:**
  - Item details
  - Price, description, image
  - Availability status

**Database Model Needed:**
- `MenuItem` model (restaurant_id, name, description, price, category, image_url, is_available)

---

### 5. **Cart Management** ⚠️ **HIGH PRIORITY**

#### 5.1 Add Item to Cart
- **Route:** `POST /api/cart/items`
- **Access:** Private (customer only)
- **Features:**
  - Add menu item to cart
  - Update quantity
  - Calculate subtotal

#### 5.2 Get Cart
- **Route:** `GET /api/cart`
- **Access:** Private (customer only)
- **Features:**
  - View all cart items
  - Calculate total
  - Show delivery fee estimate

#### 5.3 Update Cart Item
- **Route:** `PUT /api/cart/items/:id`
- **Access:** Private (customer only)
- **Features:**
  - Update quantity
  - Remove item

#### 5.4 Clear Cart
- **Route:** `DELETE /api/cart`
- **Access:** Private (customer only)

**Database Model Needed:**
- `Cart` model (user_id, restaurant_id, created_at)
- `CartItem` model (cart_id, menu_item_id, quantity, price)

---

### 6. **Order Management** ⚠️ **HIGH PRIORITY**

#### 6.1 Create Order
- **Route:** `POST /api/orders`
- **Access:** Private (customer only)
- **Features:**
  - Create order from cart
  - Select delivery address
  - Calculate total (items + delivery fee + tax)
  - Payment method selection
  - Generate order number

#### 6.2 Get User Orders
- **Route:** `GET /api/orders`
- **Access:** Private (customer only)
- **Features:**
  - List all user orders
  - Filter by status (pending, delivered, cancelled)
  - Pagination
  - Sort by date

#### 6.3 Get Order Details
- **Route:** `GET /api/orders/:id`
- **Access:** Private (customer only)
- **Features:**
  - Order details
  - Order items
  - Order status
  - Delivery address
  - Payment status

#### 6.4 Cancel Order
- **Route:** `PUT /api/orders/:id/cancel`
- **Access:** Private (customer only)
- **Features:**
  - Cancel order (if allowed)
  - Refund processing

#### 6.5 Track Order
- **Route:** `GET /api/orders/:id/track`
- **Access:** Private (customer only)
- **Features:**
  - Real-time order status
  - Estimated delivery time
  - Rider location (if assigned)

**Database Models Needed:**
- `Order` model (customer_id, restaurant_id, rider_id, status, total_amount, etc.)
- `OrderItem` model (order_id, menu_item_id, quantity, price)
- `OrderTracking` model (order_id, status, timestamp, notes)

---

### 7. **Payment Management**

#### 7.1 Payment Methods
- **Route:** `GET /api/payments/methods`
- **Access:** Private (customer only)
- **Features:**
  - List saved payment methods
  - Add payment method
  - Set default payment method
  - Delete payment method

#### 7.2 Process Payment
- **Route:** `POST /api/payments/process`
- **Access:** Private (customer only)
- **Features:**
  - Process payment for order
  - Payment gateway integration
  - Payment status tracking

**Database Model Needed:**
- `PaymentMethod` model (user_id, type, details, is_default)
- `Payment` model (order_id, amount, status, transaction_id)

---

### 8. **Reviews & Ratings**

#### 8.1 Add Review
- **Route:** `POST /api/restaurants/:id/reviews`
- **Access:** Private (customer only)
- **Features:**
  - Rate restaurant (1-5 stars)
  - Write review comment
  - Only after order delivery

#### 8.2 Get Restaurant Reviews
- **Route:** `GET /api/restaurants/:id/reviews`
- **Access:** Public
- **Features:**
  - List all reviews
  - Pagination
  - Sort by date, rating

#### 8.3 Update/Delete Review
- **Route:** `PUT /api/reviews/:id` or `DELETE /api/reviews/:id`
- **Access:** Private (customer only - own reviews)

**Database Model Needed:**
- `Review` model (user_id, restaurant_id, order_id, rating, comment)

---

### 9. **Favorites & Preferences**

#### 9.1 Favorite Restaurants
- **Route:** `POST /api/restaurants/:id/favorite`
- **Route:** `DELETE /api/restaurants/:id/favorite`
- **Route:** `GET /api/users/favorites`
- **Access:** Private (customer only)
- **Features:**
  - Add/remove favorite restaurants
  - List favorite restaurants

#### 9.2 User Preferences
- **Route:** `GET /api/users/preferences`
- **Route:** `PUT /api/users/preferences`
- **Access:** Private (customer only)
- **Features:**
  - Dietary preferences
  - Cuisine preferences
  - Notification preferences

**Database Model Needed:**
- `FavoriteRestaurant` model (user_id, restaurant_id)
- `UserPreference` model (user_id, preferences_json)

---

### 10. **Notifications**

#### 10.1 Get Notifications
- **Route:** `GET /api/notifications`
- **Access:** Private (customer only)
- **Features:**
  - List notifications
  - Mark as read
  - Filter by type

#### 10.2 Notification Preferences
- **Route:** `PUT /api/users/notification-settings`
- **Access:** Private (customer only)

**Database Model Needed:**
- `Notification` model (user_id, type, message, is_read, created_at)

---

### 11. **Search & Discovery**

#### 11.1 Search Restaurants
- **Route:** `GET /api/search/restaurants?q=query`
- **Access:** Public
- **Features:**
  - Search by name, cuisine
  - Location-based search
  - Filters and sorting

#### 11.2 Search Menu Items
- **Route:** `GET /api/search/menu-items?q=query`
- **Access:** Public
- **Features:**
  - Search menu items across restaurants
  - Filter by price, cuisine

---

### 12. **Support & Help**

#### 12.1 Contact Support
- **Route:** `POST /api/support/contact`
- **Access:** Private (customer only)
- **Features:**
  - Submit support ticket
  - Query about order

#### 12.2 FAQ
- **Route:** `GET /api/support/faq`
- **Access:** Public

---

## 📊 Priority Order

### **Phase 1: Core Ordering Flow** (Must Have)
1. ✅ User Authentication (DONE)
2. ⚠️ Address Management
3. ⚠️ Restaurant Listing & Details
4. ⚠️ Menu Items
5. ⚠️ Cart Management
6. ⚠️ Order Creation & Management
7. ⚠️ Order Tracking

### **Phase 2: Enhanced Experience** (Should Have)
8. Payment Integration
9. Reviews & Ratings
10. Search & Discovery
11. Favorites

### **Phase 3: Additional Features** (Nice to Have)
12. User Preferences
13. Notifications
14. Support/Help

---

## 🗄️ Database Models Needed

### High Priority Models:
1. **Restaurant** - Restaurant information
2. **MenuItem** - Menu items for restaurants
3. **Address** - User delivery addresses
4. **Cart** - Shopping cart
5. **CartItem** - Items in cart
6. **Order** - Customer orders
7. **OrderItem** - Items in order
8. **OrderTracking** - Order status tracking

### Medium Priority Models:
9. **Review** - Restaurant reviews
10. **Payment** - Payment transactions
11. **PaymentMethod** - Saved payment methods
12. **FavoriteRestaurant** - User favorites

### Low Priority Models:
13. **Notification** - User notifications
14. **UserPreference** - User preferences

---

## 📁 File Structure Needed

```
backend/
├── models/
│   ├── User.model.js ✅
│   ├── Restaurant.model.js ⚠️
│   ├── MenuItem.model.js ⚠️
│   ├── Address.model.js ⚠️
│   ├── Cart.model.js ⚠️
│   ├── CartItem.model.js ⚠️
│   ├── Order.model.js ⚠️
│   ├── OrderItem.model.js ⚠️
│   ├── Review.model.js ⚠️
│   └── ...
├── routes/
│   ├── auth.routes.js ✅
│   ├── user.routes.js ⚠️ (profile, addresses)
│   ├── restaurant.routes.js ⚠️
│   ├── menu.routes.js ⚠️
│   ├── cart.routes.js ⚠️
│   ├── order.routes.js ⚠️
│   ├── review.routes.js ⚠️
│   └── ...
├── controllers/
│   ├── user.controller.js ⚠️
│   ├── restaurant.controller.js ⚠️
│   ├── order.controller.js ⚠️
│   └── ...
└── middleware/
    ├── auth.middleware.js ✅
    ├── role.middleware.js ⚠️ (role-based access)
    └── ...
```

---

## 🔐 Middleware Needed

1. ✅ `authenticateToken` - Already done
2. ⚠️ `requireRole(['customer'])` - Role-based access control
3. ⚠️ `validateOwnership` - Check if user owns resource
4. ⚠️ `validateOrderStatus` - Check if order can be modified

---

## 📝 Summary

### Completed: 1/12 Major Features
- ✅ Authentication System

### Remaining: 11/12 Major Features
- ⚠️ User Profile Management
- ⚠️ Address Management
- ⚠️ Restaurant Management
- ⚠️ Menu Items
- ⚠️ Cart Management
- ⚠️ Order Management
- ⚠️ Payment Integration
- ⚠️ Reviews & Ratings
- ⚠️ Favorites
- ⚠️ Search & Discovery
- ⚠️ Notifications
- ⚠️ Support

### Estimated Models Needed: 14
### Estimated Routes Needed: 30+
### Estimated Controllers Needed: 8+

---

## 🎯 Next Steps Recommendation

**Start with Phase 1: Core Ordering Flow**

1. **Restaurant Model & Routes** (Foundation)
2. **MenuItem Model & Routes** (Foundation)
3. **Address Model & Routes** (Required for orders)
4. **Cart Model & Routes** (Shopping experience)
5. **Order Model & Routes** (Core feature)
6. **Order Tracking** (User experience)

This will enable the complete ordering flow from browsing restaurants to placing and tracking orders.

---

**Last Updated:** Current Session  
**Status:** Planning Phase
