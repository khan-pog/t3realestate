"use client";

import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { SimpleUploadButton } from "./simple-upload-button";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";

export function TopNav() {
  const { user, isLoaded } = useUser();
  const isAdmin = user?.publicMetadata?.isAdmin === true;

  return (
    <nav className="flex w-full items-center justify-between border-b bg-white p-4 text-xl font-semibold dark:bg-gray-900">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-gray-900 hover:text-gray-700 dark:text-white dark:hover:text-gray-200">
          Gallery
        </Link>
        {isLoaded && isAdmin && (
          <Link 
            href="/admin" 
            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            Admin
          </Link>
        )}
      </div>

      <div className="flex flex-row items-center gap-4">
        <SignedOut>
          <SignInButton />
        </SignedOut>
        <SignedIn>
          <SimpleUploadButton />
          <UserButton />
        </SignedIn>
      </div>
    </nav>
  );
}
