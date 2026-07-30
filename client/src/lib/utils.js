import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateTime(date) {
  return new Date(date).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function isRegistrationOpen(registrationStart, registrationEnd) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(registrationStart);
  const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const end = new Date(registrationEnd);
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return today >= startDate && today <= endDate;
}
