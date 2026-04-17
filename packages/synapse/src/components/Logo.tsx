export default function Logo({ size = 'md', white = true }: { size?: 'sm' | 'md' | 'lg'; white?: boolean }) {
  const sizes = { sm: { icon: 22, text: 16 }, md: { icon: 28, text: 20 }, lg: { icon: 38, text: 28 } };
  const s = sizes[size];
  const color = white ? '#ffffff' : '#000000';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, userSelect: 'none' }}>
      {/* Icon: two overlapping circles (synapse junction) */}
      <svg width={s.icon} height={s.icon} viewBox="0 0 32 32" fill="none">
        <circle cx="11" cy="16" r="8" stroke={color} strokeWidth="2"/>
        <circle cx="21" cy="16" r="8" stroke={color} strokeWidth="2"/>
        <circle cx="16" cy="16" r="3" fill={color}/>
      </svg>
      <span style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 600,
        fontSize: s.text,
        color,
        letterSpacing: '-0.04em',
        lineHeight: 1,
      }}>
        synapse
      </span>
    </div>
  );
}
