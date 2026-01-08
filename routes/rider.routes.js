const express = require("express");
const router = express.Router();
const { Order, OrderItem, Restaurant, Address, User } = require("../models");
const { authenticateToken, requireRole } = require("../middleware/auth.middleware");
const riderService = require("../services/rider.service");
const notificationService = require("../services/notification.service");
const { emitOrderStatusUpdate } = require("../config/socket");
const { emitOrderAssigned } = require("../config/socket");

/**
 * @route   GET /api/rider/orders
 * @desc    Get orders assigned to the current rider
 * @access  Private (rider only)
 */
router.get("/orders", authenticateToken, requireRole(["rider"]), async (req, res) => {
  try {
    const riderId = req.user.id;
    const { status, limit = 50, offset = 0 } = req.query;

    // Get orders assigned to this rider
    const orders = await Order.findByRider(riderId, {
      status,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Get order details for each order
    const ordersWithDetails = await Promise.all(
      orders.map(async (order) => {
        const orderItems = await OrderItem.findByOrder(order.id);
        const restaurant = await Restaurant.findByPk(order.restaurant_id);
        const address = await Address.findByPk(order.address_id);
        const customer = await User.findByPk(order.customer_id);

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
            phone: restaurant.phone,
            address: restaurant.address,
          },
          delivery_address: {
            id: address.id,
            address_line: address.address_line,
            city: address.city,
            state: address.state,
            zip_code: address.zip_code,
          },
          subtotal: order.subtotal,
          delivery_fee: order.delivery_fee,
          total_amount: order.total_amount,
          item_count: orderItems.length,
          estimated_delivery_time: order.estimated_delivery_time,
          created_at: order.created_at,
          updated_at: order.updated_at,
        };
      })
    );

    res.status(200).json({
      success: true,
      message: "Rider orders retrieved successfully",
      data: {
        orders: ordersWithDetails,
        count: ordersWithDetails.length,
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
    console.error("Get rider orders error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   GET /api/rider/orders/available
 * @desc    Get available orders (ready and not assigned) - for reference
 * @access  Private (rider only)
 * @note    Orders are now auto-assigned, but this endpoint can be useful for visibility
 */
router.get("/orders/available", authenticateToken, requireRole(["rider"]), async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    // Get available orders (ready and not assigned)
    const orders = await Order.findAvailableForRider({
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Get order details
    const ordersWithDetails = await Promise.all(
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
            address: restaurant.address,
          },
          delivery_address: {
            address_line: address.address_line,
            city: address.city,
            state: address.state,
          },
          total_amount: order.total_amount,
          item_count: orderItems.length,
          created_at: order.created_at,
        };
      })
    );

    res.status(200).json({
      success: true,
      message: "Available orders retrieved successfully",
      data: {
        orders: ordersWithDetails,
        count: ordersWithDetails.length,
        note: "Orders are automatically assigned when they become ready. This list shows orders that are ready but not yet assigned.",
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      },
    });
  } catch (error) {
    console.error("Get available orders error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   GET /api/rider/stats
 * @desc    Get rider statistics
 * @access  Private (rider only)
 */
router.get("/stats", authenticateToken, requireRole(["rider"]), async (req, res) => {
  try {
    const riderId = req.user.id;

    const stats = await riderService.getRiderStats(riderId);

    res.status(200).json({
      success: true,
      message: "Rider statistics retrieved successfully",
      data: stats,
    });
  } catch (error) {
    console.error("Get rider stats error:", error);

    if (error.message.includes("Rider not found")) {
      return res.status(404).json({
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
 * @route   PUT /api/rider/orders/:id/status
 * @desc    Update order delivery status (rider only)
 * @access  Private (rider only)
 * @note    This is a convenience endpoint. Riders can also use PUT /api/orders/:id/status
 */
router.put("/orders/:id/status", authenticateToken, requireRole(["rider"]), async (req, res) => {
  try {
    const riderId = req.user.id;
    const { id } = req.params;
    const { status, estimated_delivery_time } = req.body;

    // Input validation
    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    // Riders can mark order as "picked" (ready → out_for_delivery) or "delivered" (out_for_delivery → delivered)
    const validStatuses = ["out_for_delivery", "delivered"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Riders can only update to: ${validStatuses.join(", ")}`,
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

    // Verify order is assigned to this rider
    if (order.rider_id !== riderId) {
      return res.status(403).json({
        success: false,
        message: "You can only update orders assigned to you",
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

    // Prepare update data
    const updateData = { status };
    if (estimated_delivery_time) {
      updateData.estimated_delivery_time = parseInt(estimated_delivery_time);
    }

    // Update order status
    const oldStatus = order.status;
    const updatedOrder = await Order.updateStatus(id, status, updateData);

    // Get related data for notifications using updatedOrder to ensure correct restaurant_id
    const restaurant = await Restaurant.findByPk(updatedOrder.restaurant_id);
    const customer = await User.findByPk(updatedOrder.customer_id);

    // Create notifications for order status change (non-blocking)
    try {
      const notificationResults = await notificationService.notifyOrderStatusChange(
        {
          id: updatedOrder.id,
          order_number: updatedOrder.order_number,
          customer_id: updatedOrder.customer_id,
          restaurant_id: updatedOrder.restaurant_id,
          rider_id: riderId,
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
                  order_id: notif.data?.order_id || updatedOrder.id,
                  order_number: notif.data?.order_number || updatedOrder.order_number,
                  restaurant_id: notif.data?.restaurant_id || restaurant?.id,
                  restaurant_name: notif.data?.restaurant_name || restaurant?.name,
                  status: status,
                  old_status: oldStatus,
                });
                console.log(`✅ Order status update notification sent to customer ${notif.user_id} for order #${updatedOrder.order_number}`);
              } catch (socketError) {
                console.error('Error emitting customer notification via Socket.io:', socketError);
                // Don't fail the notification creation if Socket.io fails
              }
            }
          }
        });
      }
    } catch (notificationError) {
      // Log error but don't fail the status update
      console.error('Error creating status change notifications:', notificationError);
    }

    // If order was marked as "delivered", rider is now available
    // Try to assign any pending "ready" orders to this rider (or other available riders)
    if (status === 'delivered') {
      try {
        const assignmentResults = await riderService.assignPendingReadyOrders(1);
        if (assignmentResults.length > 0 && assignmentResults[0].success && assignmentResults[0].rider) {
          const assignedRider = assignmentResults[0].rider;
          const assignedOrder = await Order.findByPk(assignmentResults[0].order_id, {
            include: [
              { model: Restaurant, as: 'restaurant' },
              { model: User, as: 'customer' },
            ],
          });
          
          console.log(`✅ Auto-assigned pending order #${assignmentResults[0].order_number} after rider ${riderId} delivered order #${updatedOrder.order_number}`);
          
          // Notify the newly assigned rider
          try {
            const totalAmount = parseFloat(assignedOrder.total_amount) || 0;
            const notificationData = {
              order_id: assignedOrder.id,
              order_number: assignedOrder.order_number,
              restaurant_id: assignedOrder.restaurant_id,
              restaurant_name: assignedOrder.restaurant?.name,
              customer_name: assignedOrder.customer?.name,
              total_amount: totalAmount,
            };

            // Create notification in database
            await notificationService.createNotification(
              assignedRider.id,
              'rider',
              'order_assigned',
              'New Order Assigned',
              `You have been assigned order #${assignedOrder.order_number} from ${assignedOrder.restaurant?.name || 'Restaurant'}. Total: ₹${totalAmount.toFixed(2)}`,
              notificationData
            );

            // Emit real-time notification via Socket.io
            try {
              emitOrderAssigned(assignedRider.id, {
                ...notificationData,
                message: `You have been assigned order #${assignedOrder.order_number} from ${assignedOrder.restaurant?.name || 'Restaurant'}. Total: ₹${totalAmount.toFixed(2)}`,
              });
              console.log(`✅ Notification sent to rider ${assignedRider.name} (ID: ${assignedRider.id}) for order #${assignedOrder.order_number}`);
            } catch (socketError) {
              console.error('Error emitting order assignment via Socket.io:', socketError);
              // Don't fail the notification creation if Socket.io fails
            }
          } catch (riderNotificationError) {
            console.error('Error creating/emitting notification for assigned rider:', riderNotificationError);
          }
        }
      } catch (assignmentError) {
        // Log error but don't fail the status update
        console.error('Error assigning pending orders after delivery:', assignmentError);
      }
    }

    res.status(200).json({
      success: true,
      message: `Order status updated from ${oldStatus} to ${status}`,
      data: {
        order: {
          id: updatedOrder.id,
          order_number: updatedOrder.order_number,
          status: updatedOrder.status,
          estimated_delivery_time: updatedOrder.estimated_delivery_time,
          updated_at: updatedOrder.updated_at,
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

module.exports = router;
