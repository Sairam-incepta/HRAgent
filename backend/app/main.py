from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

from app.api.auth import auth_router
from app.core.config import settings

# Load environment variables
load_dotenv()

app = FastAPI(
    title="HR Bot API",
    description="API for HR Bot System",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])

@app.get("/")
async def root():
    return {"message": "HR Bot API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}