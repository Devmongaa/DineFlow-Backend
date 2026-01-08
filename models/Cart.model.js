const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

/**
 * Cart Model
 * 
 * Represents a shopping cart for a customer.
 * Each user has one active cart at a time.
 * All items in a cart must be from the same restaurant.
 */
const Cart = sequelize.define(
  "Cart",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
      validate: {
        notEmpty: {
          msg: "User ID is required",
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
  },
  {
    tableName: "carts",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

/**
 * Static Methods
 */

/**
 * Find cart by user ID
 * 
 * @param {number} userId - User ID
 * @returns {Promise<Cart|null>} Cart instance or null
 */
Cart.findByUser = async function (userId) {
  return await this.findOne({
    where: { user_id: userId },
    order: [["created_at", "DESC"]],
  });
};

/**
 * Find or create cart for user
 * 
 * @param {number} userId - User ID
 * @param {number} restaurantId - Restaurant ID
 * @returns {Promise<Cart>} Cart instance
 */
Cart.findOrCreateForUser = async function (userId, restaurantId) {
  // Check if user has an existing cart
  const existingCart = await this.findByUser(userId);

  if (existingCart) {
    // If cart exists for different restaurant, return error
    if (existingCart.restaurant_id !== restaurantId) {
      throw new Error(
        "You already have items from another restaurant in your cart. Please clear your cart first."
      );
    }
    return existingCart;
  }

  // Create new cart
  return await this.create({
    user_id: userId,
    restaurant_id: restaurantId,
  });
};

/**
 * Create cart
 * 
 * @param {Object} cartData - Cart data
 * @param {number} cartData.user_id - User ID
 * @param {number} cartData.restaurant_id - Restaurant ID
 * @returns {Promise<Cart>} Created cart instance
 */
Cart.createCart = async function (cartData) {
  if (!cartData.user_id || !cartData.restaurant_id) {
    throw new Error("User ID and Restaurant ID are required");
  }

  return await this.create(cartData);
};

/**
 * Clear cart (delete all cart items)
 * 
 * @param {number} cartId - Cart ID
 * @returns {Promise<void>}
 */
Cart.clearCart = async function (cartId) {
  const CartItem = require("./CartItem.model");
  await CartItem.destroy({
    where: { cart_id: cartId },
  });
};

/**
 * Delete cart
 * 
 * @param {number} cartId - Cart ID
 * @returns {Promise<void>}
 */
Cart.deleteCart = async function (cartId) {
  // First clear all cart items
  await this.clearCart(cartId);
  // Then delete the cart
  await this.destroy({ where: { id: cartId } });
};

module.exports = Cart;
