"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { requireAdmin } from "~/lib/auth";

export async function setUserAsAdmin(userId: string, isAdmin: boolean) {
  // Ensure the current user is an admin
  await requireAdmin();
  
  // Update the user's metadata
  await clerkClient.users.updateUser(userId, {
    privateMetadata: {
      isAdmin
    }
  });
} 