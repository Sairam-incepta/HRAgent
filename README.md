# HR Bot System

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
uvicorn app.main:app --reload
```

### Docker Services
```bash
docker-compose up -d
```

## 📁 Project Structure
```
hr-bot-system/
├── frontend/          # Next.js frontend
├── backend/           # FastAPI backend
└── docker-compose.yml # Local services
```

## 🔑 Environment Setup
1. Copy `.env.example` to `.env` in both frontend and backend
2. Add your API keys from Clerk, Supabase, and OpenAI
3. Configure webhook URLs in Clerk dashboard

## 🌳 Git Workflow
- `main` - Production branch
- `develop` - Development branch
- `feature/*` - Feature branches
- `hotfix/*` - Critical fixes

## 📝 Commit Convention
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Code style
- `refactor:` Code refactoring
- `test:` Tests
- `chore:` Maintenance
