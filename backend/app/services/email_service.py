import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from app.core.config import settings

async def send_otp_email(email: str, otp: str):
    """Send OTP email using SendGrid"""
    if not settings.SENDGRID_API_KEY:
        # For development, just print the OTP
        print(f"OTP for {email}: {otp}")
        return
    
    message = Mail(
        from_email=settings.FROM_EMAIL,
        to_emails=email,
        subject='Your HR Bot Password Reset Code',
        html_content=f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">Password Reset Code</h2>
            <p>You requested a password reset for your HR Bot account.</p>
            <p>Your verification code is:</p>
            <h1 style="color: #4F46E5; font-size: 32px; letter-spacing: 5px;">{otp}</h1>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <hr style="border: 1px solid #e5e5e5; margin: 20px 0;">
            <p style="color: #666; font-size: 14px;">HR Bot System</p>
        </div>
        """
    )
    
    try:
        sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
        response = sg.send(message)
        print(f"Email sent to {email}, status: {response.status_code}")
    except Exception as e:
        print(f"Error sending email: {e}")
        raise