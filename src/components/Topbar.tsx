"use client";

import { ArrowLeft, Bell, ChevronDown, ClipboardList, HelpCircle, Menu, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OUT_OF_SCOPE_TITLE } from "./nav-items";

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange";

/**
 * Chrome from the reference design with no feature behind it. Rendered as a
 * disabled button rather than a bare icon so it's reachable by assistive tech,
 * announces what it is, and visibly doesn't respond — instead of looking
 * clickable and doing nothing.
 */
function InertAction({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span
      role="button"
      aria-disabled="true"
      aria-label={`${label} — ${OUT_OF_SCOPE_TITLE}`}
      title={OUT_OF_SCOPE_TITLE}
      className="relative flex cursor-not-allowed items-center text-neutral-300"
    >
      {children}
    </span>
  );
}

export function Topbar({
  breadcrumb,
  onOpenNav,
}: {
  breadcrumb: string;
  onOpenNav: () => void;
}) {
  const router = useRouter();

  return (
    <>
      {/* Desktop */}
      <header className="hidden items-center justify-between rounded-2xl bg-surface px-6 py-4 lg:flex">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className={`flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 hover:bg-surface-muted ${FOCUS_RING}`}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Link
            href="/"
            className={`flex items-center gap-2 rounded px-1 text-sm text-neutral-500 hover:text-brand-dark ${FOCUS_RING}`}
          >
            <ClipboardList className="h-4 w-4" />
            {breadcrumb}
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <InertAction label="Help">
            <HelpCircle className="h-5 w-5" />
          </InertAction>
          <InertAction label="Notifications">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-brand-orange" />
          </InertAction>
          <InertAction label="AI assistant">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted">
              <Sparkles className="h-4 w-4" />
            </span>
          </InertAction>
          <InertAction label="Account menu">
            <span className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-full bg-neutral-300" />
              <span className="text-sm font-medium text-neutral-400">Madhur Rastogi</span>
              <ChevronDown className="h-4 w-4" />
            </span>
          </InertAction>
        </div>
      </header>

      {/* Mobile */}
      <header className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-brand-dark hover:bg-surface-muted ${FOCUS_RING}`}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Link href="/" className={`rounded text-lg font-bold text-brand-dark ${FOCUS_RING}`}>
            VedaAI
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <InertAction label="Notifications">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-brand-orange" />
          </InertAction>
          <span className="h-7 w-7 rounded-full bg-neutral-300" />
          <button
            onClick={onOpenNav}
            aria-label="Open navigation"
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-brand-dark hover:bg-surface-muted ${FOCUS_RING}`}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>
    </>
  );
}
