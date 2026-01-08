const express = require("express");
const router = express.Router();
const { Cart, CartItem, MenuItem, Restaurant } = require("../models");
const { authenticateToken, requireRole } = require("../middleware/auth.middleware");

/**
 * @route   GET /api/cart
 * @desc    Get current user's cart with all items
 * @access  Private (customer only)
 */
router.get("/", authenticateToken, requireRole(["customer"]), async (req, res) => {
  try {
    const userId = req.user.id;

    // Find user's cart
    const cart = await Cart.findByUser(userId);

    if (!cart) {
      return res.status(200).json({
        success: true,
        message: "Cart is empty",
        data: {
          cart: null,
          summary: {
            subtotal: 0,
            delivery_fee: 0,
            total: 0,
            item_count: 0,
          },
        },
      });
    }

    // Get all cart items with menu item details
    const cartItems = await CartItem.findByCart(cart.id);

    // Load menu item details for each cart item
    const itemsWithDetails = await Promise.all(
      cartItems.map(async (item) => {
        const menuItem = await MenuItem.findByPk(item.menu_item_id);
        return {
          id: item.id,
          menu_item: {
            id: menuItem.id,
            name: menuItem.name,
            description: menuItem.description,
            image_url: menuItem.image_url,
            category: menuItem.category,
            current_price: menuItem.price, // Current price in menu
            is_available: menuItem.is_available,
          },
          quantity: item.quantity,
          price: item.price, // Price snapshot when added to cart
          subtotal: (parseFloat(item.price) * item.quantity).toFixed(2),
        };
      })
    );

    // Get restaurant details
    const restaurant = await Restaurant.findByPk(cart.restaurant_id);

    // Calculate totals
    const subtotal = await CartItem.calculateSubtotal(cart.id);
    const deliveryFee = 50.0; // Base delivery fee (rider earns 80% = ₹40 per delivery)
    const total = subtotal + deliveryFee;

    res.status(200).json({
      success: true,
      message: "Cart retrieved successfully",
      data: {
        cart: {
          id: cart.id,
          restaurant: {
            id: restaurant.id,
            name: restaurant.name,
            image_url: restaurant.image_url,
            city: restaurant.city,
          },
          items: itemsWithDetails,
        },
        summary: {
          subtotal: subtotal.toFixed(2),
          delivery_fee: deliveryFee.toFixed(2),
          total: total.toFixed(2),
          item_count: cartItems.length,
        },
      },
    });
  } catch (error) {
    console.error("Get cart error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   POST /api/cart/items
 * @desc    Add item to cart
 * @access  Private (customer only)
 */
router.post("/items", authenticateToken, requireRole(["customer"]), async (req, res) => {
  try {
    const userId = req.user.id;
    const { menu_item_id, quantity = 1 } = req.body;

    // Input validation
    if (!menu_item_id) {
      return res.status(400).json({
        success: false,
        message: "Menu item ID is required",
      });
    }

    if (quantity <= 0 || !Number.isInteger(quantity)) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive integer",
      });
    }

    // Find menu item
    const menuItem = await MenuItem.findByPk(menu_item_id);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    // Check if menu item is available
    if (!menuItem.is_available) {
      return res.status(400).json({
        success: false,
        message: "This item is currently unavailable",
      });
    }

    // Check if restaurant is active and accepting orders
    const restaurant = await Restaurant.findByPk(menuItem.restaurant_id);

    if (!restaurant || !restaurant.is_active || !restaurant.is_accepting_orders) {
      return res.status(400).json({
        success: false,
        message: "This restaurant is currently not accepting orders",
      });
    }

    // Find or create cart for user
    let cart;
    try {
      cart = await Cart.findOrCreateForUser(userId, menuItem.restaurant_id);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Add item to cart
    const cartItem = await CartItem.addOrUpdateItem(
      cart.id,
      menu_item_id,
      quantity,
      parseFloat(menuItem.price)
    );

    // Get updated cart with items
    const updatedCartItems = await CartItem.findByCart(cart.id);
    const subtotal = await CartItem.calculateSubtotal(cart.id);

    res.status(200).json({
      success: true,
      message: "Item added to cart successfully",
      data: {
        cart_item: {
          id: cartItem.id,
          menu_item_id: cartItem.menu_item_id,
          quantity: cartItem.quantity,
          price: cartItem.price,
        },
        cart: {
          id: cart.id,
          restaurant_id: cart.restaurant_id,
          item_count: updatedCartItems.length,
          subtotal: subtotal.toFixed(2),
        },
      },
    });
  } catch (error) {
    console.error("Add to cart error:", error);

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
 * @route   PUT /api/cart/items/:id
 * @desc    Update cart item quantity
 * @access  Private (customer only)
 */
router.put("/items/:id", authenticateToken, requireRole(["customer"]), async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { quantity } = req.body;

    // Input validation
    if (!quantity || quantity <= 0 || !Number.isInteger(quantity)) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive integer",
      });
    }

    // Find cart item
    const cartItem = await CartItem.findByPk(id);

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    // Verify cart belongs to user
    const cart = await Cart.findByPk(cartItem.cart_id);

    if (!cart || cart.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only update items in your own cart",
      });
    }

    // Update quantity
    const updatedItem = await CartItem.updateQuantity(id, quantity);

    // Calculate updated subtotal
    const subtotal = await CartItem.calculateSubtotal(cart.id);

    res.status(200).json({
      success: true,
      message: "Cart item updated successfully",
      data: {
        cart_item: {
          id: updatedItem.id,
          menu_item_id: updatedItem.menu_item_id,
          quantity: updatedItem.quantity,
          price: updatedItem.price,
          subtotal: (parseFloat(updatedItem.price) * updatedItem.quantity).toFixed(2),
        },
        cart: {
          id: cart.id,
          subtotal: subtotal.toFixed(2),
        },
      },
    });
  } catch (error) {
    console.error("Update cart item error:", error);

    if (error.message === "Cart item not found" || error.message.includes("Quantity")) {
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
 * @route   DELETE /api/cart/items/:id
 * @desc    Remove item from cart
 * @access  Private (customer only)
 */
router.delete("/items/:id", authenticateToken, requireRole(["customer"]), async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Find cart item
    const cartItem = await CartItem.findByPk(id);

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    // Verify cart belongs to user
    const cart = await Cart.findByPk(cartItem.cart_id);

    if (!cart || cart.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only remove items from your own cart",
      });
    }

    // Remove item
    await CartItem.removeItem(id);

    // Check if cart is now empty
    const remainingItems = await CartItem.findByCart(cart.id);

    if (remainingItems.length === 0) {
      // Delete empty cart
      await Cart.deleteCart(cart.id);
      return res.status(200).json({
        success: true,
        message: "Item removed from cart. Cart is now empty.",
        data: {
          cart: null,
        },
      });
    }

    // Calculate updated subtotal
    const subtotal = await CartItem.calculateSubtotal(cart.id);

    res.status(200).json({
      success: true,
      message: "Item removed from cart successfully",
      data: {
        cart: {
          id: cart.id,
          item_count: remainingItems.length,
          subtotal: subtotal.toFixed(2),
        },
      },
    });
  } catch (error) {
    console.error("Remove cart item error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   DELETE /api/cart
 * @desc    Clear entire cart
 * @access  Private (customer only)
 */
router.delete("/", authenticateToken, requireRole(["customer"]), async (req, res) => {
  try {
    const userId = req.user.id;

    // Find user's cart
    const cart = await Cart.findByUser(userId);

    if (!cart) {
      return res.status(200).json({
        success: true,
        message: "Cart is already empty",
      });
    }

    // Delete cart (this also clears all cart items)
    await Cart.deleteCart(cart.id);

    res.status(200).json({
      success: true,
      message: "Cart cleared successfully",
    });
  } catch (error) {
    console.error("Clear cart error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
