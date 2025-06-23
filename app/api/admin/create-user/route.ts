import { NextRequest, NextResponse } from 'next/server';
import { createClerkUserAndEmployee } from '@/lib/clerk-automation';
import { auth } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userData = await request.json();
    
    const result = await createClerkUserAndEmployee(userData);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in create-user API:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
} 