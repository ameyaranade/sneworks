interface WeeklyBarChartProps {
  /** 7 values, index 0 = oldest, index 6 = today */
  data: number[];
  goal?: number;
  color?: string;
  labels?: string[];
  height?: number;
}

export default function WeeklyBarChart({
  data,
  goal,
  color = '#60a5fa',
  labels,
  height = 80,
}: WeeklyBarChartProps) {
  const W = 240;
  const H = height;
  const padB = 18;  // bottom padding for labels
  const padT = 8;
  const chartH = H - padB - padT;
  const barCount = data.length;
  const gap = 4;
  const barW = (W - gap * (barCount - 1)) / barCount;

  const maxVal = Math.max(goal ?? 0, ...data, 1);

  const toY = (v: number) => padT + chartH * (1 - v / maxVal);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      {/* Goal line */}
      {goal && goal > 0 && (
        <line
          x1={0} y1={toY(goal)}
          x2={W} y2={toY(goal)}
          stroke={color}
          strokeWidth={1}
          strokeDasharray="4 3"
          opacity={0.5}
        />
      )}

      {/* Bars */}
      {data.map((v, i) => {
        const x = i * (barW + gap);
        const barH = Math.max((v / maxVal) * chartH, v > 0 ? 2 : 0);
        const y = padT + chartH - barH;
        const isToday = i === data.length - 1;
        return (
          <g key={i}>
            <rect
              x={x} y={y}
              width={barW} height={barH}
              rx={3} ry={3}
              fill={color}
              opacity={isToday ? 1 : 0.45}
            />
            {labels && (
              <text
                x={x + barW / 2}
                y={H - 3}
                textAnchor="middle"
                fontSize={9}
                fill="currentColor"
                opacity={0.5}
              >
                {labels[i]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
