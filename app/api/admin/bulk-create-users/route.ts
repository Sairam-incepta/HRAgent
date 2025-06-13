import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { bulkCreateClerkUsers } from '@/lib/clerk-automation';

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin (you might want to implement proper admin check)
    // For now, we'll use the same admin check as elsewhere
    const isAdmin = userId === 'user_2y2ylH58JkmHljhJT0BXIfjHQui';
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
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