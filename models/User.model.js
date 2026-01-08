const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const bcrypt = require("bcrypt");

/**
 * User Model
 * 
 * Represents users in the system (customers, restaurant owners, and riders).
 * Handles authentication and user management operations.
 */
const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: {
          msg: "Please provide a valid email address",
        },
        notEmpty: {
          msg: "Email is required",
        },
      },
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Password is required",
        },
      },
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Name is required",
        },
        len: {
          args: [2, 255],
          msg: "Name must be between 2 and 255 characters",
        },
      },
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        len: {
          args: [10, 20],
          msg: "Phone number must be between 10 and 20 characters",
        },
      },
    },
    role: {
      type: DataTypes.ENUM("customer", "restaurant_owner", "rider"),
      allowNull: false,
      defaultValue: "customer",
      validate: {
        isIn: {
          args: [["customer", "restaurant_owner", "rider"]],
          msg: "Role must be customer, restaurant_owner, or rider",
        },
      },
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "users",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    hooks: {
      /**
       * Hash password before creating user
       */
      beforeCreate: async (user) => {
        if (user.password_hash && !user.password_hash.startsWith("$2")) {
          const saltRounds = 10;
          user.password_hash = await bcrypt.hash(user.password_hash, saltRounds);
        }
      },
      /**
       * Hash password before updating if it's changed
       */
      beforeUpdate: async (user) => {
        if (user.changed("password_hash") && !user.password_hash.startsWith("$2")) {
          const saltRounds = 10;
          user.password_hash = await bcrypt.hash(user.password_hash, saltRounds);
        }
      },
    },
  }
);

/**
 * Instance Methods
 */

/**
 * Compare plain password with hashed password
 * 
 * @param {string} plainPassword - Plain text password
 * @returns {Promise<boolean>} True if password matches
 */
User.prototype.comparePassword = async function (plainPassword) {
  return await bcrypt.compare(plainPassword, this.password_hash);
};

/**
 * Get user data without sensitive information
 * 
 * @returns {Object} User object without password_hash
 */
User.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.password_hash;
  return values;
};

/**
 * Static Methods
 */

/**
 * Find user by email
 * 
 * @param {string} email - User email
 * @returns {Promise<User|null>} User instance or null
 */
User.findByEmail = async function (email) {
  return await this.findOne({
    where: { email },
  });
};

/**
 * Find user by ID
 * 
 * @param {number} id - User ID
 * @returns {Promise<User|null>} User instance or null
 */
User.findById = async function (id) {
  return await this.findByPk(id);
};

/**
 * Check if email already exists
 * 
 * @param {string} email - Email to check
 * @returns {Promise<boolean>} True if email exists
 */
User.emailExists = async function (email) {
  const user = await this.findOne({
    where: { email },
    attributes: ["id"],
  });
  return user !== null;
};

/**  
 * Find users by role
 * 
 * @param {string} role - User role
 * @param {Object} options - Query options (limit, offset, etc.)
 * @returns {Promise<Array>} Array of user instances
 */
User.findByRole = async function (role, options = {}) {
  const { limit = 100, offset = 0, ...otherOptions } = options;
  
  return await this.findAll({
    where: {
      role,
      is_active: true,
      ...otherOptions.where,
    },
    limit,
    offset,
    order: [["created_at", "DESC"]],
  });
};

/**
 * Create user with password hashing
 * 
 * @param {Object} userData - User data
 * @param {string} userData.email - User email
 * @param {string} userData.password - Plain text password
 * @param {string} userData.name - User name
 * @param {string} [userData.phone] - User phone
 * @param {string} userData.role - User role
 * @returns {Promise<User>} Created user instance
 */
User.createUser = async function (userData) {
  const { password, ...rest } = userData;
  
  // Validate required fields
  if (!userData.email || !password || !userData.name || !userData.role) {
    throw new Error("Email, password, name, and role are required");
  }

  // Check if email exists
  const emailExists = await this.emailExists(userData.email);
  if (emailExists) {
    throw new Error("Email already exists");
  }

  // Create user (password will be hashed in beforeCreate hook)
  return await this.create({
    ...rest,
    password_hash: password, // Will be hashed in hook
  });
};

/**
 * Update user password
 * 
 * @param {number} userId - User ID
 * @param {string} newPassword - New plain text password
 * @returns {Promise<User>} Updated user instance
 */
User.updatePassword = async function (userId, newPassword) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters long");
  }

  const user = await this.findByPk(userId);
  if (!user) {
    throw new Error("User not found");
  }

  user.password_hash = newPassword; // Will be hashed in beforeUpdate hook
  await user.save();

  return user;
};

module.exports = User;
