const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

/**
 * Order Item Model
 * 
 * Represents items in an order.
 * Stores a snapshot of the menu item price at the time of order.
 */
const OrderItem = sequelize.define(
  "OrderItem",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
      // Price snapshot at time of order
    },
    item_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      // Snapshot of menu item name
    },
  },
  {
    tableName: "order_items",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

/**
 * Static Methods
 */

/**
 * Find order items by order ID
 * 
 * @param {number} orderId - Order ID
 * @returns {Promise<Array>} Array of order item instances
 */
OrderItem.findByOrder = async function (orderId) {
  return await this.findAll({
    where: { order_id: orderId },
    order: [["created_at", "ASC"]],
  });
};

/**
 * Create order items from cart items
 * 
 * @param {number} orderId - Order ID
 * @param {Array} cartItems - Array of cart item instances
 * @param {Object} options - Sequelize options (transaction, etc.)
 * @returns {Promise<Array>} Array of created order item instances
 */
OrderItem.createFromCart = async function (orderId, cartItems, options = {}) {
  const MenuItem = require("./MenuItem.model");
  const orderItems = [];

  for (const cartItem of cartItems) {
    // Get menu item details for snapshot
    const menuItem = await MenuItem.findByPk(cartItem.menu_item_id);

    if (!menuItem) {
      throw new Error(`Menu item ${cartItem.menu_item_id} not found`);
    }

    const orderItem = await this.create(
      {
        order_id: orderId,
        menu_item_id: cartItem.menu_item_id,
        quantity: cartItem.quantity,
        price: cartItem.price, // Use price from cart (snapshot)
        item_name: menuItem.name, // Snapshot of name
      },
      options
    );

    orderItems.push(orderItem);
  }

  return orderItems;
};

/**
 * Calculate order subtotal
 * 
 * @param {number} orderId - Order ID
 * @returns {Promise<number>} Subtotal amount
 */
OrderItem.calculateSubtotal = async function (orderId) {
  const result = await this.findAll({
    where: { order_id: orderId },
    attributes: [
      [sequelize.fn("SUM", sequelize.literal("quantity * price")), "subtotal"],
    ],
    raw: true,
  });

  const subtotal = result[0]?.subtotal || 0;
  return parseFloat(subtotal) || 0;
};

module.exports = OrderItem;
