const mongoose = require('mongoose');

/**
 * Notification Model
 * 
 * Stores notifications for users (customers, restaurant owners, riders)
 * Uses MongoDB for flexible schema and high write performance
 */

const notificationSchema = new mongoose.Schema(
  {
    user_id: {
      type: Number,
      required: true,
      index: true, // Index for faster queries
    },
    user_role: {
      type: String,
      required: true,
      enum: ['customer', 'restaurant_owner', 'rider'],
    },
    type: {
      type: String,
      required: true,
      // Customer notification types
      enum: [
        // Customer notifications
        'order_placed',
        'order_confirmed',
        'order_preparing',
        'order_ready',
        'order_out_for_delivery',
        'order_delivered',
        'order_cancelled',
        'rider_assigned',
        // Restaurant owner notifications
        'new_order',
        'order_cancelled_restaurant',
        'payment_received',
        'rider_assigned_restaurant',
        // Rider notifications
        'order_assigned',
        'order_ready_for_pickup',
        'order_cancelled_rider',
      ],
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      // Can contain: order_id, restaurant_id, restaurant_name, order_number, etc.
    },
    read: {
      type: Boolean,
      default: false,
      index: true, // Index for faster unread queries
    },
    read_at: {
      type: Date,
      default: null,
    },
    expires_at: {
      type: Date,
      default: null,
      // Optional: notifications can expire after certain time
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    collection: 'notifications', // Explicit collection name
  }
);

// Compound indexes for common queries
notificationSchema.index({ user_id: 1, read: 1, createdAt: -1 });
notificationSchema.index({ user_id: 1, type: 1 });
notificationSchema.index({ createdAt: -1 }); // For cleanup queries

/**
 * Static Methods
 */

/**
 * Create a new notification
 * @param {Object} notificationData - Notification data
 * @returns {Promise<Notification>}
 */
notificationSchema.statics.createNotification = async function (notificationData) {
  const notification = new this(notificationData);
  return await notification.save();
};

/**
 * Find notifications by user ID
 * @param {number} userId - User ID
 * @param {Object} options - Query options (page, limit, read, type)
 * @returns {Promise<Array>}
 */
notificationSchema.statics.findByUserId = async function (userId, options = {}) {
  const {
    page = 1,
    limit = 20,
    read = null, // null = all, true = read only, false = unread only
    type = null,
  } = options;

  const query = { user_id: userId };

  // Filter by read status
  if (read !== null) {
    query.read = read;
  }

  // Filter by type
  if (type) {
    query.type = type;
  }

  const skip = (page - 1) * limit;

  return await this.find(query)
    .sort({ createdAt: -1 }) // Newest first
    .skip(skip)
    .limit(parseInt(limit))
    .lean(); // Return plain JavaScript objects for better performance
};

/**
 * Get unread notification count for a user
 * @param {number} userId - User ID
 * @returns {Promise<number>}
 */
notificationSchema.statics.getUnreadCount = async function (userId) {
  return await this.countDocuments({
    user_id: userId,
    read: false,
  });
};

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @param {number} userId - User ID (for security)
 * @returns {Promise<Notification|null>}
 */
notificationSchema.statics.markAsRead = async function (notificationId, userId) {
  return await this.findOneAndUpdate(
    {
      _id: notificationId,
      user_id: userId, // Ensure user can only mark their own notifications as read
    },
    {
      read: true,
      read_at: new Date(),
    },
    {
      new: true, // Return updated document
    }
  );
};

/**
 * Mark all notifications as read for a user
 * @param {number} userId - User ID
 * @returns {Promise<Object>}
 */
notificationSchema.statics.markAllAsRead = async function (userId) {
  return await this.updateMany(
    {
      user_id: userId,
      read: false,
    },
    {
      read: true,
      read_at: new Date(),
    }
  );
};

/**
 * Delete a notification
 * @param {string} notificationId - Notification ID
 * @param {number} userId - User ID (for security)
 * @returns {Promise<Notification|null>}
 */
notificationSchema.statics.deleteNotification = async function (notificationId, userId) {
  return await this.findOneAndDelete({
    _id: notificationId,
    user_id: userId, // Ensure user can only delete their own notifications
  });
};

/**
 * Delete all notifications for a user
 * @param {number} userId - User ID
 * @returns {Promise<Object>}
 */
notificationSchema.statics.deleteAllForUser = async function (userId) {
  return await this.deleteMany({
    user_id: userId,
  });
};

/**
 * Delete old notifications (cleanup)
 * @param {number} daysOld - Delete notifications older than this many days
 * @returns {Promise<Object>}
 */
notificationSchema.statics.deleteOldNotifications = async function (daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  return await this.deleteMany({
    createdAt: { $lt: cutoffDate },
  });
};

/**
 * Find notification by ID
 * @param {string} notificationId - Notification ID
 * @param {number} userId - User ID (for security)
 * @returns {Promise<Notification|null>}
 */
notificationSchema.statics.findByIdAndUser = async function (notificationId, userId) {
  return await this.findOne({
    _id: notificationId,
    user_id: userId,
  }).lean();
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
