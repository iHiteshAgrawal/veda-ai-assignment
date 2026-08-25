import { BookOpen, Clock, RefreshCw, Settings2 } from "lucide-react";

/**
 * Placeholder for the illustrated teacher avatar from the Figma file (that's a
 * custom asset, not something derivable from CSS — swap the inner icon for an
 * exported PNG/SVG once available). The surrounding ring + floating status
 * badges are reproduced from the design.
 */
export function MascotAvatar() {
  return (
    <div className="relative mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-brand-orange-soft">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-brand-dark">
        <BookOpen className="h-9 w-9" />
      </div>
      <Badge className="-top-1 right-1">
        <Clock className="h-3 w-3" />
      </Badge>
      <Badge className="top-6 -left-3">
        <BookOpen className="h-3 w-3" />
      </Badge>
      <Badge className="-bottom-1 left-6">
        <Settings2 className="h-3 w-3" />
      </Badge>
      <Badge className="bottom-4 -right-3">
        <RefreshCw className="h-3 w-3" />
      </Badge>
    </div>
  );
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <div
      className={`absolute flex h-6 w-6 items-center justify-center rounded-full bg-brand-orange text-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}
