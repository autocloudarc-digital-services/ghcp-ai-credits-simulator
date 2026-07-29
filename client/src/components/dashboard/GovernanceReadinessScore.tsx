interface GovernanceReadinessScoreProps {
  score: number;
  size?: number;
}

export default function GovernanceReadinessScore({ score, size = 140 }: GovernanceReadinessScoreProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const color = clamped <= 33 ? '#ef4444' : clamped <= 66 ? '#fbbf24' : '#4ade80';
  const label = clamped <= 33 ? 'Needs Attention' : clamped <= 66 ? 'Developing' : 'Strong';

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#334155"
          strokeWidth={10}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.6s ease' }}
        />
        <text
          x="50%"
          y="46%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="font-numeric"
          fontSize={size * 0.24}
          fill={color}
          fontWeight={700}
        >
          {Math.round(clamped)}
        </text>
        <text
          x="50%"
          y="64%"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.08}
          fill="#94a3b8"
        >
          / 100
        </text>
      </svg>
      <span className="text-sm font-medium" style={{ color }}>
        {label}
      </span>
      <span className="text-xs text-slate-400">Governance Readiness</span>
    </div>
  );
}
