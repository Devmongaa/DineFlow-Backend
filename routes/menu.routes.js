const express = require("express");
const router = express.Router();
const { MenuItem, Restaurant } = require("../models");
const { authenticateToken, requireRole } = require("../middleware/auth.middleware");

/**
 * @route   GET /api/menu-items/:id
 * @desc    Get menu item details by ID
 * @access  Public
 */
router.get("/menu-items/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const menuItem = await MenuItem.findById(id);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Menu item retrieved successfully",
      data: {
        menuItem,
      },
    });
  } catch (error) {
    console.error("Get menu item error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});


/**
 * @route   PUT /api/menu-items/:id
 * @desc    Update menu item (restaurant owner only, must own restaurant)
 * @access  Private (restaurant_owner)
 */
router.put("/menu-items/:id", authenticateToken, requireRole(["restaurant_owner"]), async (req, res) => {
  try {
    const { id } = req.params;

    // Find menu item
    const menuItem = await MenuItem.findById(id);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    // Find restaurant to check ownership
    const restaurant = await Restaurant.findById(menuItem.restaurant_id);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    // Check if user owns this restaurant
    if (restaurant.owner_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only update menu items from your own restaurants",
      });
    }

    // Update menu item
    const updatedMenuItem = await MenuItem.updateMenuItem(id, req.body);

    res.status(200).json({
      success: true,
      message: "Menu item updated successfully",
      data: {
        menuItem: updatedMenuItem,
      },
    });
  } catch (error) {
    console.error("Update menu item error:", error);

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
 * @route   DELETE /api/menu-items/:id
 * @desc    Delete menu item (soft delete by setting is_available = false)
 * @access  Private (restaurant_owner)
 */
router.delete("/menu-items/:id", authenticateToken, requireRole(["restaurant_owner"]), async (req, res) => {
  try {
    const { id } = req.params;

    // Find menu item
    const menuItem = await MenuItem.findById(id);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    // Find restaurant to check ownership
    const restaurant = await Restaurant.findById(menuItem.restaurant_id);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    // Check if user owns this restaurant
    if (restaurant.owner_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only delete menu items from your own restaurants",
      });
    }

    // Soft delete (set is_available to false)
    await menuItem.update({ is_available: false });

    res.status(200).json({
      success: true,
      message: "Menu item deleted successfully",
    });
  } catch (error) {
    console.error("Delete menu item error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   PUT /api/menu-items/:id/toggle-availability
 * @desc    Toggle menu item availability
 * @access  Private (restaurant_owner)
 */
router.put("/menu-items/:id/toggle-availability", authenticateToken, requireRole(["restaurant_owner"]), async (req, res) => {
  try {
    const { id } = req.params;

    // Find menu item
    const menuItem = await MenuItem.findById(id);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    // Find restaurant to check ownership
    const restaurant = await Restaurant.findById(menuItem.restaurant_id);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    // Check if user owns this restaurant
    if (restaurant.owner_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only toggle availability of menu items from your own restaurants",
      });
    }

    // Toggle availability
    const updatedMenuItem = await MenuItem.toggleAvailability(id);

    res.status(200).json({
      success: true,
      message: `Menu item ${updatedMenuItem.is_available ? "enabled" : "disabled"} successfully`,
      data: {
        menuItem: updatedMenuItem,
      },
    });
  } catch (error) {
    console.error("Toggle availability error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
