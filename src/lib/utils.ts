import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateOnePercentRule(estimatedValue: number | null, weeklyRent: number | null): number | null {
  if (!estimatedValue || !weeklyRent) return null;
  
  // Calculate monthly rent (weekly rent * 52 weeks / 12 months)
  const monthlyRent = (weeklyRent * 52) / 12;
  
  // Calculate percentage (monthly rent / property value * 100)
  const percentage = (monthlyRent / estimatedValue) * 100;
  
  return Number(percentage.toFixed(2));
}
