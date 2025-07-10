import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClerkUserAndEmployee } from '@/lib/clerk-automation';
import { getUserRole } from '@/lib/get-user-role';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use the getUserRole function
    const userRole = await getUserRole();
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const employeeData = await request.json();

    // VALIDATION
    // Input validation
    if (!employeeData.firstName || !employeeData.lastName || !employeeData.emailAddress) {
      return NextResponse.json({ error: 'Missing required fields: firstName, lastName, emailAddress' }, { status: 400 });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(employeeData.emailAddress)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Clean input data
    const cleanedEmployeeData = {
      firstName: employeeData.firstName.trim(),
      lastName: employeeData.lastName.trim(),
      emailAddress: employeeData.emailAddress.trim().toLowerCase(),
      password: employeeData.password?.trim() || 'TempPass123!',
      department: employeeData.department?.trim() || '',
      position: employeeData.position?.trim() || '',
      hourlyRate: parseFloat(employeeData.hourlyRate) || 25.00,
      maxHoursBeforeOvertime: parseInt(employeeData.maxHoursBeforeOvertime) || 8
    };

    const result = await createClerkUserAndEmployee(cleanedEmployeeData);

    return NextResponse.json({success: true, result});

  } 
  catch (error: any) {
    console.error('Employee creation error:', error);
    
    let errorMessage = 'Failed to create employee';
    let statusCode = 500;
    
    if (error.message) {
      errorMessage = error.message;
      
      if (error.message.includes('already in use') || error.message.includes('Email address')) {
        statusCode = 409; // Conflict
      } else if (error.message.includes('password')) {
        statusCode = 400; // Bad Request
      }
    }
    
    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
} 