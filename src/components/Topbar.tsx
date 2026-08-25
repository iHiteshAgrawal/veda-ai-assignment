"use client";

import { ArrowLeft, Bell, ChevronDown, ClipboardList, HelpCircle, Menu, Sparkles } from "lucide-react";

export function Topbar({ breadcrumb }: { breadcrumb: string }) {
  return (
    <>
      {/* Desktop */}
      <header className="hidden lg:flex items-center justify-between rounded-2xl bg-surface px-6 py-4">
        <div className="flex items-center gap-2 text-neutral-500">
          <ArrowLeft className="h-4 w-4" />
          <ClipboardList className="h-4 w-4" />
          <span className="text-sm">{breadcrumb}</span>
        </div>
        <div className="flex items-center gap-4">
          <HelpCircle className="h-5 w-5 text-neutral-400" />
          <div className="relative">
            <Bell className="h-5 w-5 text-neutral-400" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-brand-orange" />
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted">
            <Sparkles className="h-4 w-4 text-brand-dark" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-neutral-300" />
            <span className="text-sm font-medium text-brand-dark">Madhur Rastogi</span>
            <ChevronDown className="h-4 w-4 text-neutral-400" />
          </div>
        </div>
      </header>

      {/* Mobile */}
      <header className="flex lg:hidden items-center justify-between rounded-2xl bg-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <ArrowLeft className="h-5 w-5 text-brand-dark" />
          <span className="text-lg font-bold text-brand-dark">VedaAI</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="h-5 w-5 text-neutral-500" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-brand-orange" />
          </div>
          <div className="h-7 w-7 rounded-full bg-neutral-300" />
          <Menu className="h-5 w-5 text-brand-dark" />
        </div>
      </header>
    </>
  );
}
