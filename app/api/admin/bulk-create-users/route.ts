import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { bulkCreateClerkUsers } from '@/lib/clerk-automation';
import { getUserRole } from '@/lib/get-user-role';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from Clerk directly to access metadata
    const { clerkClient } = await import('@clerk/nextjs/server');
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    
    // Check if user is admin from their public metadata
    const publicMetadata = user.publicMetadata as { role?: string };
    const isAdmin = publicMetadata?.role === 'admin';

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { users } = await request.json();

    if (!users || !Array.isArray(users)) {
      return NextResponse.json(
        { error: 'Invalid users data' },
        { status: 400 }
      );
    }

    // Validate required fields for each user
    const validUsers = users.filter(user => 
      user.firstName && 
      user.lastName && 
      user.emailAddress && 
      user.password && 
      user.department && 
      user.position
    );

    if (validUsers.length === 0) {
      return NextResponse.json(
        { error: 'No valid users found' },
        { status: 400 }
      );
    }

    // Process bulk creation
    const results = await bulkCreateClerkUsers(validUsers.map(user => ({
      firstName: user.firstName,
      lastName: user.lastName,
      emailAddress: user.emailAddress,
      password: user.password,
      department: user.department,
      position: user.position,
      hourlyRate: parseFloat(user.hourlyRate) || 25.00,
      maxHoursBeforeOvertime: parseInt(user.maxHoursBeforeOvertime) || 8
    })));

    return NextResponse.json(results);

  } catch (error) {
    console.error('Bulk user creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create users' },
      { status: 500 }
    );
  }
}