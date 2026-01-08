# Rating and Review System - Implementation Plan

## Overview
Implement a comprehensive rating and review system where customers can rate and review restaurants only after placing an order. Users can update their ratings and reviews.

---

## Database Design

### 1. Review Model (`reviews` table)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Review ID |
| `customer_id` | INTEGER | NOT NULL, FK → users.id | Customer who wrote the review |
| `restaurant_id` | INTEGER | NOT NULL, FK → restaurants.id | Restaurant being reviewed |
| `order_id` | INTEGER | NOT NULL, FK → orders.id | Order that qualifies the review |
| `rating` | INTEGER | NOT NULL, CHECK (1-5) | Rating (1-5 stars) |
| `review_text` | TEXT | NULL | Review comment/feedback |
| `created_at` | TIMESTAMP | NOT NULL | Review creation time |
| `updated_at` | TIMESTAMP | NOT NULL | Review last update time |

**Unique Constraint:** `(customer_id, restaurant_id)` - One review per customer per restaurant

**Indexes:**
- `idx_restaurant_id` on `restaurant_id` (for quick restaurant reviews lookup)
- `idx_customer_id` on `customer_id` (for user's review history)
- `idx_order_id` on `order_id` (for order-review relationship)

---

## Business Rules & Validations

### 1. **Order Requirement**
- User can only review a restaurant if they have placed at least one order
- The order must be in `delivered` status
- Validation: Check if `Order` exists with `customer_id`, `restaurant_id`, and `status = 'delivered'`

### 2. **One Review Per Restaurant**
- Each customer can have only ONE review per restaurant
- If review exists, user can UPDATE it (not create new)
- Unique constraint: `(customer_id, restaurant_id)`

### 3. **Rating Validation**
- Rating must be between 1 and 5 (inclusive)
- Rating is required (cannot be null)

### 4. **Review Text**
- Review text is optional (can be null)
- If provided, should have minimum length (e.g., 10 characters) and maximum (e.g., 1000 characters)

### 5. **Update Rules**
- User can update their existing review
- Update should maintain the same `order_id` (reference to original qualifying order)
- `created_at` remains unchanged, `updated_at` is updated

---

## API Endpoints

### 1. **POST /api/reviews**
**Description:** Create a new review (or update if exists)

**Access:** Private (customer only)

**Request Body:**
```json
{
  "restaurant_id": 1,
  "order_id": 123,
  "rating": 5,
  "review_text": "Great food and fast delivery!"
}
```

**Validations:**
- User must be authenticated (customer role)
- `restaurant_id` must exist
- `order_id` must exist and belong to the user
- Order must be for the specified restaurant
- Order status must be `delivered`
- Rating must be between 1-5
- Review text (if provided) must be 10-1000 characters
- Check if review already exists (update instead of create)

**Response (Success - Created):**
```json
{
  "success": true,
  "message": "Review created successfully",
  "data": {
    "review": {
      "id": 1,
      "customer_id": 5,
      "restaurant_id": 1,
      "order_id": 123,
      "rating": 5,
      "review_text": "Great food and fast delivery!",
      "created_at": "2026-01-08T10:00:00.000Z",
      "updated_at": "2026-01-08T10:00:00.000Z"
    }
  }
}
```

**Response (Success - Updated):**
```json
{
  "success": true,
  "message": "Review updated successfully",
  "data": {
    "review": {
      "id": 1,
      "customer_id": 5,
      "restaurant_id": 1,
      "order_id": 123,
      "rating": 4,
      "review_text": "Updated review text",
      "created_at": "2026-01-08T10:00:00.000Z",
      "updated_at": "2026-01-08T11:00:00.000Z"
    }
  }
}
```

**Error Responses:**
- `400 Bad Request`: Validation errors, order not delivered, order doesn't belong to restaurant
- `403 Forbidden`: Order doesn't belong to user
- `404 Not Found`: Restaurant or order not found
- `409 Conflict`: Review already exists (should update instead)

---

### 2. **GET /api/reviews/restaurant/:restaurantId**
**Description:** Get all reviews for a restaurant

**Access:** Public

**Query Parameters:**
- `limit` (optional, default: 20) - Number of reviews to return
- `offset` (optional, default: 0) - Pagination offset
- `sort` (optional, default: 'newest') - Sort order: 'newest', 'oldest', 'highest', 'lowest'

**Response:**
```json
{
  "success": true,
  "message": "Reviews retrieved successfully",
  "data": {
    "reviews": [
      {
        "id": 1,
        "customer": {
          "id": 5,
          "name": "John Doe",
          "email": "john@example.com"
        },
        "rating": 5,
        "review_text": "Great food!",
        "created_at": "2026-01-08T10:00:00.000Z",
        "updated_at": "2026-01-08T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 50,
      "limit": 20,
      "offset": 0,
      "has_more": true
    },
    "summary": {
      "average_rating": 4.5,
      "total_reviews": 50,
      "rating_distribution": {
        "5": 20,
        "4": 15,
        "3": 10,
        "2": 3,
        "1": 2
      }
    }
  }
}
```

---

### 3. **GET /api/reviews/my-reviews**
**Description:** Get current user's reviews

**Access:** Private (customer only)

**Query Parameters:**
- `limit` (optional, default: 20)
- `offset` (optional, default: 0)

**Response:**
```json
{
  "success": true,
  "message": "Reviews retrieved successfully",
  "data": {
    "reviews": [
      {
        "id": 1,
        "restaurant": {
          "id": 1,
          "name": "Pizza Palace",
          "image_url": "..."
        },
        "rating": 5,
        "review_text": "Great food!",
        "created_at": "2026-01-08T10:00:00.000Z",
        "updated_at": "2026-01-08T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 5,
      "limit": 20,
      "offset": 0
    }
  }
}
```

---

### 4. **GET /api/reviews/restaurant/:restaurantId/my-review**
**Description:** Get current user's review for a specific restaurant (if exists)

**Access:** Private (customer only)

**Response:**
```json
{
  "success": true,
  "message": "Review retrieved successfully",
  "data": {
    "review": {
      "id": 1,
      "restaurant_id": 1,
      "order_id": 123,
      "rating": 5,
      "review_text": "Great food!",
      "created_at": "2026-01-08T10:00:00.000Z",
      "updated_at": "2026-01-08T10:00:00.000Z"
    }
  }
}
```

**Response (No Review):**
```json
{
  "success": true,
  "message": "No review found",
  "data": {
    "review": null,
    "can_review": true,
    "qualifying_orders": [
      {
        "id": 123,
        "order_number": "ORD-2026-001",
        "status": "delivered",
        "created_at": "2026-01-08T10:00:00.000Z"
      }
    ]
  }
}
```

---

### 5. **PUT /api/reviews/:id**
**Description:** Update an existing review

**Access:** Private (customer only, owner of review)

**Request Body:**
```json
{
  "rating": 4,
  "review_text": "Updated review text"
}
```

**Validations:**
- Review must exist
- User must be the owner of the review
- Rating must be between 1-5
- Review text (if provided) must be 10-1000 characters

**Response:**
```json
{
  "success": true,
  "message": "Review updated successfully",
  "data": {
    "review": {
      "id": 1,
      "rating": 4,
      "review_text": "Updated review text",
      "updated_at": "2026-01-08T11:00:00.000Z"
    }
  }
}
```

---

### 6. **DELETE /api/reviews/:id**
**Description:** Delete a review (optional - soft delete or hard delete)

**Access:** Private (customer only, owner of review)

**Response:**
```json
{
  "success": true,
  "message": "Review deleted successfully"
}
```

**Note:** Consider if deletion should be allowed or if reviews should be permanent for data integrity.

---

## Restaurant Rating Calculation

### Update Restaurant Model
When a review is created/updated/deleted, update the restaurant's:
- `average_rating` - Calculated average of all ratings
- `total_reviews` - Count of total reviews

**Calculation Logic:**
```javascript
// After review create/update/delete
const reviews = await Review.findAll({
  where: { restaurant_id: restaurantId },
  attributes: ['rating']
});

const totalReviews = reviews.length;
const sumRatings = reviews.reduce((sum, r) => sum + r.rating, 0);
const averageRating = totalReviews > 0 ? (sumRatings / totalReviews).toFixed(2) : 0;

await Restaurant.update(
  {
    average_rating: averageRating,
    total_reviews: totalReviews
  },
  { where: { id: restaurantId } }
);
```

**Triggers/Hooks:**
- Use Sequelize hooks (`afterCreate`, `afterUpdate`, `afterDestroy`) on Review model
- Or calculate in route handlers after review operations

---

## Frontend Implementation

### 1. **Review Component for Restaurant Detail Page**
- Show existing reviews with pagination
- Display average rating and rating distribution
- Allow user to write/edit their review (if they have ordered)
- Show "Write a Review" button only if user has delivered orders

### 2. **Review Form Modal**
- Rating selector (1-5 stars)
- Text area for review text
- Validation messages
- Submit/Cancel buttons

### 3. **My Reviews Page**
- List all user's reviews
- Allow editing/deleting reviews
- Show restaurant details for each review

### 4. **Review Display**
- Show customer name (or anonymized)
- Show rating with stars
- Show review text
- Show date (e.g., "2 days ago")
- Show "Helpful" button (optional future feature)

---

## Implementation Steps

### Phase 1: Backend
1. ✅ Create Review model
2. ✅ Create review routes
3. ✅ Implement validations
4. ✅ Update Restaurant model to calculate ratings
5. ✅ Add hooks to update restaurant ratings automatically

### Phase 2: Frontend
1. ✅ Create review API service
2. ✅ Create Review component for restaurant detail page
3. ✅ Create Review form modal
4. ✅ Add "My Reviews" page
5. ✅ Integrate reviews into restaurant detail page

---

## Database Migration

```sql
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_id, restaurant_id)
);

CREATE INDEX idx_reviews_restaurant_id ON reviews(restaurant_id);
CREATE INDEX idx_reviews_customer_id ON reviews(customer_id);
CREATE INDEX idx_reviews_order_id ON reviews(order_id);
```

---

## Error Handling

### Common Error Scenarios:
1. **User hasn't ordered from restaurant**
   - Status: `400 Bad Request`
   - Message: "You must place and receive an order from this restaurant before you can review it."

2. **Order not delivered**
   - Status: `400 Bad Request`
   - Message: "You can only review restaurants after your order has been delivered."

3. **Review already exists (on create)**
   - Status: `409 Conflict`
   - Message: "You have already reviewed this restaurant. Please update your existing review."

4. **Invalid rating**
   - Status: `400 Bad Request`
   - Message: "Rating must be between 1 and 5."

5. **Review text too short/long**
   - Status: `400 Bad Request`
   - Message: "Review text must be between 10 and 1000 characters."

---

## Testing Checklist

- [ ] User can create review after placing delivered order
- [ ] User cannot create review without order
- [ ] User cannot create review if order not delivered
- [ ] User can update existing review
- [ ] User cannot create duplicate review (only update)
- [ ] Restaurant average rating updates correctly
- [ ] Restaurant total reviews count updates correctly
- [ ] Reviews are displayed with pagination
- [ ] Reviews can be sorted (newest, oldest, highest, lowest)
- [ ] User can view their own reviews
- [ ] User can delete their review (if implemented)

---

## Future Enhancements (Optional)

1. **Review Reactions**: Like/Helpful buttons
2. **Review Replies**: Restaurant owner can reply to reviews
3. **Review Moderation**: Flag inappropriate reviews
4. **Review Photos**: Allow users to upload photos with reviews
5. **Review Verification**: Show "Verified Purchase" badge
6. **Review Sorting**: Sort by most helpful, recent, etc.

---

## Files to Create/Modify

### Backend:
- `backend/models/Review.model.js` (NEW)
- `backend/routes/review.routes.js` (NEW)
- `backend/models/index.js` (UPDATE - add Review associations)
- `backend/models/Restaurant.model.js` (UPDATE - add review associations)

### Frontend:
- `frontend/src/api/reviews.js` (NEW)
- `frontend/src/pages/RestaurantDetail.jsx` (UPDATE - add reviews section)
- `frontend/src/components/ReviewForm.jsx` (NEW)
- `frontend/src/components/ReviewList.jsx` (NEW)
- `frontend/src/pages/MyReviews.jsx` (NEW)
- `frontend/src/App.jsx` (UPDATE - add MyReviews route)

---

## Notes

- Reviews should be permanent for data integrity (consider soft delete if deletion is needed)
- Rating calculation should be efficient (consider caching if needed)
- Consider pagination for large review lists
- Review text should be sanitized to prevent XSS attacks
- Consider rate limiting for review creation/updates
