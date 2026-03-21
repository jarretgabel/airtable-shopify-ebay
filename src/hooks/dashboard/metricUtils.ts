import { TrendSummary } from './metricsTypes';

export function parseCurrencyAmount(value: unknown): number {
  const raw = String(value ?? '').replace(/[^0-9.]/g, '');
  return parseFloat(raw) || 0;
}

export function parseDateValue(value: unknown): number | null {
  if (!value) return null;
  const timestamp = new Date(String(value)).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function isWithinWindow(timestamp: number | null, start: number, end: number): boolean {
  return timestamp !== null && timestamp >= start && timestamp < end;
}

export function getTrendSummary(current: number, previous: number, label: string): TrendSummary {
  if (current === 0 && previous === 0) {
    return { direction: 'flat', text: `Flat vs prior ${label}` };
  }

  if (previous === 0) {
    return { direction: 'up', text: `Up from 0 vs prior ${label}` };
  }

  const changePct = Math.round(((current - previous) / previous) * 100);
  if (changePct === 0) {
    return { direction: 'flat', text: `Flat vs prior ${label}` };
  }

  return {
    direction: changePct > 0 ? 'up' : 'down',
    text: `${changePct > 0 ? 'Up' : 'Down'} ${Math.abs(changePct)}% vs prior ${label}`,
  };
}
