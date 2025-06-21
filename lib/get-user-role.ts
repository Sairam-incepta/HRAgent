import { auth } from "@clerk/nextjs/server";

type UserRole = "admin" | "employee";

interface CustomPublicMetadata {
  role?: UserRole;
}

export async function getUserRole(): Promise<UserRole> {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return "employee"; // Default or handle as unauthenticated
  }

  const publicMetadata = sessionClaims?.publicMetadata as CustomPublicMetadata | undefined;

  // Check custom claims from Clerk token first
  if (publicMetadata?.role === 'admin') {
    return 'admin';
  }
  
  // Fallback check for specific user IDs if needed (e.g., for system admin)
  const adminIds = ['user_2y2ylH58JkmHljhJT0BXIfjHQui'];
  if (adminIds.includes(userId)) {
    return 'admin';
  }

  // Default to employee
  return "employee";
} 