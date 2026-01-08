const { Server } = require('socket.io');
const { verifyToken } = require('../utils/jwt');
const { User } = require('../models');

/**
 * Socket.io Configuration
 * Handles real-time communication for notifications and order updates
 */

let io = null;

/**
 * Initialize Socket.io server
 * @param {http.Server} server - HTTP server instance
 * @returns {Server} Socket.io server instance
 */
const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Authentication middleware for Socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      // Verify token
      const decoded = verifyToken(token);
      
      // Get user from database
      const user = await User.findByPk(decoded.id);
      
      if (!user || !user.is_active) {
        return next(new Error('Authentication error: User not found or inactive'));
      }

      // Attach user info to socket
      socket.userId = user.id;
      socket.userRole = user.role;
      socket.userEmail = user.email;
      
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`✅ Socket connected: User ${socket.userId} (${socket.userRole})`);

    // Join user-specific room for targeted notifications
    socket.join(`user:${socket.userId}`);
    
    // Join role-specific rooms
    if (socket.userRole === 'restaurant_owner') {
      socket.join('restaurant_owners');
    } else if (socket.userRole === 'rider') {
      socket.join('riders');
    } else if (socket.userRole === 'customer') {
      socket.join('customers');
    }

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`❌ Socket disconnected: User ${socket.userId}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
    });
  });

  return io;
};

/**
 * Get Socket.io instance
 * @returns {Server} Socket.io server instance
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initializeSocket() first.');
  }
  return io;
};

/**
 * Emit notification to specific user
 * @param {number} userId - User ID
 * @param {string} event - Event name
 * @param {Object} data - Data to send
 */
const emitToUser = (userId, event, data) => {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
};

/**
 * Emit notification to all users of a specific role
 * @param {string} role - User role ('customer', 'restaurant_owner', 'rider')
 * @param {string} event - Event name
 * @param {Object} data - Data to send
 */
const emitToRole = (role, event, data) => {
  if (!io) return;
  const room = role === 'restaurant_owner' ? 'restaurant_owners' : 
               role === 'rider' ? 'riders' : 'customers';
  io.to(room).emit(event, data);
};

/**
 * Emit order update to restaurant owner
 * @param {number} restaurantOwnerId - Restaurant owner user ID
 * @param {Object} orderData - Order data
 */
const emitOrderUpdate = (restaurantOwnerId, orderData) => {
  emitToUser(restaurantOwnerId, 'order_update', orderData);
};

/**
 * Emit new order notification to restaurant owner
 * @param {number} restaurantOwnerId - Restaurant owner user ID
 * @param {Object} notificationData - Notification data
 */
const emitNewOrder = (restaurantOwnerId, notificationData) => {
  emitToUser(restaurantOwnerId, 'new_order', notificationData);
};

/**
 * Emit order assignment notification to rider
 * @param {number} riderId - Rider user ID
 * @param {Object} notificationData - Notification data
 */
const emitOrderAssigned = (riderId, notificationData) => {
  emitToUser(riderId, 'order_assigned', notificationData);
};

/**
 * Emit order status update notification to customer
 * @param {number} customerId - Customer user ID
 * @param {Object} notificationData - Notification data
 */
const emitOrderStatusUpdate = (customerId, notificationData) => {
  emitToUser(customerId, 'order_status_update', notificationData);
};

module.exports = {
  initializeSocket,
  getIO,
  emitToUser,
  emitToRole,
  emitOrderUpdate,
  emitNewOrder,
  emitOrderAssigned,
  emitOrderStatusUpdate,
};
