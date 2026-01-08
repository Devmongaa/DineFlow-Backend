const Notification = require('../models/Notification.model');

/**
 * Notification Service
 * 
 * Business logic for creating and managing notifications
 */

/**
 * Create a notification for a user
 * @param {number} userId - User ID
 * @param {string} userRole - User role ('customer', 'restaurant_owner', 'rider')
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {Object} data - Additional data (order_id, restaurant_id, etc.)
 * @returns {Promise<Object>}
 */
const createNotification = async (userId, userRole, type, title, message, data = {}) => {
  try {
    const notification = await Notification.createNotification({
      user_id: userId,
      user_role: userRole,
      type,
      title,
      message,
      data,
    });

    return {
      success: true,
      notification: notification.toObject(),
    };
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

/**
 * Create notifications for multiple users
 * @param {Array<{userId: number, userRole: string}>} users - Array of user objects
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {Object} data - Additional data
 * @returns {Promise<Array>}
 */
const createNotificationsForUsers = async (users, type, title, message, data = {}) => {
  try {
    const notifications = users.map((user) => ({
      user_id: user.userId,
      user_role: user.userRole,
      type,
      title,
      message,
      data,
    }));

    const created = await Notification.insertMany(notifications);
    return {
      success: true,
      notifications: created.map((n) => n.toObject()),
      count: created.length,
    };
  } catch (error) {
    console.error('Error creating notifications for users:', error);
    throw error;
  }
};

/**
 * Get notifications for a user
 * @param {number} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>}
 */
const getUserNotifications = async (userId, options = {}) => {
  try {
    const notifications = await Notification.findByUserId(userId, options);
    return {
      success: true,
      notifications,
      count: notifications.length,
    };
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
};

/**
 * Get unread notification count for a user
 * @param {number} userId - User ID
 * @returns {Promise<number>}
 */
const getUnreadCount = async (userId) => {
  try {
    const count = await Notification.getUnreadCount(userId);
    return count;
  } catch (error) {
    console.error('Error getting unread count:', error);
    throw error;
  }
};

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @param {number} userId - User ID
 * @returns {Promise<Object>}
 */
const markAsRead = async (notificationId, userId) => {
  try {
    const notification = await Notification.markAsRead(notificationId, userId);
    
    if (!notification) {
      return {
        success: false,
        message: 'Notification not found or unauthorized',
      };
    }

    return {
      success: true,
      notification: notification.toObject(),
    };
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 * @param {number} userId - User ID
 * @returns {Promise<Object>}
 */
const markAllAsRead = async (userId) => {
  try {
    const result = await Notification.markAllAsRead(userId);
    return {
      success: true,
      modifiedCount: result.modifiedCount,
    };
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

/**
 * Delete a notification
 * @param {string} notificationId - Notification ID
 * @param {number} userId - User ID
 * @returns {Promise<Object>}
 */
const deleteNotification = async (notificationId, userId) => {
  try {
    const notification = await Notification.deleteNotification(notificationId, userId);
    
    if (!notification) {
      return {
        success: false,
        message: 'Notification not found or unauthorized',
      };
    }

    return {
      success: true,
      message: 'Notification deleted successfully',
    };
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};

/**
 * Delete all notifications for a user
 * @param {number} userId - User ID
 * @returns {Promise<Object>}
 */
const deleteAllForUser = async (userId) => {
  try {
    const result = await Notification.deleteAllForUser(userId);
    return {
      success: true,
      deletedCount: result.deletedCount,
    };
  } catch (error) {
    console.error('Error deleting all notifications:', error);
    throw error;
  }
};

/**
 * Helper function to create order-related notifications
 * @param {Object} order - Order object
 * @param {string} status - New order status
 * @param {string} oldStatus - Previous order status
 * @returns {Promise<Object>}
 */
const notifyOrderStatusChange = async (order, status, oldStatus = null) => {
  const notifications = [];

  // Determine notification type and recipients based on status
  switch (status) {
    case 'pending':
      // New order - notify restaurant owner
      notifications.push({
        userId: order.restaurant.owner_id,
        userRole: 'restaurant_owner',
        type: 'new_order',
        title: 'New Order Received',
        message: `You have received a new order #${order.order_number} from ${order.customer?.name || 'Customer'}`,
        data: {
          order_id: order.id,
          order_number: order.order_number,
          restaurant_id: order.restaurant_id,
          customer_name: order.customer?.name,
        },
      });
      break;

    case 'confirmed':
      // Order confirmed - notify customer
      notifications.push({
        userId: order.customer_id,
        userRole: 'customer',
        type: 'order_confirmed',
        title: 'Order Confirmed',
        message: `Your order #${order.order_number} has been confirmed by ${order.restaurant?.name || 'the restaurant'}`,
        data: {
          order_id: order.id,
          order_number: order.order_number,
          restaurant_id: order.restaurant_id,
          restaurant_name: order.restaurant?.name,
        },
      });
      break;

    case 'preparing':
      // Order being prepared - notify customer
      notifications.push({
        userId: order.customer_id,
        userRole: 'customer',
        type: 'order_preparing',
        title: 'Order Being Prepared',
        message: `${order.restaurant?.name || 'The restaurant'} is now preparing your order #${order.order_number}`,
        data: {
          order_id: order.id,
          order_number: order.order_number,
          restaurant_id: order.restaurant_id,
          restaurant_name: order.restaurant?.name,
        },
      });
      break;

    case 'ready':
      // Order ready - notify customer and rider
      notifications.push({
        userId: order.customer_id,
        userRole: 'customer',
        type: 'order_ready',
        title: 'Order Ready',
        message: `Your order #${order.order_number} is ready for pickup`,
        data: {
          order_id: order.id,
          order_number: order.order_number,
          restaurant_id: order.restaurant_id,
          restaurant_name: order.restaurant?.name,
        },
      });
      // If rider is assigned, notify them too
      if (order.rider_id) {
        notifications.push({
          userId: order.rider_id,
          userRole: 'rider',
          type: 'order_ready_for_pickup',
          title: 'Order Ready for Pickup',
          message: `Order #${order.order_number} is ready for pickup at ${order.restaurant?.name || 'restaurant'}`,
          data: {
            order_id: order.id,
            order_number: order.order_number,
            restaurant_id: order.restaurant_id,
            restaurant_name: order.restaurant?.name,
          },
        });
      }
      break;

    case 'out_for_delivery':
      // Order out for delivery - notify customer
      notifications.push({
        userId: order.customer_id,
        userRole: 'customer',
        type: 'order_out_for_delivery',
        title: 'Order Out for Delivery',
        message: `Your order #${order.order_number} is on the way!`,
        data: {
          order_id: order.id,
          order_number: order.order_number,
          restaurant_id: order.restaurant_id,
          restaurant_name: order.restaurant?.name,
        },
      });
      break;

    case 'delivered':
      // Order delivered - notify customer and restaurant
      notifications.push({
        userId: order.customer_id,
        userRole: 'customer',
        type: 'order_delivered',
        title: 'Order Delivered',
        message: `Your order #${order.order_number} has been delivered. Enjoy your meal!`,
        data: {
          order_id: order.id,
          order_number: order.order_number,
          restaurant_id: order.restaurant_id,
          restaurant_name: order.restaurant?.name,
        },
      });
      notifications.push({
        userId: order.restaurant.owner_id,
        userRole: 'restaurant_owner',
        type: 'order_delivered',
        title: 'Order Delivered',
        message: `Order #${order.order_number} has been delivered to the customer`,
        data: {
          order_id: order.id,
          order_number: order.order_number,
          restaurant_id: order.restaurant_id,
        },
      });
      break;

    case 'cancelled':
      // Order cancelled - notify all parties
      notifications.push({
        userId: order.customer_id,
        userRole: 'customer',
        type: 'order_cancelled',
        title: 'Order Cancelled',
        message: `Your order #${order.order_number} has been cancelled`,
        data: {
          order_id: order.id,
          order_number: order.order_number,
          restaurant_id: order.restaurant_id,
        },
      });
      notifications.push({
        userId: order.restaurant.owner_id,
        userRole: 'restaurant_owner',
        type: 'order_cancelled_restaurant',
        title: 'Order Cancelled',
        message: `Order #${order.order_number} has been cancelled`,
        data: {
          order_id: order.id,
          order_number: order.order_number,
          restaurant_id: order.restaurant_id,
        },
      });
      if (order.rider_id) {
        notifications.push({
          userId: order.rider_id,
          userRole: 'rider',
          type: 'order_cancelled_rider',
          title: 'Order Cancelled',
          message: `Order #${order.order_number} has been cancelled`,
          data: {
            order_id: order.id,
            order_number: order.order_number,
          },
        });
      }
      break;
  }

  // Create all notifications
  const results = [];
  for (const notif of notifications) {
    try {
      const result = await createNotification(
        notif.userId,
        notif.userRole,
        notif.type,
        notif.title,
        notif.message,
        notif.data
      );
      results.push(result);
    } catch (error) {
      console.error(`Error creating notification for user ${notif.userId}:`, error);
      results.push({ success: false, error: error.message });
    }
  }

  return {
    success: true,
    notifications: results,
    count: results.length,
  };
};

module.exports = {
  createNotification,
  createNotificationsForUsers,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllForUser,
  notifyOrderStatusChange,
};
