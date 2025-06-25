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

    const { targetUserId, userId: selfServiceUserId, newPassword, bypassVerification } = await request.json();

    // Determine the target user ID - for self-service, use the current user's ID
    const userToUpdate = targetUserId || selfServiceUserId || userId;

    if (!userToUpdate || !newPassword) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Check if this is a self-service password reset
    const isSelfService = bypassVerification && userId === userToUpdate;
    
    if (!isSelfService) {
      // For admin resets, check if the current user is an admin
      const { clerkClient } = await import('@clerk/nextjs/server');
      const clerkClientInstance = await clerkClient();
      const user = await clerkClientInstance.users.getUser(userId);
      
      // Check if user is admin from their public metadata
      const publicMetadata = user.publicMetadata as { role?: string };
      const isAdmin = publicMetadata?.role === 'admin';

      if (!isAdmin) {
        return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
      }
    }

    // Reset the user's password in Clerk
    const client = await clerkClient();
    await client.users.updateUser(userToUpdate, {
      password: newPassword
    });

    return NextResponse.json({
      success: true,
      message: isSelfService ? 'Password updated successfully' : 'Password reset successfully'
    });

  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 