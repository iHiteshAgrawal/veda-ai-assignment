"use client";

import { useCallback, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  getServerSidebarPreference,
  getSidebarPreference,
  setSidebarPreference,
  subscribeToSidebarPreference,
} from "@/lib/sidebar-preference";
import { Sidebar, SidebarDrawer } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({
  children,
  breadcrumb,
  defaultCollapsed = false,
}: {
  children: ReactNode;
  breadcrumb: string;
  /** Used until the viewer expresses a preference — the results screen wants the extra width. */
  defaultCollapsed?: boolean;
}) {
  const stored = useSyncExternalStore(
    subscribeToSidebarPreference,
    getSidebarPreference,
    getServerSidebarPreference
  );
  const collapsed = stored ?? defaultCollapsed;

  const [navOpen, setNavOpen] = useState(false);
  const toggleCollapsed = useCallback(() => setSidebarPreference(!collapsed), [collapsed]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <SidebarDrawer open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col gap-4 p-3 lg:p-4">
        <Topbar breadcrumb={breadcrumb} onOpenNav={() => setNavOpen(true)} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
