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

    // Get user role
    const userRole = await getUserRole();
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { users } = await request.json();

    // Parse Users
    if (!users || !Array.isArray(users)) {
      return NextResponse.json({ error: 'Invalid users data' }, { status: 400 });
    }

    // Reduces risk of attacks
    if (users.length > 100) {
      return NextResponse.json({ 
        error: 'Cannot create more than 100 users at once. Please contact admin to raise the limit.' 
      }, { status: 400 });
    }

    if (users.length === 0) {
      return NextResponse.json({ error: 'No users provided' }, { status: 400 });
    }

    // Validate required fields for each user (rejects empty fields)
    const validUsers = users.filter(user => {

      const trimmedEmail = user.emailAddress?.trim().toLowerCase();

      const hasRequiredFields = user.firstName?.trim() &&
        user.lastName?.trim() &&
        trimmedEmail &&
        user.password?.trim() &&
        user.department?.trim() &&
        user.position?.trim();

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const hasValidEmail = emailRegex.test(trimmedEmail);

      return hasRequiredFields && hasValidEmail;
    });

    if (validUsers.length === 0) {
      return NextResponse.json({ error: 'No valid users found' }, { status: 400 });
    }

    // Process bulk creation
    const results = await bulkCreateClerkUsers(validUsers.map(user => ({
      firstName: user.firstName.trim(),
      lastName: user.lastName.trim(),
      emailAddress: user.emailAddress.trim().toLowerCase(),
      password: user.password.trim(),
      department: user.department.trim(),
      position: user.position.trim(),
      hourlyRate: parseFloat(user.hourlyRate) || 25.00,
      maxHoursBeforeOvertime: parseInt(user.maxHoursBeforeOvertime) || 8
    })));

    return NextResponse.json(results);

  } catch (error) {
    console.error('Bulk user creation error:', error);
    return NextResponse.json({ error: 'Failed to create users'}, { status: 500 });
  }
}