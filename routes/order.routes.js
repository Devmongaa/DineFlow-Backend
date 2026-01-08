const express = require("express");
const router = express.Router();
const { Order, OrderItem, Cart, CartItem, Address, Restaurant, MenuItem, User } = require("../models");
const { authenticateToken, requireRole } = require("../middleware/auth.middleware");
const notificationService = require("../services/notification.service");
const riderService = require("../services/rider.service");
const { getIO, emitNewOrder, emitOrderUpdate, emitOrderAssigned, emitOrderStatusUpdate } = require("../config/socket");

/**
 * @route   POST /api/orders
 * @desc    Create order from cart
 * @access  Private (customer only)
 */
router.post("/", authenticateToken, requireRole(["customer"]), async (req, res) => {
  const transaction = await require("../config/database").sequelize.transaction();

  try {
    const userId = req.user.id;
    const { address_id } = req.body;

    // Input validation
    if (!address_id) {
      return res.status(400).json({
        success: false,
        message: "Address ID is required",
      });
    }

    // Find user's cart
    const cart = await Cart.findByUser(userId);

    if (!cart) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty. Add items to cart before placing order.",
      });
    }

    // Get cart items
    const cartItems = await CartItem.findByCart(cart.id);

    if (cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty. Add items to cart before placing order.",
      });
    }

    // Verify address belongs to user
    const address = await Address.findById(address_id);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    if (address.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only use your own addresses",
      });
    }

    // Verify restaurant is active and accepting orders
    const restaurant = await Restaurant.findById(cart.restaurant_id);

    if (!restaurant || !restaurant.is_active || !restaurant.is_accepting_orders) {
      return res.status(400).json({
        success: false,
        message: "This restaurant is currently not accepting orders",
      });
    }

    // Calculate totals
    const subtotal = await CartItem.calculateSubtotal(cart.id);
    const deliveryFee = 50.0; // Base delivery fee (rider earns 80% = ₹40 per delivery)
    const totalAmount = subtotal + deliveryFee;

    // Create order
    const orderData = {
      customer_id: userId,
      restaurant_id: cart.restaurant_id,
      address_id: address_id,
      subtotal: subtotal,
      delivery_fee: deliveryFee,
      total_amount: totalAmount,
      payment_status: "pending", // Since we're not implementing payment
    };

    // Generate order number
    orderData.order_number = await Order.generateOrderNumber();

    // Calculate total if not provided
    if (!orderData.total_amount) {
      orderData.total_amount =
        parseFloat(orderData.subtotal || 0) + parseFloat(orderData.delivery_fee || 0);
    }

    const order = await Order.create(orderData, { transaction });

    // Create order items from cart items
    const orderItems = await OrderItem.createFromCart(order.id, cartItems, { transaction });

    // Clear cart after order creation
    await CartItem.destroy({ where: { cart_id: cart.id }, transaction });
    await Cart.destroy({ where: { id: cart.id }, transaction });

    // Commit transaction
    await transaction.commit();

    // Get customer and restaurant details for notifications
    const customer = await User.findByPk(userId);
    const restaurantWithOwner = await Restaurant.findByPk(cart.restaurant_id);

    // Create notifications (non-blocking - don't fail order if notification fails)
    try {
      // Convert total_amount to number (Sequelize returns Decimal as string)
      const totalAmount = parseFloat(order.total_amount) || 0;

      // Notify customer: Order placed
      await notificationService.createNotification(
        userId,
        'customer',
        'order_placed',
        'Order Placed Successfully',
        `Your order #${order.order_number} has been placed successfully. Total: ₹${totalAmount.toFixed(2)}`,
        {
          order_id: order.id,
          order_number: order.order_number,
          restaurant_id: restaurantWithOwner.id,
          restaurant_name: restaurantWithOwner.name,
          total_amount: totalAmount,
        }
      );

      // Notify restaurant owner: New order
      if (restaurantWithOwner && restaurantWithOwner.owner_id) {
        const notificationData = {
          order_id: order.id,
          order_number: order.order_number,
          restaurant_id: restaurantWithOwner.id,
          customer_name: customer?.name,
          customer_id: userId,
          total_amount: totalAmount,
        };

        // Create notification in database
        await notificationService.createNotification(
          restaurantWithOwner.owner_id,
          'restaurant_owner',
          'new_order',
          'New Order Received',
          `You have received a new order #${order.order_number} from ${customer?.name || 'Customer'}. Total: ₹${totalAmount.toFixed(2)}`,
          notificationData
        );

        // Emit real-time notification via Socket.io
        try {
          emitNewOrder(restaurantWithOwner.owner_id, {
            ...notificationData,
            message: `You have received a new order #${order.order_number} from ${customer?.name || 'Customer'}. Total: ₹${totalAmount.toFixed(2)}`,
          });
        } catch (socketError) {
          console.error('Error emitting new order via Socket.io:', socketError);
          // Don't fail the order creation if Socket.io fails
        }
      }
    } catch (notificationError) {
      // Log error but don't fail the order creation
      console.error('Error creating notifications:', notificationError);
    }

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: {
        order: {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          subtotal: order.subtotal,
          delivery_fee: order.delivery_fee,
          total_amount: order.total_amount,
          created_at: order.created_at,
        },
        items: orderItems.map((item) => ({
          id: item.id,
          menu_item_id: item.menu_item_id,
          item_name: item.item_name,
          quantity: item.quantity,
          price: item.price,
        })),
      },
    });
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();

    console.error("Create order error:", error);

    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors.map((err) => err.message),
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
 * @route   GET /api/orders/restaurant/my-orders
 * @desc    Get all orders for restaurants owned by current user
 * @access  Private (restaurant_owner only)
 */
