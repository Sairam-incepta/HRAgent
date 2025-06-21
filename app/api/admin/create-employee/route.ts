import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClerkUserAndEmployee } from '@/lib/clerk-automation';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const isAdmin = userId === 'user_2y2ylH58JkmHljhJT0BXIfjHQui';
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const employeeData = await request.json();

    const result = await createClerkUserAndEmployee(employeeData);

    return NextResponse.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('Employee creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create employee' },
      { status: 500 }
    );
  }
} 