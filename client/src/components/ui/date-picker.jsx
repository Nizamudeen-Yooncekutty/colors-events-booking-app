import * as React from 'react';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

function DatePicker({ value, onChange, placeholder = 'Select date', disabled, minDate, maxDate, className, hasError }) {
  const [open, setOpen] = React.useState(false);

  const selectedDate = value ? new Date(value + 'T00:00:00') : null;

  const formatDisplay = (date) => {
    if (!date) return null;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const disabledMatcher = (date) => {
    if (minDate && date < new Date(minDate + 'T00:00:00')) return true;
    if (maxDate && date > new Date(maxDate + 'T23:59:59')) return true;
    return false;
  };

  const handleSelect = (date) => {
    if (!date) return;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const isoValue = `${year}-${month}-${day}`;
    onChange({ target: { value: isoValue } });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border bg-ust-gray-200 px-3 py-2 text-sm transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'cursor-pointer',
            hasError ? 'border-error' : 'border-ust-gray-400',
            className,
          )}
        >
          <span className={selectedDate ? 'text-foreground' : 'text-ust-gray-500'}>
            {selectedDate ? formatDisplay(selectedDate) : placeholder}
          </span>
          <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          disabled={disabledMatcher}
          defaultMonth={selectedDate || new Date()}
        />
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker };
