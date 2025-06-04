from fastapi import APIRouter, Request, HTTPException, Header
from typing import Optional
import hmac
import hashlib
import json
from app.core.database import supabase
from app.models.employee import EmployeeCreate

webhook_router = APIRouter()

@webhook_router.post("/clerk")
async def handle_clerk_webhook(
    request: Request,
    svix_id: Optional[str] = Header(None),
    svix_timestamp: Optional[str] = Header(None),
    svix_signature: Optional[str] = Header(None)
):
    """Handle Clerk webhook events"""
    # For now, we'll implement basic webhook handling
    # In production, verify the webhook signature
    
    payload = await request.json()
    event_type = payload.get("type")
    
    if event_type == "user.created":
        data = payload.get("data", {})
        
        # Create employee record
        employee = EmployeeCreate(
            clerk_id=data.get("id"),
            email=data.get("email_addresses", [{}])[0].get("email_address"),
            name=f"{data.get('first_name', '')} {data.get('last_name', '')}".strip() or "New Employee",
        )
        
        try:
            supabase.table('employees').insert(employee.dict()).execute()
        except Exception as e:
            print(f"Error creating employee: {e}")
            raise HTTPException(status_code=500, detail="Failed to create employee")
    
    return {"received": True}
