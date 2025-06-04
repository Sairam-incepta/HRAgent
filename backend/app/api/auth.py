from fastapi import APIRouter, HTTPException, Depends
from app.schemas.auth import (
    CheckFirstLoginRequest, 
    UpdateFirstLoginRequest,
    SendOTPRequest,
    VerifyOTPRequest
)
from app.core.database import supabase
from app.services.email_service import send_otp_email
import random
import string
from datetime import datetime, timedelta

router = APIRouter()

@router.post("/check-first-login")
async def check_first_login(request: CheckFirstLoginRequest):
    """Check if user needs to change password on first login"""
    try:
        result = supabase.table('employees').select('first_login').eq('clerk_id', request.userId).single().execute()
        
        if result.data:
            return {"firstLogin": result.data['first_login']}
        else:
            # User not found - they might be logging in for the first time
            return {"firstLogin": True}
    except Exception as e:
        print(f"Error checking first login: {e}")
        raise HTTPException(status_code=500, detail="Failed to check first login status")

@router.post("/update-first-login")
async def update_first_login(request: UpdateFirstLoginRequest):
    """Update user's first login status after password change"""
    try:
        result = supabase.table('employees').update({
            'first_login': request.firstLogin
        }).eq('clerk_id', request.userId).execute()
        
        if result.data:
            return {"success": True}
        else:
            raise HTTPException(status_code=404, detail="User not found")
    except Exception as e:
        print(f"Error updating first login: {e}")
        raise HTTPException(status_code=500, detail="Failed to update first login status")

@router.post("/send-otp")
async def send_otp(request: SendOTPRequest):
    """Send OTP for password reset"""
    try:
        # Generate 6-digit OTP
        otp = ''.join(random.choices(string.digits, k=6))
        
        # Store OTP in database with expiration
        expiry = datetime.utcnow() + timedelta(minutes=10)
        
        supabase.table('password_resets').insert({
            'email': request.email,
            'otp': otp,
            'expires_at': expiry.isoformat(),
            'used': False
        }).execute()
        
        # Send email
        await send_otp_email(request.email, otp)
        
        return {"success": True, "message": "OTP sent to email"}
    except Exception as e:
        print(f"Error sending OTP: {e}")
        raise HTTPException(status_code=500, detail="Failed to send OTP")

@router.post("/verify-otp")
async def verify_otp(request: VerifyOTPRequest):
    """Verify OTP for password reset"""
    try:
        # Check if OTP exists and is valid
        result = supabase.table('password_resets').select('*').eq(
            'email', request.email
        ).eq('otp', request.otp).eq('used', False).execute()
        
        if not result.data:
            raise HTTPException(status_code=400, detail="Invalid OTP")
        
        reset_record = result.data[0]
        expires_at = datetime.fromisoformat(reset_record['expires_at'].replace('Z', '+00:00'))
        
        if expires_at < datetime.utcnow():
            raise HTTPException(status_code=400, detail="OTP expired")
        
        # Mark OTP as used
        supabase.table('password_resets').update({
            'used': True
        }).eq('id', reset_record['id']).execute()
        
        return {"success": True, "message": "OTP verified successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error verifying OTP: {e}")
        raise HTTPException(status_code=500, detail="Failed to verify OTP")

auth_router = router