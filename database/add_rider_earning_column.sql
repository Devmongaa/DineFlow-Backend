-- Migration: Add rider_earning column to orders table
-- Run this script to add the rider_earning column for tracking rider earnings

-- Add rider_earning column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS rider_earning DECIMAL(10, 2) NULL;

-- Add comment for documentation
COMMENT ON COLUMN orders.rider_earning IS 'Rider earning calculated when order is delivered (80% of delivery fee)';

-- Verify column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'orders' AND column_name = 'rider_earning';
