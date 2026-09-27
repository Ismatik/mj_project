/** The MJ square monogram with the "MAVZUNAI JOVID" caption. */
export function Monogram({
  size = 36,
  color = "var(--mj-gold)",
  caption = "MAVZUNAI JOVID",
  title = "Mavzunai Jovid",
}: {
  size?: number;
  color?: string;
  caption?: string;
  title?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ flexShrink: 0 }} role="img" aria-label={title}>
      <rect x={7} y={4} width={34} height={30} fill="none" stroke={color} strokeWidth={2.2} />
      <text x={24} y={26} textAnchor="middle" fontFamily="var(--mj-serif)" fontSize={16} fontWeight={600} fill={color}>
        MJ
      </text>
      <text x={24} y={43} textAnchor="middle" fontFamily="var(--mj-sans)" fontSize={5} letterSpacing={1.4} fill={color}>
        {caption}
      </text>
    </svg>
  );
}
