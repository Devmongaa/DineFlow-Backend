const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

/**
 * Menu Item Model
 * 
 * Represents food items in restaurant menus.
 * Each menu item belongs to a restaurant.
 */
const MenuItem = sequelize.define(
  "MenuItem",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Menu item name is required",
        },
        len: {
          args: [2, 255],
          msg: "Menu item name must be between 2 and 255 characters",
        },
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Price is required",
        },
        min: {
          args: [0],
          msg: "Price must be greater than or equal to 0",
        },
      },
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Category is required",
        },
      },
      // Examples: "Pizza", "Pasta", "Desserts", "Beverages", "Appetizers", etc.
    },
    image_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    is_available: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    preparation_time: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: {
          args: [0],
          msg: "Preparation time must be greater than or equal to 0",
        },
      },
      // Preparation time in minutes
    },
  },
  {
    tableName: "menu_items",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

/**
 * Static Methods
 */

/**
 * Find menu item by ID
 * 
 * @param {number} id - Menu item ID
 * @returns {Promise<MenuItem|null>} Menu item instance or null
 */
MenuItem.findById = async function (id) {
  return await this.findByPk(id);
};

/**
 * Find menu items by restaurant
 * 
 * @param {number} restaurantId - Restaurant ID
 * @param {Object} options - Query options (category, is_available)
 * @returns {Promise<Array>} Array of menu item instances
 */
MenuItem.findByRestaurant = async function (restaurantId, options = {}) {
  const { category, is_available, ...otherOptions } = options;

  const where = {
    restaurant_id: restaurantId,
    ...otherOptions.where,
  };

  if (category) {
    where.category = category;
  }

  if (is_available !== undefined) {
    where.is_available = is_available;
  }

  return await this.findAll({
    where,
    order: [["category", "ASC"], ["name", "ASC"]],
  });
};

/**
 * Find menu items by category
 * 
 * @param {number} restaurantId - Restaurant ID
 * @param {string} category - Category name
 * @returns {Promise<Array>} Array of menu item instances
 */
MenuItem.findByCategory = async function (restaurantId, category) {
  return await this.findAll({
    where: {
      restaurant_id: restaurantId,
      category,
      is_available: true,
    },
    order: [["name", "ASC"]],
  });
};

/**
 * Get all categories for a restaurant
 * 
 * @param {number} restaurantId - Restaurant ID
 * @returns {Promise<Array>} Array of unique category names
 */
MenuItem.getCategories = async function (restaurantId) {
  const menuItems = await this.findAll({
    where: {
      restaurant_id: restaurantId,
      is_available: true,
    },
    attributes: ["category"],
    group: ["category"],
    order: [["category", "ASC"]],
  });

  return menuItems.map((item) => item.category);
};

/**
 * Create menu item
 * 
 * @param {Object} menuItemData - Menu item data
 * @param {number} menuItemData.restaurant_id - Restaurant ID
 * @param {string} menuItemData.name - Item name
 * @param {number} menuItemData.price - Item price
 * @param {string} menuItemData.category - Item category
 * @returns {Promise<MenuItem>} Created menu item instance
 */
MenuItem.createMenuItem = async function (menuItemData) {
  // Validate required fields
  if (!menuItemData.restaurant_id || !menuItemData.name || !menuItemData.price || !menuItemData.category) {
    throw new Error("Restaurant ID, name, price, and category are required");
  }

  return await this.create(menuItemData);
};

/**
 * Update menu item
 * 
 * @param {number} id - Menu item ID
 * @param {Object} updateData - Fields to update
 * @returns {Promise<MenuItem>} Updated menu item instance
 */
MenuItem.updateMenuItem = async function (id, updateData) {
  const menuItem = await this.findByPk(id);

  if (!menuItem) {
    throw new Error("Menu item not found");
  }

  await menuItem.update(updateData);
  return menuItem;
};

/**
 * Toggle menu item availability
 * 
 * @param {number} id - Menu item ID
 * @returns {Promise<MenuItem>} Updated menu item instance
 */
MenuItem.toggleAvailability = async function (id) {
  const menuItem = await this.findByPk(id);

  if (!menuItem) {
    throw new Error("Menu item not found");
  }

  menuItem.is_available = !menuItem.is_available;
  await menuItem.save();

  return menuItem;
};

module.exports = MenuItem;
