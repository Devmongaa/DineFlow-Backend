const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

/**
 * Cart Item Model
 * 
 * Represents an item in a shopping cart.
 * Stores a snapshot of the menu item price at the time it was added.
 */
const CartItem = sequelize.define(
  "CartItem",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    cart_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "carts",
        key: "id",
      },
      validate: {
        notEmpty: {
          msg: "Cart ID is required",
        },
      },
    },
    menu_item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "menu_items",
        key: "id",
      },
      validate: {
        notEmpty: {
          msg: "Menu item ID is required",
        },
      },
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: {
          args: [1],
          msg: "Quantity must be at least 1",
        },
        isInt: {
          msg: "Quantity must be an integer",
        },
      },
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
      // Price snapshot at time of adding to cart
    },
  },
  {
    tableName: "cart_items",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

/**
 * Static Methods
 */

/**
 * Find cart item by ID
 * 
 * @param {number} id - Cart item ID
 * @returns {Promise<CartItem|null>} Cart item instance or null
 */
CartItem.findById = async function (id) {
  return await this.findByPk(id);
};

/**
 * Find cart item by cart and menu item
 * 
 * @param {number} cartId - Cart ID
 * @param {number} menuItemId - Menu item ID
 * @returns {Promise<CartItem|null>} Cart item instance or null
 */
CartItem.findByCartAndMenuItem = async function (cartId, menuItemId) {
  return await this.findOne({
    where: {
      cart_id: cartId,
      menu_item_id: menuItemId,
    },
  });
};

/**
 * Find all items in a cart
 * 
 * @param {number} cartId - Cart ID
 * @returns {Promise<Array>} Array of cart item instances
 */
CartItem.findByCart = async function (cartId) {
  return await this.findAll({
    where: { cart_id: cartId },
    order: [["created_at", "ASC"]],
  });
};

/**
 * Add item to cart or update quantity if exists
 * 
 * @param {number} cartId - Cart ID
 * @param {number} menuItemId - Menu item ID
 * @param {number} quantity - Quantity to add
 * @param {number} price - Menu item price
 * @returns {Promise<CartItem>} Cart item instance
 */
CartItem.addOrUpdateItem = async function (cartId, menuItemId, quantity, price) {
  // Check if item already exists in cart
  const existingItem = await this.findByCartAndMenuItem(cartId, menuItemId);

  if (existingItem) {
    // Update quantity
    existingItem.quantity += quantity;
    await existingItem.save();
    return existingItem;
  }

  // Create new cart item
  return await this.create({
    cart_id: cartId,
    menu_item_id: menuItemId,
    quantity,
    price,
  });
};

/**
 * Update cart item quantity
 * 
 * @param {number} id - Cart item ID
 * @param {number} quantity - New quantity
 * @returns {Promise<CartItem>} Updated cart item instance
 */
CartItem.updateQuantity = async function (id, quantity) {
  const cartItem = await this.findByPk(id);

  if (!cartItem) {
    throw new Error("Cart item not found");
  }

  if (quantity <= 0) {
    throw new Error("Quantity must be greater than 0");
  }

  cartItem.quantity = quantity;
  await cartItem.save();

  return cartItem;
};

/**
 * Remove item from cart
 * 
 * @param {number} id - Cart item ID
 * @returns {Promise<void>}
 */
CartItem.removeItem = async function (id) {
  const cartItem = await this.findByPk(id);

  if (!cartItem) {
    throw new Error("Cart item not found");
  }

  await cartItem.destroy();
};

/**
 * Calculate cart subtotal
 * 
 * @param {number} cartId - Cart ID
 * @returns {Promise<number>} Subtotal amount
 */
CartItem.calculateSubtotal = async function (cartId) {
  const result = await this.findAll({
    where: { cart_id: cartId },
    attributes: [
      [sequelize.fn("SUM", sequelize.literal("quantity * price")), "subtotal"],
    ],
    raw: true,
  });

  const subtotal = result[0]?.subtotal || 0;
  return parseFloat(subtotal) || 0;
};

module.exports = CartItem;
