import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export async function requireAdmin() {
  const { userId } = auth();
  
  if (!userId) {
    redirect("/sign-in");
  }

  const user = await clerkClient.users.getUser(userId);
  
  if (user?.privateMetadata?.isAdmin !== true) {
    redirect("/"); // Redirect non-admins to home page
  }

  return user;
} 