import type { WorkoutType, IntensityLevel } from '../types';

export const WORKOUT_TYPES: WorkoutType[] = ['Run', 'Walk', 'Cycle', 'Gym', 'Yoga', 'Swim', 'Other'];

// MET values: metabolic equivalent per activity × intensity
export const MET_TABLE: Record<WorkoutType, Record<IntensityLevel, number>> = {
  Run:   { Low: 7,   Moderate: 9,   High: 11,  Max: 13 },
  Walk:  { Low: 2.5, Moderate: 3.5, High: 4.5, Max: 5.5 },
  Cycle: { Low: 5,   Moderate: 8,   High: 10,  Max: 12 },
  Gym:   { Low: 3,   Moderate: 5,   High: 6,   Max: 8 },
  Yoga:  { Low: 2,   Moderate: 3,   High: 4,   Max: 5 },
  Swim:  { Low: 5,   Moderate: 7,   High: 9,   Max: 11 },
  Other: { Low: 3,   Moderate: 5,   High: 7,   Max: 9 },
};

export const INTENSITY_LEVELS: IntensityLevel[] = ['Low', 'Moderate', 'High', 'Max'];

export interface IntensityMeta {
  label: string;
  description: string;
  // CSS variable names to use for styling
  colorVar: string;
  bgVar: string;
  borderVar: string;
}

export const INTENSITY_META: Record<IntensityLevel, IntensityMeta> = {
  Low:      { label: 'Low',      description: 'Easy, can hold a conversation',    colorVar: '--color-intensity-low',      bgVar: '--color-intensity-low-bg',      borderVar: '--color-intensity-low-border' },
  Moderate: { label: 'Moderate', description: 'Comfortable but breathing harder', colorVar: '--color-intensity-moderate', bgVar: '--color-intensity-moderate-bg', borderVar: '--color-intensity-moderate-border' },
  High:     { label: 'High',     description: 'Hard, short sentences only',       colorVar: '--color-intensity-high',     bgVar: '--color-intensity-high-bg',     borderVar: '--color-intensity-high-border' },
  Max:      { label: 'Max',      description: 'All out, unsustainable',           colorVar: '--color-intensity-max',      bgVar: '--color-intensity-max-bg',      borderVar: '--color-intensity-max-border' },
};

// Hardcoded colors matching the intensity theme (used where CSS vars aren't available, e.g. SVG)
export const INTENSITY_COLORS: Record<IntensityLevel, { text: string; bg: string; border: string }> = {
  Low:      { text: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.35)' },
  Moderate: { text: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.35)' },
  High:     { text: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.35)' },
  Max:      { text: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.35)' },
};

export function calcCalories(
  activity: WorkoutType,
  intensity: IntensityLevel,
  durationMin: number,
  weightKg: number,
): number {
  const met = MET_TABLE[activity][intensity];
  return Math.round(met * weightKg * (durationMin / 60));
}

// Distance unit per workout type
export function distanceUnit(activity: WorkoutType): 'km' | 'm' | null {
  if (activity === 'Swim') return 'm';
  if (['Run', 'Walk', 'Cycle'].includes(activity)) return 'km';
  return null;
}

export function showsDistance(activity: WorkoutType): boolean {
  return ['Run', 'Walk', 'Cycle', 'Swim'].includes(activity);
}

export function showsSetsReps(activity: WorkoutType): boolean {
  return activity === 'Gym';
}
