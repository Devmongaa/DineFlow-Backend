const { DataTypes, Op } = require("sequelize");
const { sequelize } = require("../config/database");

/**
 * Order Model
 * 
 * Represents customer orders.
 * Each order belongs to a customer, restaurant, and delivery address.
 * Orders can be assigned to a rider for delivery.
 */
const Order = sequelize.define(
  "Order",
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
    address_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "addresses",
        key: "id",
      },
      validate: {
        notEmpty: {
          msg: "Address ID is required",
        },
      },
    },
    rider_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
      // Rider assigned for delivery
    },
    order_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: {
          msg: "Order number is required",
        },
      },
    },
    status: {
      type: DataTypes.ENUM(
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "out_for_delivery",
        "delivered",
        "cancelled"
      ),
      allowNull: false,
      defaultValue: "pending",
      validate: {
        isIn: {
          args: [
            [
              "pending",
              "confirmed",
              "preparing",
              "ready",
              "out_for_delivery",
              "delivered",
              "cancelled",
            ],
          ],
          msg: "Invalid order status",
        },
      },
    },
    subtotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: {
          args: [0],
          msg: "Subtotal must be greater than or equal to 0",
        },
      },
    },
    delivery_fee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: "Delivery fee must be greater than or equal to 0",
        },
      },
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: {
          args: [0],
          msg: "Total amount must be greater than or equal to 0",
        },
      },
    },
    payment_status: {
      type: DataTypes.ENUM("pending", "paid", "failed", "refunded"),
      allowNull: false,
      defaultValue: "pending",
    },
    estimated_delivery_time: {
      type: DataTypes.INTEGER,
      allowNull: true,
      // Estimated delivery time in minutes
    },
    delivered_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cancellation_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    rider_earning: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
      validate: {
        min: {
          args: [0],
          msg: "Rider earning must be greater than or equal to 0",
        },
      },
      comment: "Rider earning calculated when order is delivered (80% of delivery fee)",
    },
  },
  {
    tableName: "orders",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

/**
 * Static Methods
 */

/**
 * Generate unique order number
 * Format: ORD-YYYYMMDD-XXX (e.g., ORD-20260108-001)
 * 
 * @returns {Promise<string>} Order number
 */
Order.generateOrderNumber = async function () {
  const today = new Date();
  const dateStr = today.toISOString().split("T")[0].replace(/-/g, ""); // YYYYMMDD

  // Find the last order number for today
  const lastOrder = await this.findOne({
    where: {
      order_number: {
        [Op.like]: `ORD-${dateStr}-%`,
      },
    },
    order: [["created_at", "DESC"]],
  });

  let sequence = 1;
  if (lastOrder) {
    const lastSequence = parseInt(lastOrder.order_number.split("-")[2]);
    sequence = lastSequence + 1;
  }

  const sequenceStr = sequence.toString().padStart(3, "0");
  return `ORD-${dateStr}-${sequenceStr}`;
};

/**
 * Find order by ID
 * 
 * @param {number} id - Order ID
 * @returns {Promise<Order|null>} Order instance or null
 */
Order.findById = async function (id) {
  return await this.findByPk(id);
};

/**
 * Find orders by customer
 * 
 * @param {number} customerId - Customer ID
 * @param {Object} options - Query options (status, limit, offset)
 * @returns {Promise<Array>} Array of order instances
 */
Order.findByCustomer = async function (customerId, options = {}) {
  const { status, limit = 50, offset = 0 } = options;

  const where = { customer_id: customerId };

  if (status) {
    where.status = status;
  }

  return await this.findAll({
    where,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [["created_at", "DESC"]],
  });
};

/**
 * Find orders by restaurant
 * 
 * @param {number} restaurantId - Restaurant ID
 * @param {Object} options - Query options (status, limit, offset)
 * @returns {Promise<Array>} Array of order instances
 */
Order.findByRestaurant = async function (restaurantId, options = {}) {
  const { status, limit = 50, offset = 0 } = options;

  const where = { restaurant_id: restaurantId };

  if (status) {
    where.status = status;
  }

  return await this.findAll({
    where,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [["created_at", "DESC"]],
  });
};

/**
 * Find available orders for riders
 * 
 * @param {Object} options - Query options (limit, offset)
 * @returns {Promise<Array>} Array of order instances
 */
Order.findAvailableForRider = async function (options = {}) {
  const { limit = 50, offset = 0 } = options;

  return await this.findAll({
    where: {
      status: "ready",
      rider_id: null, // Not assigned yet
    },
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [["created_at", "ASC"]], // Oldest first
  });
};

/**
 * Find orders by rider
 * 
 * @param {number} riderId - Rider ID
 * @param {Object} options - Query options (status, limit, offset)
 * @returns {Promise<Array>} Array of order instances
 */
Order.findByRider = async function (riderId, options = {}) {
  const { status, limit = 50, offset = 0 } = options;

  const where = { rider_id: riderId };

  if (status) {
    where.status = status;
  }

  return await this.findAll({
    where,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [
      // First, prioritize active orders (ready, out_for_delivery) over delivered
      [sequelize.literal(`CASE 
        WHEN status IN ('ready', 'out_for_delivery') THEN 0 
        WHEN status = 'delivered' THEN 1 
        ELSE 2 
      END`), 'ASC'],
      // Then sort by creation date (newest first)
      ["created_at", "DESC"],
      // Finally, by ID as tiebreaker
      ["id", "DESC"],
    ],
  });
};

/**
 * Create order
 * 
 * @param {Object} orderData - Order data
 * @returns {Promise<Order>} Created order instance
 */
Order.createOrder = async function (orderData) {
  if (
    !orderData.customer_id ||
    !orderData.restaurant_id ||
    !orderData.address_id
  ) {
    throw new Error("Customer ID, Restaurant ID, and Address ID are required");
  }

  // Generate order number
  orderData.order_number = await this.generateOrderNumber();

  // Calculate total if not provided
  if (!orderData.total_amount) {
    orderData.total_amount =
      parseFloat(orderData.subtotal || 0) + parseFloat(orderData.delivery_fee || 0);
  }

  return await this.create(orderData);
};

/**
 * Update order status
 * 
 * @param {number} id - Order ID
 * @param {string} status - New status
 * @param {Object} additionalData - Additional data (rider_id, cancellation_reason, etc.)
 * @returns {Promise<Order>} Updated order instance
 */
Order.updateStatus = async function (id, status, additionalData = {}) {
  const order = await this.findByPk(id);

  if (!order) {
    throw new Error("Order not found");
  }

  const validStatuses = [
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "out_for_delivery",
    "delivered",
    "cancelled",
  ];

  if (!validStatuses.includes(status)) {
    throw new Error("Invalid order status");
  }

  const updateData = {
    status,
    ...additionalData,
  };

  // Set timestamps for specific statuses
  if (status === "delivered") {
    updateData.delivered_at = new Date();
    
    // Calculate rider earning when order is delivered (80% of delivery fee)
    if (order.rider_id && order.delivery_fee) {
      const RIDER_EARNING_PERCENTAGE = 0.80; // 80% of delivery fee
      const deliveryFee = parseFloat(order.delivery_fee) || 0;
      updateData.rider_earning = (deliveryFee * RIDER_EARNING_PERCENTAGE).toFixed(2);
    }
  } else if (status === "cancelled") {
    updateData.cancelled_at = new Date();
    // Clear rider earning if order is cancelled
    updateData.rider_earning = null;
  }

  await order.update(updateData);
  return order;
};

/**
 * Cancel order
 * 
 * @param {number} id - Order ID
 * @param {string} reason - Cancellation reason
 * @returns {Promise<Order>} Updated order instance
 */
Order.cancelOrder = async function (id, reason = null) {
  const order = await this.findByPk(id);

  if (!order) {
    throw new Error("Order not found");
  }

  // Check if order can be cancelled
  const nonCancellableStatuses = ["delivered", "cancelled"];
  if (nonCancellableStatuses.includes(order.status)) {
    throw new Error(`Cannot cancel order with status: ${order.status}`);
  }

  return await this.updateStatus(id, "cancelled", {
    cancellation_reason: reason,
  });
};

/**
 * Assign rider to order
 * 
 * @param {number} id - Order ID
 * @param {number} riderId - Rider ID
 * @returns {Promise<Order>} Updated order instance
 */
Order.assignRider = async function (id, riderId) {
  const order = await this.findByPk(id);

  if (!order) {
    throw new Error("Order not found");
  }

  if (order.status !== "ready") {
    throw new Error("Order must be ready before assigning a rider");
  }

  await order.update({ rider_id: riderId });
  return order;
};

module.exports = Order;
