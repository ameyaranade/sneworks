import type { IntensityLevel } from '../../types';
import { INTENSITY_COLORS } from '../../constants/health';

interface IntensityDotProps {
  intensity: IntensityLevel;
  size?: number;
}

export default function IntensityDot({ intensity, size = 8 }: IntensityDotProps) {
  const color = INTENSITY_COLORS[intensity].text;
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        verticalAlign: 'middle',
      }}
      title={intensity}
    />
  );
}
