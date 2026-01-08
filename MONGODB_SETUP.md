# MongoDB Setup Instructions

## ✅ What's Been Created

1. **MongoDB Configuration** (`config/mongodb.js`)
   - Connection handling
   - Error handling and reconnection logic

2. **Notification Model** (`models/Notification.model.js`)
   - Complete schema with all fields
   - Indexes for performance
   - Static methods for common operations

3. **Notification Service** (`services/notification.service.js`)
   - Business logic for notifications
   - Helper functions for order status changes

4. **Server Integration** (`server.js`)
   - MongoDB connection initialized on server start

---

## 🔧 Setup Steps

### Step 1: Add MongoDB Connection String to `.env`

Add this line to your `backend/.env` file:

```env
# MongoDB Connection (replace <db_password> with your actual password)
MONGODB_URI=mongodb+srv://avdeeparneja12_db_user:<db_password>@cluster0.ixha5wz.mongodb.net/dineflow
```

**Important:**
- Replace `<db_password>` with your actual MongoDB Atlas password
- The database name `dineflow` is added at the end
- If you want a different database name, change `dineflow` to your preferred name

### Step 2: Verify MongoDB Atlas Settings

1. **Network Access**: Make sure your IP is whitelisted (or use `0.0.0.0/0` for development)
2. **Database User**: Verify the username `avdeeparneja12_db_user` exists and has proper permissions
3. **Password**: Make sure you're using the correct password

### Step 3: Test the Connection

Start your server:

```bash
cd backend
npm start
# or
npm run dev
```

You should see:
```
✅ Database connection established successfully
✅ MongoDB connected successfully
🚀 Server running on port 4000
```

If you see an error, check:
- Password is correct in `.env`
- IP is whitelisted in MongoDB Atlas
- Internet connection is active

---

## 📝 Example `.env` File

Your `.env` file should look something like this:

```env
# PostgreSQL
DB_NAME=dineflow
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_HOST=localhost
DB_PORT=5432

# MongoDB
MONGODB_URI=mongodb+srv://avdeeparneja12_db_user:YOUR_ACTUAL_PASSWORD@cluster0.ixha5wz.mongodb.net/dineflow

# JWT
JWT_SECRET=your_jwt_secret
```

---

## 🧪 Testing the Setup

Once the server starts successfully, you can test the notification system by:

1. **Check MongoDB Connection**: The server logs will show if MongoDB connected
2. **Create a Test Notification**: We'll add API endpoints next to test notifications

---

## ⚠️ Troubleshooting

### Error: "MONGODB_URI is not defined"
- Make sure `.env` file exists in the `backend` folder
- Make sure `MONGODB_URI` is spelled correctly
- Restart the server after adding to `.env`

### Error: "Authentication failed"
- Check your password is correct
- Make sure there are no extra spaces in the connection string
- Verify the username is correct

### Error: "Connection timeout"
- Check your IP is whitelisted in MongoDB Atlas
- Try using `0.0.0.0/0` for development (allows all IPs)
- Check your internet connection

### Error: "MongoServerError: bad auth"
- Password might be incorrect
- Username might be incorrect
- Check MongoDB Atlas dashboard for correct credentials

---

## ✅ Next Steps

Once MongoDB is connected:
1. ✅ Create notification API routes
2. ✅ Integrate with order system
3. ✅ Set up Socket.io for real-time notifications
4. ✅ Build frontend notification components

---

## 📚 Files Created

- `backend/config/mongodb.js` - MongoDB connection configuration
- `backend/models/Notification.model.js` - Notification schema and methods
- `backend/services/notification.service.js` - Notification business logic
- `backend/server.js` - Updated to initialize MongoDB

---

Ready to proceed once you've added the connection string to `.env`!
