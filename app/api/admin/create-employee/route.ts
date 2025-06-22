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

  } catch (error: any) {
    console.error('Employee creation error:', error);
    
    // Provide specific error messages based on the error type
    let errorMessage = 'Failed to create employee';
    let statusCode = 500;
    
    if (error.message) {
      // Use the specific error message from our improved error handling
      errorMessage = error.message;
      
      // Set appropriate status codes for different error types
      if (error.message.includes('already in use') || error.message.includes('Email address')) {
        statusCode = 409; // Conflict
      } else if (error.message.includes('password')) {
        statusCode = 400; // Bad Request
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
} 