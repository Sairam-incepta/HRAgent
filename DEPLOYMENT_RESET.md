# 🚀 Database Reset for Deployment

This guide helps you reset the database to a clean state for deployment with only `salar@letsinsure.org` as the admin user.

## 📋 What This Reset Does

✅ **Clears all existing data:**
- All policy sales
- All client reviews  
- All daily summaries
- All time logs
- All requests and overtime requests
- All chat messages and conversation states
- All employee bonuses and bonus events
- All password reset tokens
- All high-value policy notifications

✅ **Removes all employees except:** `salar@letsinsure.org`

✅ **Sets up admin user:**
- Name: `Salar Admin`
- Email: `salar@letsinsure.org`
- Department: `Administration`
- Position: `Administrator`
- Role: `admin`
- Status: `active`
- Hourly Rate: `$50.00`
- Max Hours Before Overtime: `40`

✅ **Resets all database sequences** to start fresh

✅ **Ensures proper database structure** with all required columns

## 🛠️ How to Run the Reset

### Option 1: Using the Simple Node.js Script (Recommended)

```bash
# Uses regular Supabase client - works with standard .env.local
npm run reset-db-simple
```

### Option 2: Using the Service Role Script (If you have service role key)

```bash
# Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
npm run reset-db
```

### Option 3: Using SQL Directly

If you prefer to run the SQL directly in your Supabase dashboard:

1. Open your Supabase project dashboard
2. Go to the SQL Editor
3. Copy and paste the contents of `reset_database_for_deployment.sql`
4. Execute the script

## 🔧 Prerequisites

Make sure your `.env.local` file contains:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
# Optional: Only needed for full service role script
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## ⚠️ Important Notes

- **This action is irreversible** - all existing data will be permanently deleted
- **Backup your data first** if you need to preserve anything
- **Only run this on your development/staging environment** before deploying
- The script will create the admin user if it doesn't exist, or update it if it does

## 🔍 Verification

After running the reset, the script will show:

1. **Admin user details** - confirming `salar@letsinsure.org` is set up correctly
2. **Table record counts** - showing all tables are empty except employees (1 record)

## 📁 Files Created

- `reset_database_for_deployment.sql` - The SQL script for database reset
- `scripts/reset-database.js` - Node.js script to execute the reset
- `DEPLOYMENT_RESET.md` - This documentation

## 🎯 Ready for Deployment

After running this reset:

1. Your database will be clean and ready for production
2. Only `salar@letsinsure.org` will have admin access
3. All sequences will start from 1 for new data
4. The application will work exactly as designed for new users

## 🆘 Troubleshooting

If you encounter issues:

1. **Check environment variables** - Make sure `.env.local` has correct Supabase credentials
2. **Check Supabase permissions** - Ensure the service role key has necessary permissions
3. **Check database connection** - Verify you can connect to Supabase from your environment
4. **Manual execution** - Try running the SQL directly in Supabase dashboard if the script fails

## 🔄 After Deployment

Once deployed, you can:

1. Sign in as `salar@letsinsure.org` with admin privileges
2. Create new employees through the admin dashboard
3. Start fresh with clean data
4. All features will work as expected 