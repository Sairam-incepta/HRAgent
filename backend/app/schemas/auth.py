from pydantic import BaseModel

class CheckFirstLoginRequest(BaseModel):
    userId: str

class UpdateFirstLoginRequest(BaseModel):
    userId: str
    firstLogin: bool

class SendOTPRequest(BaseModel):
    email: str

class VerifyOTPRequest(BaseModel):
    email: str
    otp: str