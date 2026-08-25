"use client";

import {
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  FileText,
  LayoutGrid,
  MonitorPlay,
  PanelLeft,
  PieChart,
  Settings,
  Sparkles,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Home", icon: LayoutGrid, href: "#" },
  { label: "My Classroom", icon: MonitorPlay, href: "#" },
  { label: "Assignments", icon: FileText, href: "#" },
  { label: "Exams", icon: ClipboardList, href: "#", active: true },
  { label: "My Library", icon: PieChart, href: "#" },
];

export function Sidebar({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  if (collapsed) {
    return (
      <aside className="hidden lg:flex w-20 shrink-0 flex-col items-center justify-between bg-surface py-4">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-dark text-sm font-bold text-white">
            V
          </div>
          <button className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-dark ring-2 ring-brand-orange/60">
            <Sparkles className="h-4 w-4 text-brand-orange" />
          </button>
          <nav className="flex flex-col gap-2">
            {NAV_ITEMS.map(({ label, icon: Icon, active }) => (
              <a
                key={label}
                href="#"
                title={label}
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  active ? "bg-surface-muted text-brand-dark" : "text-neutral-400 hover:bg-surface-muted"
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
              </a>
            ))}
          </nav>
        </div>

        <div className="flex flex-col items-center gap-3">
          <a href="#" title="Settings" className="flex h-10 w-10 items-center justify-center rounded-lg text-neutral-400 hover:bg-surface-muted">
            <Settings className="h-4.5 w-4.5" />
          </a>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-muted text-[10px] font-semibold">
            DPS
          </div>
          <button
            onClick={onToggleCollapsed}
            title="Expand sidebar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-surface-muted"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden lg:flex w-70 shrink-0 flex-col justify-between bg-surface p-4">
      <div>
        <div className="flex items-center justify-between px-2 pb-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-dark text-sm font-bold text-white">
              V
            </div>
            <span className="text-lg font-bold text-brand-dark">VedaAI</span>
          </div>
          <button
            onClick={onToggleCollapsed}
            title="Collapse sidebar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-surface-muted"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        </div>

        <button className="mb-6 flex w-full items-center justify-center gap-2 rounded-full bg-brand-dark px-4 py-3 text-sm font-medium text-white ring-2 ring-brand-orange/60">
          <Sparkles className="h-4 w-4 text-brand-orange" />
          AI Teacher&apos;s Toolkit
        </button>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ label, icon: Icon, active }) => (
            <a
              key={label}
              href="#"
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
                active
                  ? "bg-surface-muted font-semibold text-brand-dark"
                  : "text-neutral-500 hover:bg-surface-muted"
              }`}
            >
              <Icon className="h-4.5 w-4.5" />
              {label}
            </a>
          ))}
        </nav>
      </div>

      <div>
        <a
          href="#"
          className="mb-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-neutral-500 hover:bg-surface-muted"
        >
          <Settings className="h-4.5 w-4.5" />
          Settings
        </a>
        <div className="flex items-center gap-3 rounded-xl bg-surface-muted p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold">
            DPS
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-brand-dark">Delhi Public School</p>
            <p className="truncate text-xs text-neutral-500">Bokaro Steel City</p>
          </div>
          <ChevronsLeft className="ml-auto h-4 w-4 shrink-0 text-neutral-300" />
        </div>
      </div>
    </aside>
  );
}