router.get("/restaurant/my-orders", authenticateToken, requireRole(["restaurant_owner"]), async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, restaurant_id, limit = 50, offset = 0 } = req.query;

    // Get all restaurants owned by user
    const restaurants = await Restaurant.findByOwner(userId);

    if (restaurants.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No restaurants found",
        data: {
          orders: [],
          count: 0,
        },
      });
    }

    const restaurantIds = restaurants.map((r) => r.id);

    // If specific restaurant_id is provided, verify ownership
    let targetRestaurantIds = restaurantIds;
    if (restaurant_id) {
      const restaurantId = parseInt(restaurant_id);
      if (!restaurantIds.includes(restaurantId)) {
        return res.status(403).json({
          success: false,
          message: "You can only view orders for your own restaurants",
        });
      }
      targetRestaurantIds = [restaurantId];
    }

    // Build where clause
    const { Op } = require("sequelize");
    const where = {
      restaurant_id: {
        [Op.in]: targetRestaurantIds,
      },
    };

    if (status) {
      where.status = status;
    }

    // Get orders
    const orders = await Order.findAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["created_at", "DESC"]],
    });

    // Get order items and related data for each order
    const ordersWithDetails = await Promise.all(
      orders.map(async (order) => {
        const orderItems = await OrderItem.findByOrder(order.id);
        const restaurant = await Restaurant.findByPk(order.restaurant_id);
        const customer = await require("../models").User.findByPk(order.customer_id);
        const address = await Address.findByPk(order.address_id);

        return {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          customer: {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
          },
          restaurant: {
            id: restaurant.id,
            name: restaurant.name,
          },
          delivery_address: {
            id: address.id,
            address_line: address.address_line,
            city: address.city,
            state: address.state,
            zip_code: address.zip_code,
            phone: address.phone,
          },
          subtotal: order.subtotal,
          delivery_fee: order.delivery_fee,
          total_amount: order.total_amount,
          payment_status: order.payment_status,
          item_count: orderItems.length,
          rider_id: order.rider_id,
          created_at: order.created_at,
          updated_at: order.updated_at,
        };
      })
    );

    res.status(200).json({
      success: true,
      message: "Restaurant orders retrieved successfully",
      data: {
        orders: ordersWithDetails,
        count: ordersWithDetails.length,
        filters: {
          status: status || null,
          restaurant_id: restaurant_id || null,
        },
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      },
    });
  } catch (error) {
    console.error("Get restaurant orders error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   GET /api/orders
 * @desc    Get user's orders
 * @access  Private (customer only)
 */
router.get("/", authenticateToken, requireRole(["customer"]), async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, limit = 50, offset = 0 } = req.query;

    const orders = await Order.findByCustomer(userId, {
      status,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Get order items for each order
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const orderItems = await OrderItem.findByOrder(order.id);
        const restaurant = await Restaurant.findByPk(order.restaurant_id);
        const address = await Address.findByPk(order.address_id);

        return {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          restaurant: {
            id: restaurant.id,
            name: restaurant.name,
          },
          delivery_address: {
            id: address.id,
            address_line: address.address_line,
            city: address.city,
          },
          subtotal: order.subtotal,
          delivery_fee: order.delivery_fee,
          total_amount: order.total_amount,
          payment_status: order.payment_status,
          item_count: orderItems.length,
          created_at: order.created_at,
          updated_at: order.updated_at,
        };
      })
    );

    res.status(200).json({
      success: true,
      message: "Orders retrieved successfully",
      data: {
        orders: ordersWithItems,
        count: ordersWithItems.length,
        filters: {
          status: status || null,
        },
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      },
    });
  } catch (error) {
    console.error("Get orders error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   GET /api/orders/:id
 * @desc    Get order details
 * @access  Private (customer, restaurant_owner, rider)
 */
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { id } = req.params;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check access permissions
    if (userRole === "customer" && order.customer_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only view your own orders",
      });
    }

    if (userRole === "restaurant_owner") {
      const restaurant = await Restaurant.findByPk(order.restaurant_id);
      if (restaurant.owner_id !== userId) {
        return res.status(403).json({
          success: false,
          message: "You can only view orders for your restaurants",
        });
      }
    }

    if (userRole === "rider" && order.rider_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only view orders assigned to you",
      });
    }

    // Get order items
    const orderItems = await OrderItem.findByOrder(order.id);

    // Get related data
    const restaurant = await Restaurant.findByPk(order.restaurant_id);
    const address = await Address.findByPk(order.address_id);
    const customer = await require("../models").User.findByPk(order.customer_id);

    // Get menu item details for each order item
    const itemsWithDetails = await Promise.all(
      orderItems.map(async (item) => {
        const menuItem = await MenuItem.findByPk(item.menu_item_id);
        return {
          id: item.id,
          menu_item: {
            id: menuItem ? menuItem.id : null,
            name: item.item_name,
            current_price: menuItem ? menuItem.price : null,
          },
          quantity: item.quantity,
          price: item.price,
          subtotal: (parseFloat(item.price) * item.quantity).toFixed(2),
        };
      })
    );

    res.status(200).json({
      success: true,
      message: "Order retrieved successfully",
      data: {
        order: {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          restaurant_id: order.restaurant_id, // Include restaurant_id for easy access
          customer_id: order.customer_id,
          customer: {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
          },
          restaurant: {
            id: restaurant.id,
            name: restaurant.name,
            phone: restaurant.phone,
          },
          delivery_address: {
            id: address.id,
            address_line: address.address_line,
            city: address.city,
            state: address.state,
            zip_code: address.zip_code,
            phone: address.phone,
          },
          items: itemsWithDetails,
          subtotal: order.subtotal,
          delivery_fee: order.delivery_fee,
          total_amount: order.total_amount,
          payment_status: order.payment_status,
          estimated_delivery_time: order.estimated_delivery_time,
          rider_id: order.rider_id,
          created_at: order.created_at,
          updated_at: order.updated_at,
          delivered_at: order.delivered_at,
          cancelled_at: order.cancelled_at,
          cancellation_reason: order.cancellation_reason,
        },
      },
    });
  } catch (error) {
    console.error("Get order error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   PUT /api/orders/:id/cancel
 * @desc    Cancel order
 * @access  Private (customer only)
 */
router.put("/:id/cancel", authenticateToken, requireRole(["customer"]), async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Verify order belongs to user
    if (order.customer_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only cancel your own orders",
      });
    }

    // Cancel order
    const cancelledOrder = await Order.cancelOrder(id, reason);

    // Get related data for notifications
    const restaurant = await Restaurant.findByPk(order.restaurant_id);
    const customer = await User.findByPk(order.customer_id);

    // Create notifications for order cancellation (non-blocking)
    try {
      await notificationService.notifyOrderStatusChange(
        {
          id: cancelledOrder.id,
          order_number: cancelledOrder.order_number,
          customer_id: order.customer_id,
          restaurant_id: order.restaurant_id,
          rider_id: order.rider_id,
          customer: customer ? { name: customer.name } : null,
          restaurant: restaurant ? { name: restaurant.name, owner_id: restaurant.owner_id } : null,
        },
        'cancelled',
        order.status
      );
    } catch (notificationError) {
      // Log error but don't fail the cancellation
      console.error('Error creating cancellation notifications:', notificationError);
    }

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: {
        order: {
          id: cancelledOrder.id,
          order_number: cancelledOrder.order_number,
          status: cancelledOrder.status,
          cancelled_at: cancelledOrder.cancelled_at,
          cancellation_reason: cancelledOrder.cancellation_reason,
        },
      },
    });
  } catch (error) {
    console.error("Cancel order error:", error);

    if (error.message.includes("Cannot cancel")) {
      return res.status(400).json({
        success: false,
        message: error.message,
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
 * @route   PUT /api/orders/:id/status
 * @desc    Update order status (restaurant owner or rider)
 * @access  Private (restaurant_owner, rider)
 */
router.put("/:id/status", authenticateToken, requireRole(["restaurant_owner", "rider"]), async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { id } = req.params;
    const { status, estimated_delivery_time } = req.body;

    // Input validation
    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
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
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    // Find order
    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Validate access and status transitions based on role
    if (userRole === "restaurant_owner") {
      // Restaurant owner can update: pending → confirmed → preparing → ready
      const restaurant = await Restaurant.findByPk(order.restaurant_id);

      if (!restaurant || restaurant.owner_id !== userId) {
        return res.status(403).json({
          success: false,
          message: "You can only update orders for your own restaurants",
        });
      }

      // Restaurant owner allowed statuses
      const allowedStatuses = ["confirmed", "preparing", "ready"];
      if (!allowedStatuses.includes(status)) {
        return res.status(403).json({
          success: false,
          message: `Restaurant owners can only update status to: ${allowedStatuses.join(", ")}`,
        });
      }

      // Validate status transition
      const validTransitions = {
        pending: ["confirmed"],
        confirmed: ["preparing"],
        preparing: ["ready"],
      };

      if (validTransitions[order.status] && !validTransitions[order.status].includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot change status from ${order.status} to ${status}. Valid transitions: ${validTransitions[order.status].join(", ")}`,
        });
      }
    }

    if (userRole === "rider") {
      // Rider can update: ready → out_for_delivery → delivered
      if (order.rider_id !== userId) {
        return res.status(403).json({
          success: false,
          message: "You can only update orders assigned to you",
        });
      }

      // Rider allowed statuses
      const allowedStatuses = ["out_for_delivery", "delivered"];
      if (!allowedStatuses.includes(status)) {
        return res.status(403).json({
          success: false,
          message: `Riders can only update status to: ${allowedStatuses.join(", ")}`,
        });
      }

      // Validate status transition
      const validTransitions = {
        ready: ["out_for_delivery"],
        out_for_delivery: ["delivered"],
      };

      if (validTransitions[order.status] && !validTransitions[order.status].includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot change status from ${order.status} to ${status}. Valid transitions: ${validTransitions[order.status].join(", ")}`,
        });
      }
    }

    // Prepare update data
    const updateData = { status };
    if (estimated_delivery_time) {
      updateData.estimated_delivery_time = parseInt(estimated_delivery_time);
    }

    // Update order status
    const oldStatus = order.status;
    const updatedOrder = await Order.updateStatus(id, status, updateData);

    // Auto-assign rider when order status becomes "ready" (if not already assigned)
    let assignedRider = null;
    if (status === 'ready' && !updatedOrder.rider_id) {
      try {
        const assignmentResult = await riderService.autoAssignRider(id);
        if (assignmentResult.success && assignmentResult.rider) {
          assignedRider = assignmentResult.rider;
          // Refresh order to get updated rider_id
          await updatedOrder.reload();
          console.log(`✅ Auto-assigned rider ${assignedRider.name} (ID: ${assignedRider.id}) to order #${updatedOrder.order_number}`);
        } else {
          console.warn(`⚠️ Could not auto-assign rider to order #${updatedOrder.order_number}: ${assignmentResult.message}`);
        }
      } catch (riderAssignmentError) {
        // Log error but don't fail the status update
        console.error('Error auto-assigning rider:', riderAssignmentError);
      }
    }

    // Emit real-time order update via Socket.io (use updatedOrder for correct restaurant_id)
    try {
      const restaurantForSocket = await Restaurant.findByPk(updatedOrder.restaurant_id);
      if (restaurantForSocket && restaurantForSocket.owner_id) {
        emitOrderUpdate(restaurantForSocket.owner_id, {
          order_id: updatedOrder.id,
          order_number: updatedOrder.order_number,
          status: updatedOrder.status,
          old_status: oldStatus,
          restaurant_id: restaurantForSocket.id,
          rider_id: updatedOrder.rider_id,
        });
      }
    } catch (socketError) {
      console.error('Error emitting order update via Socket.io:', socketError);
      // Don't fail the status update if Socket.io fails
    }

    // Refresh order to get latest data (including rider_id if it was assigned)
    const finalOrder = await Order.findByPk(id);

    // Get related data for notifications using finalOrder to ensure correct restaurant_id
    const restaurant = await Restaurant.findByPk(finalOrder.restaurant_id);
    const customer = await User.findByPk(finalOrder.customer_id);

    // Create notifications for order status change (non-blocking)
    try {
      const notificationResults = await notificationService.notifyOrderStatusChange(
        {
          id: finalOrder.id,
          order_number: finalOrder.order_number,
          customer_id: finalOrder.customer_id,
          restaurant_id: finalOrder.restaurant_id,
          rider_id: finalOrder.rider_id,
          customer: customer ? { name: customer.name } : null,
          restaurant: restaurant ? { name: restaurant.name, owner_id: restaurant.owner_id } : null,
        },
        status,
        oldStatus
      );

      // Emit real-time notifications to customers via Socket.io
      if (notificationResults && notificationResults.notifications) {
        notificationResults.notifications.forEach((result) => {
          if (result.success && result.notification) {
            const notif = result.notification;
            // Emit to customer if it's a customer notification
            if (notif.user_role === 'customer') {
              try {
                emitOrderStatusUpdate(notif.user_id, {
                  type: notif.type,
                  title: notif.title,
                  message: notif.message,
                  order_id: notif.data?.order_id || finalOrder.id,
                  order_number: notif.data?.order_number || finalOrder.order_number,
                  restaurant_id: notif.data?.restaurant_id || restaurant?.id,
                  restaurant_name: notif.data?.restaurant_name || restaurant?.name,
                  status: status,
                  old_status: oldStatus,
                });
                console.log(`✅ Order status update notification sent to customer ${notif.user_id} for order #${finalOrder.order_number}`);
              } catch (socketError) {
                console.error('Error emitting customer notification via Socket.io:', socketError);
                // Don't fail the notification creation if Socket.io fails
              }
            }
          }
        });
      }

      // If rider was just assigned, notify the rider
      if (assignedRider) {
        try {
          const totalAmount = parseFloat(finalOrder.total_amount) || 0;
          const notificationData = {
            order_id: finalOrder.id,
            order_number: finalOrder.order_number,
            restaurant_id: restaurant?.id,
            restaurant_name: restaurant?.name,
            customer_name: customer?.name,
            total_amount: totalAmount,
          };

          // Create notification in database
          await notificationService.createNotification(
            assignedRider.id,
            'rider',
            'order_assigned',
            'New Order Assigned',
            `You have been assigned order #${finalOrder.order_number} from ${restaurant?.name || 'Restaurant'}. Total: ₹${totalAmount.toFixed(2)}`,
            notificationData
          );

          // Emit real-time notification via Socket.io
          try {
            emitOrderAssigned(assignedRider.id, {
              ...notificationData,
              message: `You have been assigned order #${finalOrder.order_number} from ${restaurant?.name || 'Restaurant'}. Total: ₹${totalAmount.toFixed(2)}`,
            });
            console.log(`✅ Notification sent to rider ${assignedRider.name} (ID: ${assignedRider.id}) for order #${finalOrder.order_number}`);
          } catch (socketError) {
            console.error('Error emitting order assignment via Socket.io:', socketError);
            // Don't fail the notification creation if Socket.io fails
          }
        } catch (riderNotificationError) {
          console.error('Error creating rider notification:', riderNotificationError);
        }
      }
    } catch (notificationError) {
      // Log error but don't fail the status update
      console.error('Error creating status change notifications:', notificationError);
    }

    // If order was marked as "delivered" by a rider, try to assign pending "ready" orders
    if (status === 'delivered' && userRole === 'rider') {
      try {
        const assignmentResults = await riderService.assignPendingReadyOrders(1);
        if (assignmentResults.length > 0 && assignmentResults[0].success) {
          console.log(`✅ Auto-assigned pending order #${assignmentResults[0].order_number} after rider ${userId} delivered order #${finalOrder.order_number}`);
        }
      } catch (assignmentError) {
        // Log error but don't fail the status update
        console.error('Error assigning pending orders after delivery:', assignmentError);
      }
    }

    // Get final order data with rider info
    const finalOrderData = await Order.findByPk(id);
    const riderInfo = finalOrderData.rider_id ? await User.findByPk(finalOrderData.rider_id) : null;

    res.status(200).json({
      success: true,
      message: `Order status updated from ${oldStatus} to ${status}${assignedRider ? `. Rider ${assignedRider.name} automatically assigned.` : ''}`,
      data: {
        order: {
          id: finalOrderData.id,
          order_number: finalOrderData.order_number,
          status: finalOrderData.status,
          estimated_delivery_time: finalOrderData.estimated_delivery_time,
          rider_id: finalOrderData.rider_id,
          rider: riderInfo ? {
            id: riderInfo.id,
            name: riderInfo.name,
            phone: riderInfo.phone,
          } : null,
          updated_at: finalOrderData.updated_at,
        },
      },
    });
  } catch (error) {
    console.error("Update order status error:", error);

    if (error.message.includes("Invalid order status") || error.message.includes("Cannot change")) {
      return res.status(400).json({
        success: false,
        message: error.message,
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
 * @route   GET /api/orders/:id/track
 * @desc    Track order status
 * @access  Private (customer, restaurant_owner, rider)
 */
router.get("/:id/track", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { id } = req.params;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check access permissions (same as GET /api/orders/:id)
    if (userRole === "customer" && order.customer_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only track your own orders",
      });
    }

    if (userRole === "restaurant_owner") {
      const restaurant = await Restaurant.findByPk(order.restaurant_id);
      if (restaurant.owner_id !== userId) {
        return res.status(403).json({
          success: false,
          message: "You can only track orders for your restaurants",
        });
      }
    }

    // Get restaurant for delivery time estimate
    const restaurant = await Restaurant.findByPk(order.restaurant_id);

    res.status(200).json({
      success: true,
      message: "Order tracking retrieved successfully",
      data: {
        order: {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          restaurant: {
            id: restaurant.id,
            name: restaurant.name,
          },
          estimated_delivery_time: order.estimated_delivery_time,
          created_at: order.created_at,
          updated_at: order.updated_at,
          delivered_at: order.delivered_at,
        },
        status_timeline: {
          pending: order.created_at,
          confirmed: order.status !== "pending" ? order.updated_at : null,
          preparing: ["preparing", "ready", "out_for_delivery", "delivered"].includes(order.status) ? order.updated_at : null,
          ready: ["ready", "out_for_delivery", "delivered"].includes(order.status) ? order.updated_at : null,
          out_for_delivery: ["out_for_delivery", "delivered"].includes(order.status) ? order.updated_at : null,
          delivered: order.status === "delivered" ? order.delivered_at : null,
        },
      },
    });
  } catch (error) {
    console.error("Track order error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
