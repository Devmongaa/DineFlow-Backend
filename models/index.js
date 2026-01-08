const { sequelize } = require("../config/database");
const User = require("./User.model");
const Restaurant = require("./Restaurant.model");
const MenuItem = require("./MenuItem.model");
const Cart = require("./Cart.model");
const CartItem = require("./CartItem.model");
const Address = require("./Address.model");
const Order = require("./Order.model");
const OrderItem = require("./OrderItem.model");
const Review = require("./Review.model");

/**
 * Initialize all models and associations
 * 
 * This file serves as the central point for:
 * - Importing all models
 * - Defining model associations/relationships
 * - Exporting models and sequelize instance
 */

// Define associations
// User (restaurant_owner) has many Restaurants
User.hasMany(Restaurant, { foreignKey: "owner_id", as: "restaurants" });

// Restaurant belongs to User (owner)
Restaurant.belongsTo(User, { foreignKey: "owner_id", as: "owner" });

// Restaurant has many Menu Items
Restaurant.hasMany(MenuItem, { foreignKey: "restaurant_id", as: "menuItems" });

// Menu Item belongs to Restaurant
MenuItem.belongsTo(Restaurant, { foreignKey: "restaurant_id", as: "restaurant" });

// User (customer) has many Carts
User.hasMany(Cart, { foreignKey: "user_id", as: "carts" });

// Cart belongs to User (customer)
Cart.belongsTo(User, { foreignKey: "user_id", as: "user" });

// Restaurant has many Carts
Restaurant.hasMany(Cart, { foreignKey: "restaurant_id", as: "carts" });

// Cart belongs to Restaurant
Cart.belongsTo(Restaurant, { foreignKey: "restaurant_id", as: "restaurant" });

// Cart has many Cart Items
Cart.hasMany(CartItem, { foreignKey: "cart_id", as: "cartItems" });

// Cart Item belongs to Cart
CartItem.belongsTo(Cart, { foreignKey: "cart_id", as: "cart" });

// Menu Item has many Cart Items
MenuItem.hasMany(CartItem, { foreignKey: "menu_item_id", as: "cartItems" });

// Cart Item belongs to Menu Item
CartItem.belongsTo(MenuItem, { foreignKey: "menu_item_id", as: "menuItem" });

// User (customer) has many Addresses
User.hasMany(Address, { foreignKey: "user_id", as: "addresses" });

// Address belongs to User
Address.belongsTo(User, { foreignKey: "user_id", as: "user" });

// User (customer) has many Orders
User.hasMany(Order, { foreignKey: "customer_id", as: "orders" });

// Order belongs to User (customer)
Order.belongsTo(User, { foreignKey: "customer_id", as: "customer" });

// User (rider) has many Orders (as rider)
User.hasMany(Order, { foreignKey: "rider_id", as: "riderOrders" });

// Order belongs to User (rider)
Order.belongsTo(User, { foreignKey: "rider_id", as: "rider" });

// Restaurant has many Orders
Restaurant.hasMany(Order, { foreignKey: "restaurant_id", as: "orders" });

// Order belongs to Restaurant
Order.belongsTo(Restaurant, { foreignKey: "restaurant_id", as: "restaurant" });

// Address has many Orders
Address.hasMany(Order, { foreignKey: "address_id", as: "orders" });

// Order belongs to Address
Order.belongsTo(Address, { foreignKey: "address_id", as: "deliveryAddress" });

// Order has many Order Items
Order.hasMany(OrderItem, { foreignKey: "order_id", as: "orderItems" });

// Order Item belongs to Order
OrderItem.belongsTo(Order, { foreignKey: "order_id", as: "order" });

// Menu Item has many Order Items
MenuItem.hasMany(OrderItem, { foreignKey: "menu_item_id", as: "orderItems" });

// Order Item belongs to Menu Item
OrderItem.belongsTo(MenuItem, { foreignKey: "menu_item_id", as: "menuItem" });

// User (customer) has many Reviews
User.hasMany(Review, { foreignKey: "customer_id", as: "reviews" });

// Review belongs to User (customer)
Review.belongsTo(User, { foreignKey: "customer_id", as: "customer" });

// Restaurant has many Reviews
Restaurant.hasMany(Review, { foreignKey: "restaurant_id", as: "reviews" });

// Review belongs to Restaurant
Review.belongsTo(Restaurant, { foreignKey: "restaurant_id", as: "restaurant" });

// Order has many Reviews (one review per order)
Order.hasMany(Review, { foreignKey: "order_id", as: "reviews" });

// Review belongs to Order
Review.belongsTo(Order, { foreignKey: "order_id", as: "order" });

/**
 * Sync all models with database
 * WARNING: Use with caution in production!
 * 
 * @param {Object} options - Sync options
 * @param {boolean} options.force - Drop and recreate tables (DANGEROUS!)
 * @param {boolean} options.alter - Alter tables to match models
 */
const syncModels = async (options = {}) => {
  try {
    await sequelize.sync(options);
    console.log("✅ All models synchronized successfully");
  } catch (error) {
    console.error("❌ Error synchronizing models:", error);
    throw error;
  }
};

module.exports = {
  sequelize,
  User,
  Restaurant,
  MenuItem,
  Cart,
  CartItem,
  Address,
  Order,
  OrderItem,
  Review,
  syncModels,
};
