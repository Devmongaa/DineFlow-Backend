const express = require("express");
const http = require("http");
const cors = require("cors");
require("dotenv").config();

const { testConnection } = require("./config/database");
const { connectMongoDB } = require("./config/mongodb");
const { initializeSocket } = require("./config/socket");
const authRoutes = require("./routes/auth.routes");
const restaurantRoutes = require("./routes/restaurant.routes");
const menuRoutes = require("./routes/menu.routes");
const cartRoutes = require("./routes/cart.routes");
const addressRoutes = require("./routes/address.routes");
const orderRoutes = require("./routes/order.routes");
const notificationRoutes = require("./routes/notification.routes");
const riderRoutes = require("./routes/rider.routes");
const reviewRoutes = require("./routes/review.routes");
const { syncModels } = require("./models");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend running successfully");
});

const PORT = 4000;

app.use("/api/auth", authRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api", menuRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/rider", riderRoutes);
app.use("/api/reviews", reviewRoutes);

// Initialize database connection
// testConnection().then(() => {
//   app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
//   });
// }).catch((error) => {
//   console.error("Failed to start server:", error);
//   process.exit(1);
// });


(async () => {
  try {
    await testConnection();        // 1️⃣ Test MySQL connection
    await syncModels();            // 2️⃣ Sync all models → CREATE TABLES
    
    // Initialize MongoDB connection (for notifications)
    if (process.env.MONGODB_URI) {
      await connectMongoDB();     // 3️⃣ Connect to MongoDB
    } else {
      console.log("⚠️  MONGODB_URI not set - notifications will be disabled");
    }

    // Initialize Socket.io
    initializeSocket(server);      // 4️⃣ Initialize Socket.io for real-time updates
    console.log("🔌 Socket.io initialized");

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Socket.io ready for real-time connections`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
})();