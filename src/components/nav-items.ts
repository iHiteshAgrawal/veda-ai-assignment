import {
  ClipboardList,
  FileText,
  LayoutGrid,
  MonitorPlay,
  PieChart,
  type LucideIcon,
} from "lucide-react";

/**
 * The navigation shown in the reference design. Only Exams is backed by a real
 * route in this build — the rest are part of the wider product the design
 * depicts, not of this assignment.
 *
 * They're rendered as visibly disabled controls rather than `href="#"` links so
 * the design still reads correctly while nothing pretends to be clickable and
 * silently does nothing.
 */
export interface NavItem {
  label: string;
  icon: LucideIcon;
  /** Present only for destinations this build actually implements. */
  href?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Home", icon: LayoutGrid },
  { label: "My Classroom", icon: MonitorPlay },
  { label: "Assignments", icon: FileText },
  { label: "Exams", icon: ClipboardList, href: "/" },
  { label: "My Library", icon: PieChart },
];

export const OUT_OF_SCOPE_TITLE = "Not part of this prototype";
