import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({ children, breadcrumb }: { children: ReactNode; breadcrumb: string }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-3 lg:p-4">
        <Topbar breadcrumb={breadcrumb} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
