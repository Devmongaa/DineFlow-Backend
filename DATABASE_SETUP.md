# Database Setup - MySQL

## ✅ Configuration Complete

The backend has been configured to use MySQL instead of PostgreSQL.

## 📋 Database Credentials

- **Host**: sql12.freesqldatabase.com
- **Database**: sql12813783
- **User**: sql12813783
- **Password**: SSZ6G5IYFM
- **Port**: 3306

## 🚀 Automatic Table Creation

When you start the backend server, it will automatically:
1. Connect to the MySQL database
2. Create all required tables (if they don't exist)
3. Set up all relationships and indexes

## 🏃 Starting the Server

```bash
cd backend
npm run dev
```

The server will:
- ✅ Test database connection
- ✅ Sync all models (create tables automatically)
- ✅ Connect to MongoDB (for notifications)
- ✅ Initialize Socket.io

## 📊 Tables Created Automatically

The following tables will be created when you start the server:
- `users` - User accounts (customers, restaurant owners, riders)
- `restaurants` - Restaurant information
- `menu_items` - Menu items for restaurants
- `carts` - Shopping carts
- `cart_items` - Items in shopping carts
- `addresses` - Delivery addresses
- `orders` - Customer orders
- `order_items` - Items in orders
- `reviews` - Restaurant reviews and ratings

## ⚠️ Important Notes

1. **First Run**: On the first run, all tables will be created automatically
2. **Data Safety**: The `syncModels()` function uses safe mode - it won't drop existing tables
3. **Production**: For production, consider using migrations instead of auto-sync

## 🔍 Verify Connection

To test the database connection manually:

```bash
cd backend
node -e "const { testConnection } = require('./config/database'); testConnection().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });"
```

## 📝 Environment Variables

All database configuration is in `.env`:
```
DB_NAME=sql12813783
DB_USER=sql12813783
DB_PASSWORD=SSZ6G5IYFM
DB_HOST=sql12.freesqldatabase.com
DB_PORT=3306
```

**Note**: Never commit `.env` file to Git. Use `.env.example` as a template.
