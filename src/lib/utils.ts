import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateOnePercentRule(estimatedValue: string | number | null, weeklyRent: string | number | null): number | null {
  if (!estimatedValue || !weeklyRent) return null;
  
  // Parse string values and handle invalid inputs
  const parsedEstimatedValue = typeof estimatedValue === 'string' 
    ? Number(estimatedValue.replace(/[^0-9.]/g, '')) 
    : estimatedValue;
    
  const parsedWeeklyRent = typeof weeklyRent === 'string'
    ? Number(weeklyRent.replace(/[^0-9.]/g, ''))
    : weeklyRent;

  // Return null if either value is not a valid number
  if (isNaN(parsedEstimatedValue) || isNaN(parsedWeeklyRent) || parsedEstimatedValue === 0) {
    return null;
  }
  
  // Calculate monthly rent (weekly rent * 52 weeks / 12 months)
  const monthlyRent = (parsedWeeklyRent * 52) / 12;
  
  // Calculate percentage (monthly rent / property value * 100)
  const percentage = (monthlyRent / parsedEstimatedValue) * 100;
  
  return Number(percentage.toFixed(2));
}
