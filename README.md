# 🏢 LetsInsure HR Agent

HR management system for insurance companies with AI chat, time tracking, and employee management.

## 🚀 How to Run

### 1. Install Dependencies
```bash
npm install
```

### 2. API Keys Setup
Your `.env.local` file is already configured with:
- Clerk authentication keys ✅
- Supabase database URL & key ✅  
- OpenAI API key ✅

### 3. Database Setup
- Create Supabase project
- Run migration files from `supabase/migrations/` folder

### 4. Authentication Setup  
- Create Clerk app
- Set redirect URLs to `localhost:3000`

### 5. Start Development
```bash
npm run dev -- -p 8000
```

Visit `http://localhost:8000`

## 👥 Users

**Admin:** `admin@letsinsure.hr` (full access)  
**Employee:** Any other user (own data only)

## ✨ Features

**Employees:**
- Time tracking with overtime alerts
- AI chat for policy entry
- Performance dashboard
- Request submissions

**Admins:**
- Employee management
- Payroll reports
- Company analytics
- Approve requests

## 🔧 Tech Stack

- **Frontend:** Next.js 14, React, TypeScript
- **Database:** Supabase (PostgreSQL)
- **Auth:** Clerk
- **AI:** OpenAI GPT-4.1
- **UI:** Tailwind CSS + shadcn/ui

## 📊 Database

7 tables: employees, policy_sales, bonuses, reviews, summaries, chat_states, overtime_requests

## 🤖 AI Features

Smart data extraction for:
- Policy numbers (POL-2025-001)
- Money amounts ($1,200)
- Ratings (1-5 stars)
- Work hours (8.5 hours)

## 💰 Bonus System

- 10% of broker fees over $100
- Double bonus for cross-sells
- $10 for life insurance referrals
- $10 for 5-star reviews

## 📱 Mobile Ready

Responsive design works on all devices.

## 🚀 Deploy

Works on Vercel. Add environment variables to dashboard.

---

**Detailed docs:** See `PROJECT_ARCHITECTURE.md` # Updated Mon Jun 23 17:38:06 EDT 2025
