/**
 * Database Connection Test Script
 * 
 * Run this script to test database connection and create tables
 * Usage: node scripts/test-db.js
 */

require("dotenv").config();
const { sequelize, testConnection } = require("../config/database");
const { User, syncModels } = require("../models");

async function testDatabase() {
  try {
    console.log("🔄 Testing database connection...");
    
    // Test connection
    await testConnection();
    
    console.log("\n🔄 Synchronizing models with database...");
    console.log("⚠️  This will create tables if they don't exist...\n");
    
    // Sync models (create tables)
    await syncModels({ alter: false }); // Set to { force: true } to drop and recreate (DANGEROUS!)
    
    console.log("\n✅ Database setup complete!");
    console.log("\n📊 Testing User model...");
    
    // Test User model - Check if email exists
    const testEmail = "test@example.com";
    const emailExists = await User.emailExists(testEmail);
    console.log(`Email "${testEmail}" exists: ${emailExists}`);
    
    // Test creating a user (optional - uncomment to test)
    /*
    console.log("\n🧪 Creating test user...");
    const testUser = await User.createUser({
      email: "test@example.com",
      password: "test123456",
      name: "Test User",
      phone: "1234567890",
      role: "customer"
    });
    console.log("✅ Test user created:", testUser.toJSON());
    
    // Test finding user
    const foundUser = await User.findByEmail("test@example.com");
    console.log("✅ User found:", foundUser.toJSON());
    
    // Test password verification
    const isValid = await foundUser.comparePassword("test123456");
    console.log("✅ Password verification:", isValid);
    */
    
    console.log("\n✅ All tests passed!");
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log("\n🔌 Database connection closed");
  }
}

// Run the test
testDatabase();
