import { clerkClient } from '@clerk/nextjs/server';
import { createEmployee } from './database';

export interface ClerkUserData {
  firstName: string;
  lastName: string;
  emailAddress: string;
  password: string;
  department: string;
  position: string;
  hourlyRate?: number;
  maxHoursBeforeOvertime?: number;
}

/**
 * Automatically creates a user in Clerk and adds them to the employee database
 */
export async function createClerkUserAndEmployee(userData: ClerkUserData) {
  try {
    // Create user in Clerk
    const client = await clerkClient();
    const clerkUser = await client.users.createUser({
      firstName: userData.firstName,
      lastName: userData.lastName,
      emailAddress: [userData.emailAddress],
      password: userData.password,
      publicMetadata: {
        department: userData.department,
        position: userData.position,
        role: 'employee'
      }
    });

    if (!clerkUser) {
      throw new Error('Failed to create user in Clerk');
    }

    // Create employee record in database
    const employee = await createEmployee({
      clerkUserId: clerkUser.id,
      name: `${userData.firstName} ${userData.lastName}`,
      email: userData.emailAddress,
      department: userData.department,
      position: userData.position,
      status: 'active',
      maxHoursBeforeOvertime: userData.maxHoursBeforeOvertime || 8,
      hourlyRate: userData.hourlyRate || 25.00
    });

    if (!employee) {
      // If employee creation fails, we should clean up the Clerk user
      await client.users.deleteUser(clerkUser.id);
      throw new Error('Failed to create employee record');
    }

    return {
      clerkUser,
      employee,
      success: true
    };

  } catch (error) {
    console.error('Error creating Clerk user and employee:', error);
    throw error;
  }
}

/**
 * Updates a Clerk user's metadata when employee information changes
 */
export async function updateClerkUserMetadata(clerkUserId: string, updates: {
  department?: string;
  position?: string;
  firstName?: string;
  lastName?: string;
  emailAddress?: string;
}) {
  try {
    const updateData: any = {};

    // Update basic info if provided
    if (updates.firstName) updateData.firstName = updates.firstName;
    if (updates.lastName) updateData.lastName = updates.lastName;
    if (updates.emailAddress) {
      updateData.emailAddress = [updates.emailAddress];
    }

    // Update public metadata
    if (updates.department || updates.position) {
      const client = await clerkClient();
      const currentUser = await client.users.getUser(clerkUserId);
      updateData.publicMetadata = {
        ...currentUser.publicMetadata,
        ...(updates.department && { department: updates.department }),
        ...(updates.position && { position: updates.position })
      };
    }

    const client2 = await clerkClient();
    const updatedUser = await client2.users.updateUser(clerkUserId, updateData);
    
    return {
      success: true,
      user: updatedUser
    };

  } catch (error) {
    console.error('Error updating Clerk user metadata:', error);
    throw error;
  }
}

/**
 * Deletes a user from Clerk (use with caution)
 */
export async function deleteClerkUser(clerkUserId: string) {
  try {
    const client = await clerkClient();
    await client.users.deleteUser(clerkUserId);
    return { success: true };
  } catch (error) {
    console.error('Error deleting Clerk user:', error);
    throw error;
  }
}

/**
 * Gets all Clerk users for admin purposes
 */
export async function getAllClerkUsers() {
  try {
    const client = await clerkClient();
    const users = await client.users.getUserList({
      limit: 100,
      orderBy: '-created_at'
    });
    
    return users;
  } catch (error) {
    console.error('Error fetching Clerk users:', error);
    throw error;
  }
}

/**
 * Bulk create multiple users (useful for initial setup)
 */
export async function bulkCreateClerkUsers(usersData: ClerkUserData[]) {
  const results = [];
  const errors = [];

  for (const userData of usersData) {
    try {
      const result = await createClerkUserAndEmployee(userData);
      results.push(result);
    } catch (error) {
      errors.push({
        userData,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return {
    successful: results,
    failed: errors,
    totalProcessed: usersData.length,
    successCount: results.length,
    errorCount: errors.length
  };
}