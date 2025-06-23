import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClerkUserAndEmployee } from '@/lib/clerk-automation';
import { getUserRole } from '@/lib/get-user-role';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId, sessionClaims } = await auth();
    
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

    console.log('🔍 Server-side Admin Check:', {
      userId,
      publicMetadata,
      isAdmin
    });

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
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