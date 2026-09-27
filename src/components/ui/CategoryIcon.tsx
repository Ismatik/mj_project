import { Brush, Crown, Droplet, Eye, Hand, Scissors, Sparkles, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  scissors: Scissors,
  hand: Hand,
  eye: Eye,
  droplet: Droplet,
  sparkles: Sparkles,
  brush: Brush,
  crown: Crown,
};

/** Service category icon (keys stored in ServiceCategory.icon). */
export function CategoryIcon({ name, size = 16 }: { name: string; size?: number }) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon size={size} color="var(--mj-gold-deep)" strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />;
}
