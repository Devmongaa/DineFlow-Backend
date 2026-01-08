const { DataTypes, Op } = require("sequelize");
const { sequelize } = require("../config/database");

/**
 * Restaurant Model
 * 
 * Represents restaurants in the system.
 * Each restaurant is owned by a user with role 'restaurant_owner'.
 */
const Restaurant = sequelize.define(
  "Restaurant",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    owner_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
      validate: {
        notEmpty: {
          msg: "Owner ID is required",
        },
      },
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Restaurant name is required",
        },
        len: {
          args: [2, 255],
          msg: "Restaurant name must be between 2 and 255 characters",
        },
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cuisine_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
      // Examples: "Italian", "Chinese", "Indian", "Mexican", etc.
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Address is required",
        },
      },
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "City is required",
        },
      },
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    zip_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isEmail: {
          msg: "Please provide a valid email address",
        },
      },
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
    },
    opening_time: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    closing_time: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    average_rating: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0.00,
      validate: {
        min: 0,
        max: 5,
      },
    },
    total_reviews: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    is_accepting_orders: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    image_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  },
  {
    tableName: "restaurants",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

/**
 * Static Methods
 */

/**
 * Find restaurant by ID
 * 
 * @param {number} id - Restaurant ID
 * @returns {Promise<Restaurant|null>} Restaurant instance or null
 */
Restaurant.findById = async function (id) {
  return await this.findByPk(id);
};

/**
 * Find restaurants by owner
 * 
 * @param {number} ownerId - Owner user ID
 * @returns {Promise<Array>} Array of restaurant instances
 */
Restaurant.findByOwner = async function (ownerId) {
  return await this.findAll({
    where: { owner_id: ownerId },
    order: [["created_at", "DESC"]],
  });
};

/**
 * Find active restaurants
 * 
 * @param {Object} options - Query options (limit, offset, filters)
 * @returns {Promise<Array>} Array of restaurant instances
 */
Restaurant.findActive = async function (options = {}) {
  const { limit = 50, offset = 0, city, cuisine_type, ...otherOptions } = options;

  const where = {
    is_active: true,
    is_accepting_orders: true,
    ...otherOptions.where,
  };

  if (city) {
    // Case-insensitive exact city matching (MySQL compatible)
    where.city = sequelize.where(sequelize.fn('LOWER', sequelize.col('city')), sequelize.fn('LOWER', city));
  }

  if (cuisine_type) {
    where.cuisine_type = cuisine_type;
  }

  return await this.findAll({
    where,
    limit,
    offset,
    order: [["average_rating", "DESC"], ["created_at", "DESC"]],
  });
};

/**
 * Get all unique cities where active restaurants exist
 * 
 * @returns {Promise<Array>} Array of unique city names
 */
Restaurant.getAvailableCities = async function () {
  const restaurants = await this.findAll({
    where: {
      is_active: true,
      is_accepting_orders: true,
    },
    attributes: ["city"],
    group: ["city"],
    order: [["city", "ASC"]],
  });

  return restaurants.map((restaurant) => restaurant.city);
};

/**
 * Create restaurant
 * 
 * @param {Object} restaurantData - Restaurant data
 * @param {number} restaurantData.owner_id - Owner user ID
 * @param {string} restaurantData.name - Restaurant name
 * @param {string} restaurantData.address - Restaurant address
 * @param {string} restaurantData.city - City
 * @param {string} [restaurantData.description] - Description
 * @param {string} [restaurantData.cuisine_type] - Cuisine type
 * @returns {Promise<Restaurant>} Created restaurant instance
 */
Restaurant.createRestaurant = async function (restaurantData) {
  // Validate required fields
  if (!restaurantData.owner_id || !restaurantData.name || !restaurantData.address || !restaurantData.city) {
    throw new Error("Owner ID, name, address, and city are required");
  }

  return await this.create(restaurantData);
};

/**
 * Update restaurant
 * 
 * @param {number} id - Restaurant ID
 * @param {Object} updateData - Fields to update
 * @returns {Promise<Restaurant>} Updated restaurant instance
 */
Restaurant.updateRestaurant = async function (id, updateData) {
  const restaurant = await this.findByPk(id);
  
  if (!restaurant) {
    throw new Error("Restaurant not found");
  }

  await restaurant.update(updateData);
  return restaurant;
};

module.exports = Restaurant;
