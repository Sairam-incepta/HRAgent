from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr

class Employee(BaseModel):
    id: Optional[str] = None
    clerk_id: str
    email: EmailStr
    name: str
    employee_id: Optional[str] = None
    hourly_rate: Optional[float] = None
    role: str = "employee"
    first_login: bool = True
    created_at: Optional[datetime] = None

class EmployeeCreate(BaseModel):
    clerk_id: str
    email: EmailStr
    name: str
    employee_id: Optional[str] = None
    hourly_rate: Optional[float] = None
    role: str = "employee"