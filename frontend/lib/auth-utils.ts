import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export type UserRole = 'admin' | 'employee';

export async function checkUserRole(): Promise<UserRole> {
  const user = await currentUser();
  
  if (!user) {
    redirect("/sign-in");
  }

  // Check from Clerk public metadata (we'll set this up)
  const role = user.publicMetadata?.role as UserRole;
  
  // Default to employee if no role set
  return role || 'employee';
}

export async function requireAuth(requiredRole?: UserRole) {
  const user = await currentUser();
  
  if (!user) {
    redirect("/sign-in");
  }

  const userRole = await checkUserRole();
  
  // If a specific role is required and user doesn't have it
  if (requiredRole && userRole !== requiredRole) {
    redirect("/unauthorized");
  }

  return { user, role: userRole };
}