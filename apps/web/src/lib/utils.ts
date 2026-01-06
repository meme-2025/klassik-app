import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatKAS(amount: number, decimals: number = 4): string {
  return amount.toFixed(decimals);
}

export function shortenAddress(address: string, chars: number = 10): string {
  return `${address.substring(0, chars)}...${address.substring(address.length - chars)}`;
}

export function formatMultiplier(multiplier: number): string {
  return `${multiplier.toFixed(2)}x`;
}

export function getColorForMultiplier(multiplier: number): string {
  if (multiplier < 1.5) return '#06B6D4'; // Cyan
  if (multiplier < 3.0) return '#F97316'; // Orange
  return '#DC2626'; // Red
}
