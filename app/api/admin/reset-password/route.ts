import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';
import { getUserRole } from '@/lib/get-user-role';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { targetUserId, newPassword } = await request.json();

    // Input validation
    if (!newPassword) {
      return NextResponse.json({ error: 'Missing required field: newPassword' }, { status: 400 });
    }

    // Password strength validation
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
    }

    // Determine operation type (admin or employee)
    const isSelfReset = !targetUserId || targetUserId === userId;
    const userToUpdate = isSelfReset ? userId : targetUserId;

    if (!isSelfReset) {
      const userRole = await getUserRole();
      if (userRole !== 'admin') {
        return NextResponse.json({ error: 'Forbidden - Only admins can reset other users passwords' }, { status: 403 });
      }
    }

    // Reset the password in Clerk
    const client = await clerkClient();
    await client.users.updateUser(userToUpdate, {
      password: newPassword
    });

    return NextResponse.json({
      success: true,
      message: isSelfReset 
        ? 'Your password has been updated successfully' 
        : 'User password has been reset successfully'
    });

  } 
  catch (error:any) {
    console.error('Password reset error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}