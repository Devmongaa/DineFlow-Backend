const { DataTypes, Op } = require("sequelize");
const { sequelize } = require("../config/database");

/**
 * Address Model
 * 
 * Represents delivery addresses for customers.
 * Each customer can have multiple addresses.
 * One address can be marked as default.
 */
const Address = sequelize.define(
  "Address",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
      validate: {
        notEmpty: {
          msg: "User ID is required",
        },
      },
    },
    address_line: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Address line is required",
        },
        len: {
          args: [5, 500],
          msg: "Address must be between 5 and 500 characters",
        },
      },
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "City is required",
        },
        len: {
          args: [2, 100],
          msg: "City must be between 2 and 100 characters",
        },
      },
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "State is required",
        },
        len: {
          args: [2, 100],
          msg: "State must be between 2 and 100 characters",
        },
      },
    },
    zip_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Zip code is required",
        },
        len: {
          args: [3, 20],
          msg: "Zip code must be between 3 and 20 characters",
        },
      },
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: "India",
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      validate: {
        min: {
          args: [-90],
          msg: "Latitude must be between -90 and 90",
        },
        max: {
          args: [90],
          msg: "Latitude must be between -90 and 90",
        },
      },
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
      validate: {
        min: {
          args: [-180],
          msg: "Longitude must be between -180 and 180",
        },
        max: {
          args: [180],
          msg: "Longitude must be between -180 and 180",
        },
      },
    },
    is_default: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    label: {
      type: DataTypes.STRING(50),
      allowNull: true,
      // Examples: "Home", "Work", "Office"
      validate: {
        len: {
          args: [0, 50],
          msg: "Label must be at most 50 characters",
        },
      },
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Phone number is required",
        },
        len: {
          args: [10, 20],
          msg: "Phone number must be between 10 and 20 characters",
        },
      },
    },
  },
  {
    tableName: "addresses",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

/**
 * Static Methods
 */

/**
 * Find address by ID
 * 
 * @param {number} id - Address ID
 * @returns {Promise<Address|null>} Address instance or null
 */
Address.findById = async function (id) {
  return await this.findByPk(id);
};

/**
 * Find all addresses for a user
 * 
 * @param {number} userId - User ID
 * @returns {Promise<Array>} Array of address instances
 */
Address.findByUser = async function (userId) {
  return await this.findAll({
    where: { user_id: userId },
    order: [
      ["is_default", "DESC"], // Default address first
      ["created_at", "DESC"],
    ],
  });
};

/**
 * Find default address for a user
 * 
 * @param {number} userId - User ID
 * @returns {Promise<Address|null>} Default address or null
 */
Address.findDefault = async function (userId) {
  return await this.findOne({
    where: {
      user_id: userId,
      is_default: true,
    },
  });
};

/**
 * Create address
 * 
 * @param {Object} addressData - Address data
 * @param {number} addressData.user_id - User ID
 * @param {string} addressData.address_line - Address line
 * @param {string} addressData.city - City
 * @returns {Promise<Address>} Created address instance
 */
Address.createAddress = async function (addressData) {
  if (!addressData.user_id || !addressData.address_line || !addressData.city || !addressData.state || !addressData.zip_code || !addressData.phone) {
    throw new Error("User ID, address line, city, state, zip code, and phone number are required");
  }

  // If this is set as default, unset other default addresses
  if (addressData.is_default) {
    await this.update(
      { is_default: false },
      {
        where: {
          user_id: addressData.user_id,
          is_default: true,
        },
      }
    );
  }

  return await this.create(addressData);
};

/**
 * Update address
 * 
 * @param {number} id - Address ID
 * @param {Object} updateData - Fields to update
 * @returns {Promise<Address>} Updated address instance
 */
Address.updateAddress = async function (id, updateData) {
  const address = await this.findByPk(id);

  if (!address) {
    throw new Error("Address not found");
  }

  // If setting as default, unset other default addresses
  if (updateData.is_default === true) {
    await this.update(
      { is_default: false },
      {
        where: {
          user_id: address.user_id,
          is_default: true,
          id: { [Op.ne]: id }, // Exclude current address
        },
      }
    );
  }

  await address.update(updateData);
  return address;
};

/**
 * Set address as default
 * 
 * @param {number} id - Address ID
 * @returns {Promise<Address>} Updated address instance
 */
Address.setAsDefault = async function (id) {
  const address = await this.findByPk(id);

  if (!address) {
    throw new Error("Address not found");
  }

  // Unset other default addresses
  await this.update(
    { is_default: false },
    {
      where: {
        user_id: address.user_id,
        is_default: true,
        id: { [require("sequelize").Op.ne]: id },
      },
    }
  );

  // Set this address as default
  address.is_default = true;
  await address.save();

  return address;
};

/**
 * Delete address
 * 
 * @param {number} id - Address ID
 * @returns {Promise<void>}
 */
Address.deleteAddress = async function (id) {
  const address = await this.findByPk(id);

  if (!address) {
    throw new Error("Address not found");
  }

  await address.destroy();
};

module.exports = Address;
