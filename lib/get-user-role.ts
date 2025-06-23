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

  const publicMetadata = sessionClaims?.publicMetadata as CustomPublicMetadata;
  
  // Use role from Clerk metadata instead of hardcoded user ID
  return publicMetadata?.role || "employee";
} 