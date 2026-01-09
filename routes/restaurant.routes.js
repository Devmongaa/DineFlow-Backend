const express = require("express");
const router = express.Router();
const { Restaurant, User, MenuItem, sequelize } = require("../models");
const { authenticateToken, requireRole } = require("../middleware/auth.middleware");

/**
 * @route   GET /api/restaurants
 * @desc    List all active restaurants (with city and cuisine filtering)
 * @access  Public
 * 
 * Query Parameters:
 * - city: Filter by city name (case-insensitive)
 * - cuisine_type: Filter by cuisine type
 * - limit: Number of results (default: 50)
 * - offset: Pagination offset (default: 0)
 */
router.get("/", async (req, res) => {
  try {
    const { city, cuisine_type, min_rating, limit = 50, offset = 0 } = req.query;

    const restaurants = await Restaurant.findActive({
      city,
      cuisine_type,
      min_rating: min_rating ? parseFloat(min_rating) : undefined,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.status(200).json({
      success: true,
      message: "Restaurants retrieved successfully",
      data: {
        restaurants,
        count: restaurants.length,
        filters: {
          city: city || null,
          cuisine_type: cuisine_type || null,
        },
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      },
    });
  } catch (error) {
    console.error("Get restaurants error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   GET /api/restaurants/search
 * @desc    Search restaurants and menu items by query
 * @access  Public
 * 
 * Query Parameters:
 * - q: Search query (searches in restaurant name, description, cuisine_type, and menu item names)
 * - city: Optional city filter
 * - limit: Number of results (default: 20)
 */
router.get("/search", async (req, res) => {
  try {
    const { q, city, limit = 20 } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const searchQuery = q.trim();
    const { Op } = require("sequelize");
    const { sequelize } = require("../models");

    // Search restaurants by name, description, or cuisine_type
    // MySQL compatible case-insensitive search
    const restaurantWhere = {
      is_active: true,
      is_accepting_orders: true,
      [Op.or]: [
        sequelize.where(sequelize.fn('LOWER', sequelize.col('Restaurant.name')), 'LIKE', `%${searchQuery.toLowerCase()}%`),
        sequelize.where(sequelize.fn('LOWER', sequelize.col('Restaurant.description')), 'LIKE', `%${searchQuery.toLowerCase()}%`),
        sequelize.where(sequelize.fn('LOWER', sequelize.col('Restaurant.cuisine_type')), 'LIKE', `%${searchQuery.toLowerCase()}%`),
      ],
    };

    if (city) {
      restaurantWhere.city = sequelize.where(sequelize.fn('LOWER', sequelize.col('Restaurant.city')), sequelize.fn('LOWER', city));
    }

    const restaurants = await Restaurant.findAll({
      where: restaurantWhere,
      limit: parseInt(limit),
      order: [["average_rating", "DESC"], ["created_at", "DESC"]],
    });

    // Search menu items by name or description
    // First get restaurant IDs that are active (and optionally filtered by city)
    const activeRestaurantWhere = {
      is_active: true,
      is_accepting_orders: true,
    };
    
    if (city) {
      activeRestaurantWhere.city = sequelize.where(sequelize.fn('LOWER', sequelize.col('Restaurant.city')), sequelize.fn('LOWER', city));
    }
    
    const activeRestaurants = await Restaurant.findAll({
      where: activeRestaurantWhere,
      attributes: ["id"],
    });
    const activeRestaurantIds = activeRestaurants.map(r => r.id);

    // Search menu items - prioritize name and category matches over description
    // Escape single quotes in search query for SQL safety
    const escapedQuery = searchQuery.replace(/'/g, "''");
    
    const menuItems = activeRestaurantIds.length > 0 ? await MenuItem.findAll({
      where: {
        is_available: true,
        restaurant_id: { [Op.in]: activeRestaurantIds },
        [Op.or]: [
          // Prioritize name matches (most relevant) - MySQL compatible
          sequelize.where(sequelize.fn('LOWER', sequelize.col('MenuItem.name')), 'LIKE', `%${searchQuery.toLowerCase()}%`),
          // Also search by category (e.g., "Pizza" category when searching "pizza")
          sequelize.where(sequelize.fn('LOWER', sequelize.col('MenuItem.category')), 'LIKE', `%${searchQuery.toLowerCase()}%`),
          // Description matches only if name/category don't match (less relevant)
          sequelize.where(sequelize.fn('LOWER', sequelize.col('MenuItem.description')), 'LIKE', `%${searchQuery.toLowerCase()}%`),
        ],
      },
      include: [
        {
          model: Restaurant,
          as: "restaurant",
          attributes: ["id", "name", "city"],
        },
      ],
      limit: parseInt(limit),
      // Order by relevance: name matches first, then category, then description (MySQL compatible)
      order: [
        // Prioritize items where name contains the search term
        [sequelize.literal(`CASE WHEN LOWER(MenuItem.name) LIKE '%${escapedQuery.toLowerCase()}%' THEN 0 ELSE 1 END`), 'ASC'],
        // Then prioritize items where category matches
        [sequelize.literal(`CASE WHEN LOWER(MenuItem.category) LIKE '%${escapedQuery.toLowerCase()}%' THEN 0 ELSE 1 END`), 'ASC'],
        // Finally, order by name
        ["name", "ASC"],
      ],
    }) : [];

    res.status(200).json({
      success: true,
      message: "Search completed successfully",
      data: {
        query: searchQuery,
        restaurants: restaurants || [],
        menu_items: menuItems || [],
        counts: {
          restaurants: restaurants.length,
          menu_items: menuItems.length,
        },
      },
    });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   GET /api/restaurants/cities
 * @desc    Get all available cities where restaurants exist
 * @access  Public
 */
router.get("/cities", async (req, res) => {
  try {
    const cities = await Restaurant.getAvailableCities();

    res.status(200).json({
      success: true,
      message: "Cities retrieved successfully",
      data: {
        cities,
        count: cities.length,
      },
    });
  } catch (error) {
    console.error("Get cities error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   GET /api/restaurants/owner/my-restaurants
 * @desc    Get all restaurants owned by current user
 * @access  Private (restaurant_owner)
 */
router.get("/owner/my-restaurants", authenticateToken, requireRole(["restaurant_owner"]), async (req, res) => {
  try {
    const restaurants = await Restaurant.findByOwner(req.user.id);

    res.status(200).json({
      success: true,
      message: "Restaurants retrieved successfully",
      data: {
        restaurants,
        count: restaurants.length,
      },
    });
  } catch (error) {
    console.error("Get owner restaurants error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   GET /api/restaurants/:restaurantId/menu
 * @desc    Get all menu items for a restaurant (grouped by category)
 * @access  Public
 */
router.get("/:restaurantId/menu", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { category, is_available } = req.query;

    // Check if restaurant exists and is active
    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant || !restaurant.is_active) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    // Get menu items
    // By default, only show available items to customers
    // Restaurant owners can use is_available query param to see all items
    const options = {};
    if (category) options.category = category;
    if (is_available !== undefined) {
      options.is_available = is_available === "true";
    } else {
      // Default: only show available items to customers
      options.is_available = true;
    }

    const menuItems = await MenuItem.findByRestaurant(restaurantId, options);

    // Group by category
    const menuByCategory = {};
    menuItems.forEach((item) => {
      const category = item.category;
      if (!menuByCategory[category]) {
        menuByCategory[category] = [];
      }
      menuByCategory[category].push(item);
    });

    // Get all categories
    const categories = await MenuItem.getCategories(restaurantId);

    res.status(200).json({
      success: true,
      message: "Menu retrieved successfully",
      data: {
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
        },
        menu: menuByCategory,
        categories,
        totalItems: menuItems.length,
      },
    });
  } catch (error) {
    console.error("Get menu error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   POST /api/restaurants/:restaurantId/menu-items
 * @desc    Create a new menu item (restaurant owner only, must own restaurant)
 * @access  Private (restaurant_owner)
 */
router.post("/:restaurantId/menu-items", authenticateToken, requireRole(["restaurant_owner"]), async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { name, description, price, category, image_url, preparation_time } = req.body;

    // Input validation
    if (!name || !price || !category) {
      return res.status(400).json({
        success: false,
        message: "Name, price, and category are required",
      });
    }

    // Check if restaurant exists
    const restaurant = await Restaurant.findById(restaurantId);

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
        message: "You can only add menu items to your own restaurants",
      });
    }

    // Create menu item
    const menuItem = await MenuItem.createMenuItem({
      restaurant_id: parseInt(restaurantId),
      name,
      description,
      price: parseFloat(price),
      category,
      image_url,
      preparation_time: preparation_time ? parseInt(preparation_time) : null,
    });

    res.status(201).json({
      success: true,
      message: "Menu item created successfully",
      data: {
        menuItem,
      },
    });
  } catch (error) {
    console.error("Create menu item error:", error);

    // Handle Sequelize validation errors
    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors.map((err) => err.message),
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error during menu item creation",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   GET /api/restaurants/:id
 * @desc    Get restaurant details by ID
 * @access  Public
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const restaurant = await Restaurant.findById(id);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    if (!restaurant.is_active) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Restaurant retrieved successfully",
      data: {
        restaurant,
      },
    });
  } catch (error) {
    console.error("Get restaurant error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   POST /api/restaurants
 * @desc    Create a new restaurant (restaurant owner only)
 * @access  Private (restaurant_owner)
 */
router.post("/", authenticateToken, requireRole(["restaurant_owner"]), async (req, res) => {
  try {
    const {
      name,
      description,
      cuisine_type,
      address,
      city,
      state,
      zip_code,
      phone,
      email,
      latitude,
      longitude,
      opening_time,
      closing_time,
      image_url,
    } = req.body;

    // Input validation
    if (!name || !address || !city) {
      return res.status(400).json({
        success: false,
        message: "Name, address, and city are required",
      });
    }

    // Check if user already has a restaurant (optional - can allow multiple)
    // For now, we'll allow multiple restaurants per owner

    // Create restaurant
    const restaurant = await Restaurant.createRestaurant({
      owner_id: req.user.id,
      name,
      description,
      cuisine_type,
      address,
      city,
      state,
      zip_code,
      phone,
      email,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      opening_time,
      closing_time,
      image_url,
    });

    res.status(201).json({
      success: true,
      message: "Restaurant created successfully",
      data: {
        restaurant,
      },
    });
  } catch (error) {
    console.error("Create restaurant error:", error);

    // Handle Sequelize validation errors
    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors.map((err) => err.message),
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error during restaurant creation",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   PUT /api/restaurants/:id
 * @desc    Update restaurant details (restaurant owner only, must own restaurant)
 * @access  Private (restaurant_owner)
 */
router.put("/:id", authenticateToken, requireRole(["restaurant_owner"]), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      cuisine_type,
      address,
      city,
      state,
      zip_code,
      phone,
      email,
      latitude,
      longitude,
      opening_time,
      closing_time,
      image_url,
    } = req.body;

    // Find restaurant
    const restaurant = await Restaurant.findById(id);

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
        message: "You can only update your own restaurants",
      });
    }

    // Prepare update data (only include provided fields)
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (cuisine_type !== undefined) updateData.cuisine_type = cuisine_type;
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (zip_code !== undefined) updateData.zip_code = zip_code;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (latitude !== undefined) updateData.latitude = latitude ? parseFloat(latitude) : null;
    if (longitude !== undefined) updateData.longitude = longitude ? parseFloat(longitude) : null;
    if (opening_time !== undefined) updateData.opening_time = opening_time;
    if (closing_time !== undefined) updateData.closing_time = closing_time;
    if (image_url !== undefined) updateData.image_url = image_url;

    // Update restaurant
    const updatedRestaurant = await Restaurant.updateRestaurant(id, updateData);

    res.status(200).json({
      success: true,
      message: "Restaurant updated successfully",
      data: {
        restaurant: updatedRestaurant,
      },
    });
  } catch (error) {
    console.error("Update restaurant error:", error);

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
 * @route   DELETE /api/restaurants/:id
 * @desc    Delete restaurant (restaurant owner only, must own restaurant)
 * @access  Private (restaurant_owner)
 */
router.delete("/:id", authenticateToken, requireRole(["restaurant_owner"]), async (req, res) => {
  try {
    const { id } = req.params;

    // Find restaurant
    const restaurant = await Restaurant.findById(id);

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
        message: "You can only delete your own restaurants",
      });
    }

    // Soft delete (set is_active to false)
    await restaurant.update({ is_active: false, is_accepting_orders: false });

    res.status(200).json({
      success: true,
      message: "Restaurant deleted successfully",
    });
  } catch (error) {
    console.error("Delete restaurant error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
