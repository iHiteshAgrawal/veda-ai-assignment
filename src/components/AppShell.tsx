"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({
  children,
  breadcrumb,
  defaultCollapsed = false,
}: {
  children: ReactNode;
  breadcrumb: string;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((c) => !c)} />
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-3 lg:p-4">
        <Topbar breadcrumb={breadcrumb} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
