import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "~/lib/utils";

interface AdminNavLinkProps {
  href: string;
  children: React.ReactNode;
}

export function AdminNavLink({ href, children }: AdminNavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-gray-200 text-gray-900"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      )}
    >
      {children}
    </Link>
  );
}