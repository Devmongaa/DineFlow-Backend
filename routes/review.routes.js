const express = require("express");
const router = express.Router();
const { Review, Order, Restaurant, User } = require("../models");
const { authenticateToken, requireRole } = require("../middleware/auth.middleware");

/**
 * @route   POST /api/reviews
 * @desc    Create or update a review for a restaurant
 * @access  Private (customer only)
 * 
 * Business Rules:
 * - User must have placed a delivered order from the restaurant
 * - One review per customer per restaurant (can be updated)
 * - Rating must be 1-5
 * - Review text optional (10-1000 chars if provided)
 */
router.post("/", authenticateToken, requireRole(["customer"]), async (req, res) => {
  try {
    const userId = req.user.id;
    const { restaurant_id, order_id, rating, review_text } = req.body;

    // Input validation
    if (!restaurant_id || !order_id || !rating) {
      return res.status(400).json({
        success: false,
        message: "Restaurant ID, Order ID, and Rating are required",
      });
    }

    // Validate rating range
    if (rating < 1 || rating > 5 || !Number.isInteger(parseFloat(rating))) {
      return res.status(400).json({
        success: false,
        message: "Rating must be an integer between 1 and 5",
      });
    }

    // Validate review text length if provided
    if (review_text && (review_text.length < 10 || review_text.length > 1000)) {
      return res.status(400).json({
        success: false,
        message: "Review text must be between 10 and 1000 characters",
      });
    }

    // Verify order exists and belongs to user
    const order = await Order.findByPk(order_id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.customer_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only review restaurants for your own orders",
      });
    }

    // Verify order is for the specified restaurant
    if (order.restaurant_id !== parseInt(restaurant_id)) {
      return res.status(400).json({
        success: false,
        message: "Order does not belong to the specified restaurant",
      });
    }

    // Verify order is delivered
    if (order.status !== "delivered") {
      return res.status(400).json({
        success: false,
        message: "You can only review restaurants after your order has been delivered",
      });
    }

    // Verify restaurant exists
    const restaurant = await Restaurant.findByPk(restaurant_id);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    // Create or update review
    const review = await Review.createOrUpdate({
      customer_id: userId,
      restaurant_id: parseInt(restaurant_id),
      order_id: parseInt(order_id),
      rating: parseInt(rating),
      review_text: review_text || null,
    });

    // Update restaurant rating statistics
    await updateRestaurantRatings(restaurant_id);

    const isUpdate = review.updated_at > review.created_at;
    res.status(isUpdate ? 200 : 201).json({
      success: true,
      message: isUpdate ? "Review updated successfully" : "Review created successfully",
      data: {
        review: {
          id: review.id,
          customer_id: review.customer_id,
          restaurant_id: review.restaurant_id,
          order_id: review.order_id,
          rating: review.rating,
          review_text: review.review_text,
          created_at: review.created_at,
          updated_at: review.updated_at,
        },
      },
    });
  } catch (error) {
    console.error("Create/Update review error:", error);
    
    // Handle unique constraint violation (shouldn't happen with createOrUpdate, but just in case)
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "You have already reviewed this restaurant. Please update your existing review.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   GET /api/reviews/restaurant/:restaurantId
 * @desc    Get all reviews for a restaurant
 * @access  Public
 * 
 * Query Parameters:
 * - limit: Number of reviews (default: 20)
 * - offset: Pagination offset (default: 0)
 * - sort: Sort order - 'newest', 'oldest', 'highest', 'lowest' (default: 'newest')
 */
router.get("/restaurant/:restaurantId", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { limit = 20, offset = 0, sort = "newest" } = req.query;

    // Verify restaurant exists
    const restaurant = await Restaurant.findByPk(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    // Determine sort order
    let order;
    switch (sort) {
      case "oldest":
        order = [["created_at", "ASC"]];
        break;
      case "highest":
        order = [["rating", "DESC"], ["created_at", "DESC"]];
        break;
      case "lowest":
        order = [["rating", "ASC"], ["created_at", "DESC"]];
        break;
      case "newest":
      default:
        order = [["created_at", "DESC"]];
        break;
    }

    // Get reviews with customer details
    const reviews = await Review.findAll({
      where: {
        restaurant_id: restaurantId,
      },
      include: [
        {
          model: User,
          as: "customer",
          attributes: ["id", "name", "email"],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order,
    });

    // Get total count for pagination
    const totalReviews = await Review.count({
      where: {
        restaurant_id: restaurantId,
      },
    });

    // Get rating statistics
    const stats = await Review.calculateRestaurantStats(restaurantId);

    res.status(200).json({
      success: true,
      message: "Reviews retrieved successfully",
      data: {
        reviews: reviews.map((review) => ({
          id: review.id,
          customer: {
            id: review.customer.id,
            name: review.customer.name,
            email: review.customer.email,
          },
          rating: review.rating,
          review_text: review.review_text,
          created_at: review.created_at,
          updated_at: review.updated_at,
        })),
        pagination: {
          total: totalReviews,
          limit: parseInt(limit),
          offset: parseInt(offset),
          has_more: parseInt(offset) + reviews.length < totalReviews,
        },
        summary: stats,
      },
    });
  } catch (error) {
    console.error("Get restaurant reviews error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   GET /api/reviews/my-reviews
 * @desc    Get current user's reviews
 * @access  Private (customer only)
 * 
 * Query Parameters:
 * - limit: Number of reviews (default: 20)
 * - offset: Pagination offset (default: 0)
 */
router.get("/my-reviews", authenticateToken, requireRole(["customer"]), async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    const reviews = await Review.findAll({
      where: {
        customer_id: userId,
      },
      include: [
        {
          model: Restaurant,
          as: "restaurant",
          attributes: ["id", "name", "image_url", "city"],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["created_at", "DESC"]],
    });

    const totalReviews = await Review.count({
      where: {
        customer_id: userId,
      },
    });

    res.status(200).json({
      success: true,
      message: "Reviews retrieved successfully",
      data: {
        reviews: reviews.map((review) => ({
          id: review.id,
          restaurant: {
            id: review.restaurant.id,
            name: review.restaurant.name,
            image_url: review.restaurant.image_url,
            city: review.restaurant.city,
          },
          rating: review.rating,
          review_text: review.review_text,
          created_at: review.created_at,
          updated_at: review.updated_at,
        })),
        pagination: {
          total: totalReviews,
          limit: parseInt(limit),
          offset: parseInt(offset),
          has_more: parseInt(offset) + reviews.length < totalReviews,
        },
      },
    });
  } catch (error) {
    console.error("Get my reviews error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   GET /api/reviews/restaurant/:restaurantId/my-review
 * @desc    Get current user's review for a specific restaurant (if exists)
 * @access  Private (customer only)
 */
router.get("/restaurant/:restaurantId/my-review", authenticateToken, requireRole(["customer"]), async (req, res) => {
  try {
    const userId = req.user.id;
    const { restaurantId } = req.params;

    // Verify restaurant exists
    const restaurant = await Restaurant.findByPk(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    // Get user's review if exists
    const review = await Review.findByCustomerAndRestaurant(userId, restaurantId);

    if (review) {
      return res.status(200).json({
        success: true,
        message: "Review retrieved successfully",
        data: {
          review: {
            id: review.id,
            restaurant_id: review.restaurant_id,
            order_id: review.order_id,
            rating: review.rating,
            review_text: review.review_text,
            created_at: review.created_at,
            updated_at: review.updated_at,
          },
          can_review: false,
        },
      });
    }

    // If no review, check if user has qualifying orders
    const qualifyingOrders = await Order.findAll({
      where: {
        customer_id: userId,
        restaurant_id: restaurantId,
        status: "delivered",
      },
      attributes: ["id", "order_number", "status", "created_at"],
      order: [["created_at", "DESC"]],
      limit: 10,
    });

    res.status(200).json({
      success: true,
      message: "No review found",
      data: {
        review: null,
        can_review: qualifyingOrders.length > 0,
        qualifying_orders: qualifyingOrders.map((order) => ({
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          created_at: order.created_at,
        })),
      },
    });
  } catch (error) {
    console.error("Get my review error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   PUT /api/reviews/:id
 * @desc    Update an existing review
 * @access  Private (customer only, owner of review)
 */
router.put("/:id", authenticateToken, requireRole(["customer"]), async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { rating, review_text } = req.body;

    // Find review
    const review = await Review.findByPk(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Verify ownership
    if (review.customer_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own reviews",
      });
    }

    // Validate rating if provided
    if (rating !== undefined) {
      if (rating < 1 || rating > 5 || !Number.isInteger(parseFloat(rating))) {
        return res.status(400).json({
          success: false,
          message: "Rating must be an integer between 1 and 5",
        });
      }
      review.rating = parseInt(rating);
    }

    // Validate review text if provided
    if (review_text !== undefined) {
      if (review_text && (review_text.length < 10 || review_text.length > 1000)) {
        return res.status(400).json({
          success: false,
          message: "Review text must be between 10 and 1000 characters",
        });
      }
      review.review_text = review_text || null;
    }

    await review.save();

    // Update restaurant rating statistics
    await updateRestaurantRatings(review.restaurant_id);

    res.status(200).json({
      success: true,
      message: "Review updated successfully",
      data: {
        review: {
          id: review.id,
          rating: review.rating,
          review_text: review.review_text,
          updated_at: review.updated_at,
        },
      },
    });
  } catch (error) {
    console.error("Update review error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   DELETE /api/reviews/:id
 * @desc    Delete a review
 * @access  Private (customer only, owner of review)
 */
router.delete("/:id", authenticateToken, requireRole(["customer"]), async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Find review
    const review = await Review.findByPk(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Verify ownership
    if (review.customer_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own reviews",
      });
    }

    const restaurantId = review.restaurant_id;
    await review.destroy();

    // Update restaurant rating statistics
    await updateRestaurantRatings(restaurantId);

    res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * Helper function to update restaurant rating statistics
 * 
 * @param {number} restaurantId - Restaurant ID
 */
async function updateRestaurantRatings(restaurantId) {
  try {
    const stats = await Review.calculateRestaurantStats(restaurantId);
    
    await Restaurant.update(
      {
        average_rating: stats.average_rating,
        total_reviews: stats.total_reviews,
      },
      {
        where: { id: restaurantId },
      }
    );
  } catch (error) {
    console.error("Error updating restaurant ratings:", error);
    // Don't throw error - rating update failure shouldn't break review creation
  }
}

module.exports = router;
