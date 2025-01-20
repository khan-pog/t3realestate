import { AdminNavLink } from "~/components/admin/admin-nav-link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-screen grid-cols-[250px,1fr]">
      <aside className="border-r bg-gray-50">
        <nav className="flex flex-col gap-2 p-4">
          <AdminNavLink href="/admin/users">Users</AdminNavLink>
          <AdminNavLink href="/admin/content">Content</AdminNavLink>
          <AdminNavLink href="/admin/settings">Settings</AdminNavLink>
        </nav>
      </aside>
      <main className="overflow-y-auto p-6">{children}</main>
    </div>
  );
} 