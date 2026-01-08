const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

/**
 * Review Model
 * 
 * Represents customer reviews and ratings for restaurants.
 * Each customer can have only one review per restaurant (can be updated).
 * Reviews can only be created after a delivered order.
 */
const Review = sequelize.define(
  "Review",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
      validate: {
        notEmpty: {
          msg: "Customer ID is required",
        },
      },
    },
    restaurant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "restaurants",
        key: "id",
      },
      validate: {
        notEmpty: {
          msg: "Restaurant ID is required",
        },
      },
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "orders",
        key: "id",
      },
      validate: {
        notEmpty: {
          msg: "Order ID is required",
        },
      },
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Rating is required",
        },
        min: {
          args: [1],
          msg: "Rating must be at least 1",
        },
        max: {
          args: [5],
          msg: "Rating must be at most 5",
        },
      },
    },
    review_text: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 1000],
          msg: "Review text must be at most 1000 characters",
        },
      },
    },
  },
  {
    tableName: "reviews",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["customer_id", "restaurant_id"],
        name: "unique_customer_restaurant_review",
      },
      {
        fields: ["restaurant_id"],
        name: "idx_reviews_restaurant_id",
      },
      {
        fields: ["customer_id"],
        name: "idx_reviews_customer_id",
      },
      {
        fields: ["order_id"],
        name: "idx_reviews_order_id",
      },
    ],
  }
);

/**
 * Static Methods
 */

/**
 * Find review by customer and restaurant
 * 
 * @param {number} customerId - Customer ID
 * @param {number} restaurantId - Restaurant ID
 * @returns {Promise<Review|null>} Review instance or null
 */
Review.findByCustomerAndRestaurant = async function (customerId, restaurantId) {
  return await this.findOne({
    where: {
      customer_id: customerId,
      restaurant_id: restaurantId,
    },
  });
};

/**
 * Find all reviews for a restaurant
 * 
 * @param {number} restaurantId - Restaurant ID
 * @param {Object} options - Query options (limit, offset, order)
 * @returns {Promise<Array>} Array of review instances
 */
Review.findByRestaurant = async function (restaurantId, options = {}) {
  const { limit = 20, offset = 0, order = [["created_at", "DESC"]] } = options;

  return await this.findAll({
    where: {
      restaurant_id: restaurantId,
    },
    limit: parseInt(limit),
    offset: parseInt(offset),
    order,
  });
};

/**
 * Find all reviews by a customer
 * 
 * @param {number} customerId - Customer ID
 * @param {Object} options - Query options (limit, offset)
 * @returns {Promise<Array>} Array of review instances
 */
Review.findByCustomer = async function (customerId, options = {}) {
  const { limit = 20, offset = 0 } = options;

  return await this.findAll({
    where: {
      customer_id: customerId,
    },
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [["created_at", "DESC"]],
  });
};

/**
 * Calculate restaurant rating statistics
 * 
 * @param {number} restaurantId - Restaurant ID
 * @returns {Promise<Object>} Rating statistics
 */
Review.calculateRestaurantStats = async function (restaurantId) {
  const reviews = await this.findAll({
    where: {
      restaurant_id: restaurantId,
    },
    attributes: ["rating"],
  });

  const totalReviews = reviews.length;
  
  if (totalReviews === 0) {
    return {
      average_rating: 0,
      total_reviews: 0,
      rating_distribution: {
        5: 0,
        4: 0,
        3: 0,
        2: 0,
        1: 0,
      },
    };
  }

  const sumRatings = reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = parseFloat((sumRatings / totalReviews).toFixed(2));

  const ratingDistribution = {
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  };

  reviews.forEach((review) => {
    ratingDistribution[review.rating]++;
  });

  return {
    average_rating: averageRating,
    total_reviews: totalReviews,
    rating_distribution: ratingDistribution,
  };
};

/**
 * Create or update review
 * 
 * @param {Object} reviewData - Review data
 * @param {number} reviewData.customer_id - Customer ID
 * @param {number} reviewData.restaurant_id - Restaurant ID
 * @param {number} reviewData.order_id - Order ID
 * @param {number} reviewData.rating - Rating (1-5)
 * @param {string} [reviewData.review_text] - Review text
 * @returns {Promise<Review>} Created or updated review instance
 */
Review.createOrUpdate = async function (reviewData) {
  const { customer_id, restaurant_id, order_id, rating, review_text } = reviewData;

  // Check if review already exists
  const existingReview = await this.findByCustomerAndRestaurant(customer_id, restaurant_id);

  if (existingReview) {
    // Update existing review
    existingReview.rating = rating;
    existingReview.review_text = review_text || null;
    existingReview.order_id = order_id; // Keep reference to original order
    await existingReview.save();
    return existingReview;
  } else {
    // Create new review
    return await this.create({
      customer_id,
      restaurant_id,
      order_id,
      rating,
      review_text: review_text || null,
    });
  }
};

module.exports = Review;
