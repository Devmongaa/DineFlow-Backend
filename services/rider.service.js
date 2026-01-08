const { User, Order, sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Rider Service
 * 
 * Business logic for rider management and automatic assignment
 */

/**
 * Find available riders
 * Criteria:
 * - Active riders (is_active: true)
 * - Role: 'rider'
 * - Not currently delivering (no active orders with status 'out_for_delivery')
 * 
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of available rider users
 */
const findAvailableRiders = async (options = {}) => {
  try {
    const { limit = 10 } = options;

    // Find all active riders
    const allRiders = await User.findByRole('rider', {
      limit: 100, // Get more riders to filter
      where: {
        is_active: true,
      },
    });

    if (allRiders.length === 0) {
      return [];
    }

    // Get rider IDs
    const riderIds = allRiders.map(rider => rider.id);

    // Find riders who are currently busy (have orders with status 'ready' or 'out_for_delivery')
    // A rider is unavailable if they have any active order (ready = assigned but not picked, out_for_delivery = picked and delivering)
    const busyRiders = await Order.findAll({
      where: {
        rider_id: {
          [Op.in]: riderIds,
        },
        status: {
          [Op.in]: ['ready', 'out_for_delivery'],
        },
      },
      attributes: ['rider_id'],
      group: ['rider_id'],
    });

    const busyRiderIds = busyRiders.map(order => order.rider_id).filter(Boolean);

    // Filter out riders who are currently busy (have assigned orders)
    const availableRiders = allRiders.filter(rider => !busyRiderIds.includes(rider.id));

    // Limit results
    return availableRiders.slice(0, limit);
  } catch (error) {
    console.error('Error finding available riders:', error);
    throw error;
  }
};

/**
 * Automatically assign a rider to an order
 * Uses round-robin strategy: assigns to the rider with the least active deliveries
 * 
 * @param {number} orderId - Order ID
 * @returns {Promise<Object>} { success: boolean, rider: User|null, message: string }
 */
const autoAssignRider = async (orderId) => {
  try {
    // Find the order
    const order = await Order.findByPk(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    // Check if order is ready
    if (order.status !== 'ready') {
      return {
        success: false,
        rider: null,
        message: `Order must be in 'ready' status. Current status: ${order.status}`,
      };
    }

    // Check if rider is already assigned
    if (order.rider_id) {
      const existingRider = await User.findByPk(order.rider_id);
      return {
        success: true,
        rider: existingRider,
        message: `Rider already assigned: ${existingRider?.name || 'Unknown'}`,
        alreadyAssigned: true,
      };
    }

    // Find available riders
    const availableRiders = await findAvailableRiders({ limit: 10 });

    if (availableRiders.length === 0) {
      return {
        success: false,
        rider: null,
        message: 'No available riders at the moment. Please try again later.',
      };
    }

    // Strategy: Assign to rider with least active deliveries
    // Count active deliveries for each available rider
    const riderDeliveryCounts = await Promise.all(
      availableRiders.map(async (rider) => {
        const activeDeliveries = await Order.count({
          where: {
            rider_id: rider.id,
            status: {
              [Op.in]: ['ready', 'out_for_delivery'],
            },
          },
        });

        return {
          rider,
          count: activeDeliveries,
        };
      })
    );

    // Sort by delivery count (ascending) and pick the first one
    riderDeliveryCounts.sort((a, b) => a.count - b.count);
    const selectedRider = riderDeliveryCounts[0].rider;

    // Assign rider to order
    await Order.assignRider(orderId, selectedRider.id);

    return {
      success: true,
      rider: selectedRider,
      message: `Rider ${selectedRider.name} has been automatically assigned to the order`,
      alreadyAssigned: false,
    };
  } catch (error) {
    console.error('Error auto-assigning rider:', error);
    throw error;
  }
};

/**
 * Assign pending ready orders to available riders
 * This is called when a rider becomes available (e.g., after delivering an order)
 * 
 * @param {number} maxAssignments - Maximum number of orders to assign (default: 1)
 * @returns {Promise<Array>} Array of assignment results
 */
const assignPendingReadyOrders = async (maxAssignments = 1) => {
  try {
    // Find unassigned ready orders
    const pendingOrders = await Order.findAvailableForRider({
      limit: maxAssignments,
      offset: 0,
    });

    if (pendingOrders.length === 0) {
      return [];
    }

    const assignmentResults = [];

    // Try to assign each pending order
    for (const order of pendingOrders) {
      try {
        const result = await autoAssignRider(order.id);
        assignmentResults.push({
          order_id: order.id,
          order_number: order.order_number,
          ...result,
        });
      } catch (error) {
        console.error(`Error assigning order ${order.id}:`, error);
        assignmentResults.push({
          order_id: order.id,
          order_number: order.order_number,
          success: false,
          message: error.message,
        });
      }
    }

    return assignmentResults;
  } catch (error) {
    console.error('Error assigning pending ready orders:', error);
    throw error;
  }
};

/**
 * Get rider statistics
 * 
 * @param {number} riderId - Rider ID
 * @returns {Promise<Object>} Rider statistics
 */
const getRiderStats = async (riderId) => {
  try {
    const rider = await User.findByPk(riderId);

    if (!rider || rider.role !== 'rider') {
      throw new Error('Rider not found');
    }

    // Count orders by status
    const totalOrders = await Order.count({
      where: { rider_id: riderId },
    });

    const deliveredOrders = await Order.count({
      where: {
        rider_id: riderId,
        status: 'delivered',
      },
    });

    const activeOrders = await Order.count({
      where: {
        rider_id: riderId,
        status: {
          [Op.in]: ['ready', 'out_for_delivery'],
        },
      },
    });

    // Calculate earnings from delivered orders
    const { sequelize } = require('../models');
    const deliveredOrdersWithEarnings = await Order.findAll({
      where: {
        rider_id: riderId,
        status: 'delivered',
      },
      attributes: [
        'rider_earning',
        'delivered_at',
      ],
    });

    // Calculate total earnings
    const totalEarnings = deliveredOrdersWithEarnings.reduce((sum, order) => {
      return sum + (parseFloat(order.rider_earning) || 0);
    }, 0);

    // Calculate today's earnings
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEarnings = deliveredOrdersWithEarnings
      .filter(order => {
        if (!order.delivered_at) return false;
        const deliveryDate = new Date(order.delivered_at);
        deliveryDate.setHours(0, 0, 0, 0);
        return deliveryDate.getTime() === today.getTime();
      })
      .reduce((sum, order) => sum + (parseFloat(order.rider_earning) || 0), 0);

    // Calculate this month's earnings
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEarnings = deliveredOrdersWithEarnings
      .filter(order => {
        if (!order.delivered_at) return false;
        const deliveryDate = new Date(order.delivered_at);
        return deliveryDate >= startOfMonth;
      })
      .reduce((sum, order) => sum + (parseFloat(order.rider_earning) || 0), 0);

    // Calculate average earning per delivery
    const averageEarningPerDelivery = deliveredOrders > 0 
      ? (totalEarnings / deliveredOrders).toFixed(2) 
      : 0;

    return {
      rider: {
        id: rider.id,
        name: rider.name,
        email: rider.email,
        phone: rider.phone,
      },
      stats: {
        total_orders: totalOrders,
        delivered_orders: deliveredOrders,
        active_orders: activeOrders,
        completion_rate: totalOrders > 0 ? ((deliveredOrders / totalOrders) * 100).toFixed(2) : 0,
        total_earnings: totalEarnings.toFixed(2),
        today_earnings: todayEarnings.toFixed(2),
        this_month_earnings: monthEarnings.toFixed(2),
        average_earning_per_delivery: averageEarningPerDelivery,
      },
    };
  } catch (error) {
    console.error('Error getting rider stats:', error);
    throw error;
  }
};

module.exports = {
  findAvailableRiders,
  autoAssignRider,
  assignPendingReadyOrders,
  getRiderStats,
};
