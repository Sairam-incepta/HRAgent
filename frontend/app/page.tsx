import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const user = await currentUser();
  
  if (user) {
    // Check user role from metadata or database
    // For now, redirect everyone to employee dashboard
    redirect("/dashboard");
  } else {
    // Redirect to sign-in if not logged in
    redirect("/sign-in");
  }
}
