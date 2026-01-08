const express = require("express");
const router = express.Router();
const { Address } = require("../models");
const { authenticateToken, requireRole } = require("../middleware/auth.middleware");

/**
 * @route   GET /api/addresses
 * @desc    Get all addresses for current user
 * @access  Private (customer only)
 */
router.get("/", authenticateToken, requireRole(["customer"]), async (req, res) => {
  try {
    const userId = req.user.id;

    const addresses = await Address.findByUser(userId);

    res.status(200).json({
      success: true,
      message: "Addresses retrieved successfully",
      data: {
        addresses,
        count: addresses.length,
      },
    });
  } catch (error) {
    console.error("Get addresses error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   GET /api/addresses/default
 * @desc    Get default address for current user
 * @access  Private (customer only)
 */
router.get("/default", authenticateToken, requireRole(["customer"]), async (req, res) => {
  try {
    const userId = req.user.id;

    const address = await Address.findDefault(userId);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "No default address found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Default address retrieved successfully",
      data: {
        address,
      },
    });
  } catch (error) {
    console.error("Get default address error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   GET /api/addresses/:id
 * @desc    Get address by ID
 * @access  Private (customer only)
 */
router.get("/:id", authenticateToken, requireRole(["customer"]), async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const address = await Address.findById(id);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // Verify address belongs to user
    if (address.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only view your own addresses",
      });
    }

    res.status(200).json({
      success: true,
      message: "Address retrieved successfully",
      data: {
        address,
      },
    });
  } catch (error) {
    console.error("Get address error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   POST /api/addresses
 * @desc    Create a new address
 * @access  Private (customer only)
 */
router.post("/", authenticateToken, requireRole(["customer"]), async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      address_line,
      city,
      state,
      zip_code,
      country,
      latitude,
      longitude,
      is_default,
      label,
      phone,
    } = req.body;

    // Input validation
    if (!address_line || !city || !state || !zip_code || !phone) {
      return res.status(400).json({
        success: false,
        message: "Address line, city, state, zip code, and phone number are required",
      });
    }

    // Create address
    const address = await Address.createAddress({
      user_id: userId,
      address_line,
      city,
      state,
      zip_code,
      country: country || "India",
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      is_default: is_default === true || is_default === "true",
      label,
      phone,
    });

    res.status(201).json({
      success: true,
      message: "Address created successfully",
      data: {
        address,
      },
    });
  } catch (error) {
    console.error("Create address error:", error);

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
 * @route   PUT /api/addresses/:id
 * @desc    Update address
 * @access  Private (customer only)
 */
router.put("/:id", authenticateToken, requireRole(["customer"]), async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Find address
    const address = await Address.findById(id);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // Verify address belongs to user
    if (address.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own addresses",
      });
    }

    // Prepare update data
    const updateData = { ...req.body };

    // Convert string booleans to actual booleans
    if (updateData.is_default === "true") {
      updateData.is_default = true;
    } else if (updateData.is_default === "false") {
      updateData.is_default = false;
    }

    // Convert latitude/longitude to numbers if provided
    if (updateData.latitude !== undefined) {
      updateData.latitude = updateData.latitude ? parseFloat(updateData.latitude) : null;
    }
    if (updateData.longitude !== undefined) {
      updateData.longitude = updateData.longitude ? parseFloat(updateData.longitude) : null;
    }

    // Update address
    const updatedAddress = await Address.updateAddress(id, updateData);

    res.status(200).json({
      success: true,
      message: "Address updated successfully",
      data: {
        address: updatedAddress,
      },
    });
  } catch (error) {
    console.error("Update address error:", error);

    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors.map((err) => err.message),
      });
    }

    if (error.message === "Address not found") {
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
 * @route   PUT /api/addresses/:id/set-default
 * @desc    Set address as default
 * @access  Private (customer only)
 */
router.put("/:id/set-default", authenticateToken, requireRole(["customer"]), async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Find address
    const address = await Address.findById(id);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // Verify address belongs to user
    if (address.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only set your own addresses as default",
      });
    }

    // Set as default
    const updatedAddress = await Address.setAsDefault(id);

    res.status(200).json({
      success: true,
      message: "Address set as default successfully",
      data: {
        address: updatedAddress,
      },
    });
  } catch (error) {
    console.error("Set default address error:", error);

    if (error.message === "Address not found") {
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
 * @route   DELETE /api/addresses/:id
 * @desc    Delete address
 * @access  Private (customer only)
 */
router.delete("/:id", authenticateToken, requireRole(["customer"]), async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Find address
    const address = await Address.findById(id);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // Verify address belongs to user
    if (address.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own addresses",
      });
    }

    // Check if address is being used in any orders
    const { Order } = require("../models");
    const ordersUsingAddress = await Order.count({
      where: { address_id: id },
    });

    if (ordersUsingAddress > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete address. It is being used in existing orders.",
      });
    }

    // Delete address
    await Address.deleteAddress(id);

    res.status(200).json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    console.error("Delete address error:", error);
    console.error("Error details:", error.stack);

    if (error.name === "SequelizeForeignKeyConstraintError") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete address. It is being used in existing orders.",
      });
    }

    if (error.message === "Address not found") {
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

module.exports = router;
