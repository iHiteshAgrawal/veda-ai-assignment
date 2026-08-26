"use client";

import { ChevronsRight, PanelLeft, Settings, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, OUT_OF_SCOPE_TITLE, type NavItem } from "./nav-items";

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange";

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const shape = collapsed
    ? "flex h-10 w-10 items-center justify-center rounded-lg"
    : "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm";

  if (!item.href) {
    return (
      <span
        aria-disabled="true"
        title={OUT_OF_SCOPE_TITLE}
        className={`${shape} cursor-not-allowed text-neutral-300`}
      >
        <Icon className="h-4.5 w-4.5" />
        {!collapsed && item.label}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={`${shape} ${FOCUS_RING} ${
        active
          ? "bg-surface-muted font-semibold text-brand-dark"
          : "text-neutral-500 hover:bg-surface-muted"
      }`}
    >
      <Icon className="h-4.5 w-4.5" />
      {!collapsed && item.label}
    </Link>
  );
}

function SidebarBody({
  collapsed,
  onToggleCollapsed,
  onNavigate,
  onClose,
}: {
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const isActive = (item: NavItem) =>
    Boolean(item.href) && (item.href === "/" ? pathname === "/" || pathname.startsWith("/exam") : false);

  return (
    // A three-part column: header and footer stay pinned while only the nav
    // scrolls. Previously the whole column overflowed on short viewports, which
    // pushed the expand control off-screen and made a collapsed sidebar
    // impossible to reopen.
    <>
      <div className={`shrink-0 ${collapsed ? "flex flex-col items-center gap-4" : ""}`}>
        <div
          className={`flex items-center ${collapsed ? "justify-center" : "justify-between px-2"} pb-4`}
        >
          <Link
            href="/"
            onClick={onNavigate}
            className={`flex items-center gap-2 rounded-lg ${FOCUS_RING}`}
            aria-label="VedaAI home"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-dark text-sm font-bold text-white">
              V
            </span>
            {!collapsed && <span className="text-lg font-bold text-brand-dark">VedaAI</span>}
          </Link>

          {!collapsed && onToggleCollapsed && (
            <button
              onClick={onToggleCollapsed}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              aria-expanded
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-surface-muted ${FOCUS_RING}`}
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          )}

          {!collapsed && onClose && (
            <button
              onClick={onClose}
              aria-label="Close navigation"
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-surface-muted lg:hidden ${FOCUS_RING}`}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          aria-disabled="true"
          title={OUT_OF_SCOPE_TITLE}
          className={`mb-2 flex cursor-not-allowed items-center justify-center gap-2 rounded-full bg-brand-dark text-sm font-medium text-white ring-2 ring-brand-orange/60 ${
            collapsed ? "h-11 w-11" : "w-full px-4 py-3"
          }`}
        >
          <Sparkles className="h-4 w-4 text-brand-orange" />
          {!collapsed && "AI Teacher's Toolkit"}
        </button>
      </div>

      <nav
        aria-label="Main"
        className={`min-h-0 flex-1 overflow-y-auto py-2 ${
          collapsed ? "flex flex-col items-center gap-2" : "flex flex-col gap-1"
        }`}
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.label}
            item={item}
            active={isActive(item)}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className={`shrink-0 pt-2 ${collapsed ? "flex flex-col items-center gap-3" : ""}`}>
        <span
          aria-disabled="true"
          title={OUT_OF_SCOPE_TITLE}
          className={`cursor-not-allowed text-neutral-300 ${
            collapsed
              ? "flex h-10 w-10 items-center justify-center rounded-lg"
              : "mb-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
          }`}
        >
          <Settings className="h-4.5 w-4.5" />
          {!collapsed && "Settings"}
        </span>

        {collapsed ? (
          <span
            title="Delhi Public School — Bokaro Steel City"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-muted text-[10px] font-semibold"
          >
            DPS
          </span>
        ) : (
          <div className="flex items-center gap-3 rounded-xl bg-surface-muted p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold">
              DPS
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-brand-dark">Delhi Public School</p>
              <p className="truncate text-xs text-neutral-500">Bokaro Steel City</p>
            </div>
          </div>
        )}

        {collapsed && onToggleCollapsed && (
          <button
            onClick={onToggleCollapsed}
            title="Expand sidebar"
            aria-label="Expand sidebar"
            aria-expanded={false}
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-surface-muted ${FOCUS_RING}`}
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </>
  );
}

export function Sidebar({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-surface p-4 lg:flex ${
        collapsed ? "w-20 items-center" : "w-70"
      }`}
    >
      <SidebarBody collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} />
    </aside>
  );
}

/** Mobile drawer — below `lg` the rail is hidden, so this is the only navigation. */
export function SidebarDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    // Stop the page behind the drawer from scrolling with it.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Presentational: the X button and Escape are the announced ways out, so
          labelling this too would just repeat "close" to a screen reader. */}
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Main navigation"
        className="absolute inset-y-0 left-0 flex w-72 flex-col bg-surface p-4 shadow-xl"
      >
        <SidebarBody collapsed={false} onNavigate={onClose} onClose={onClose} />
      </div>
    </div>
  );
}
