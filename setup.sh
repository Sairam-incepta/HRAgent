#!/bin/bash

# SETUP SCRIPT - Run from inside HRAgent directory
# This script sets up the complete project structure

echo "🚀 Setting up HRAgent System..."
echo "📍 Working from: $(pwd)"

# Initialize frontend
echo "📦 Creating Next.js frontend..."
npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir --import-alias "@/*"

cd frontend

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
npm install @clerk/nextjs @supabase/supabase-js lucide-react framer-motion
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-slot
npm install clsx tailwind-merge class-variance-authority
npm install date-fns recharts svix
npm install -D @types/node

# Create environment file
cat > .env.local << 'EOL'
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
CLERK_WEBHOOK_SECRET=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# API
NEXT_PUBLIC_API_URL=http://localhost:8000

# OpenAI (for later)
OPENAI_API_KEY=
EOL

# Create frontend directories
echo "📁 Creating frontend structure..."
mkdir -p app/\(auth\)/sign-in
mkdir -p app/\(auth\)/change-password
mkdir -p app/\(employee\)/dashboard
mkdir -p app/\(employee\)/requests
mkdir -p app/\(admin\)/dashboard
mkdir -p app/\(admin\)/employees
mkdir -p app/\(admin\)/payroll
mkdir -p app/api/auth
mkdir -p app/api/webhooks/clerk

mkdir -p components/ui
mkdir -p components/layout
mkdir -p components/features/clock
mkdir -p components/features/chat
mkdir -p components/features/requests
mkdir -p components/auth

mkdir -p lib/api
mkdir -p lib/hooks
mkdir -p lib/utils

mkdir -p public/images
mkdir -p styles
mkdir -p types

echo "✅ Frontend structure created!"

# Go back to HRAgent root
cd ..

# Initialize backend
echo "🐍 Setting up Python backend..."
mkdir -p backend
cd backend

# Create virtual environment
echo "Creating Python virtual environment..."
python -m venv venv

# Create requirements.txt
cat > requirements.txt << 'EOL'
fastapi==0.104.1
uvicorn[standard]==0.24.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
supabase==2.0.3
openai==1.3.5
celery==5.3.4
redis==5.0.1
sendgrid==6.10.0
pydantic==2.5.0
pydantic-settings==2.1.0
python-dotenv==1.0.0
sqlalchemy==2.0.23
alembic==1.12.1
httpx==0.25.2
EOL

# Create .env file
cat > .env << 'EOL'
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_KEY=

# OpenAI
OPENAI_API_KEY=

# Email Service
SENDGRID_API_KEY=
FROM_EMAIL=noreply@hragent.com

# Redis
REDIS_URL=redis://localhost:6379

# Security
SECRET_KEY=your-secret-key-here
EOL

# Create backend structure
echo "📁 Creating backend structure..."
mkdir -p app/api/auth
mkdir -p app/api/employees
mkdir -p app/api/time_tracking
mkdir -p app/api/requests
mkdir -p app/api/chat
mkdir -p app/api/payroll
mkdir -p app/api/webhooks
mkdir -p app/core
mkdir -p app/models
mkdir -p app/schemas
mkdir -p app/services
mkdir -p app/utils
mkdir -p scripts

# Create __init__.py files
touch app/__init__.py
touch app/api/__init__.py
touch app/api/auth/__init__.py
touch app/api/employees/__init__.py
touch app/api/time_tracking/__init__.py
touch app/api/requests/__init__.py
touch app/api/chat/__init__.py
touch app/api/payroll/__init__.py
touch app/api/webhooks/__init__.py
touch app/core/__init__.py
touch app/models/__init__.py
touch app/schemas/__init__.py
touch app/services/__init__.py
touch app/utils/__init__.py

# Create run.py
cat > run.py << 'EOL'
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
EOL

echo "✅ Backend structure created!"

# Go back to HRAgent root
cd ..

# Create Docker Compose for local development
cat > docker-compose.yml << 'EOL'
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
EOL

# Update README if needed
if [ ! -f README.md ] || [ $(wc -l < README.md) -lt 10 ]; then
cat > README.md << 'EOL'
# HRAgent - HR Management System

An elegant HR management system with AI-powered chatbot for policy tracking and bonus management.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- Redis (via Docker)
- Supabase account
- Clerk account

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Backend Setup
```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

### Docker Services
```bash
docker-compose up -d
```

## 📁 Project Structure
```
HRAgent/
├── frontend/          # Next.js frontend
├── backend/           # FastAPI backend
└── docker-compose.yml # Local services
```

## 🔑 Environment Setup
1. Add your API keys to .env files
2. Configure webhook URLs in Clerk dashboard
3. Run database migrations in Supabase

## 📝 Features
- Employee time tracking
- AI-powered sales assistant
- Automated payroll generation
- Request management system
- Admin dashboard
EOL
fi

echo ""
echo "✅ HRAgent setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Copy the code files from the artifacts into the created directories"
echo "2. Add your API keys to both .env files:"
echo "   - frontend/.env.local"
echo "   - backend/.env"
echo "3. Activate Python venv: cd backend && source venv/bin/activate"
echo "4. Install Python deps: pip install -r requirements.txt"
echo "5. Run backend: python run.py"
echo "6. Run frontend: cd frontend && npm run dev"
echo ""
echo "📝 Don't forget to run the database migrations in Supabase!"