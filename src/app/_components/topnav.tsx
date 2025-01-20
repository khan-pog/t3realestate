"use client";

import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { SimpleUploadButton } from "./simple-upload-button";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";

export function TopNav() {
  const { user } = useUser();
  const isAdmin = user?.privateMetadata?.isAdmin === true;

  return (
    <nav className="flex w-full items-center justify-between border-b p-4 text-xl font-semibold">
      <div className="flex items-center gap-4">
        <Link href="/">Gallery</Link>
        {isAdmin && (
          <Link 
            href="/admin" 
            className="text-sm text-muted-foreground hover:text-foreground"
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
