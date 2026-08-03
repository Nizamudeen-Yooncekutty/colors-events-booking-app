import * as React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const YEAR_RANGE = 20;

function isSameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function YearGrid({ yearStart, yearEnd, currentYear, onSelect }) {
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    if (!scrollRef.current) return;
    const activeBtn = scrollRef.current.querySelector('[data-active="true"]');
    if (activeBtn) activeBtn.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, []);

  const years = Array.from({ length: yearEnd - yearStart + 1 }, (_, i) => yearStart + i);

  return (
    <div ref={scrollRef} className="grid grid-cols-4 gap-1.5 max-h-[280px] overflow-y-auto">
      {years.map(y => (
        <button
          key={y}
          type="button"
          data-active={y === currentYear}
          onClick={() => onSelect(y)}
          className={cn(
            'h-10 rounded-md text-xs font-medium transition-colors cursor-pointer',
            y === currentYear ? 'bg-primary text-white' : 'text-gray-700 hover:bg-primary/10 hover:text-primary',
          )}
        >
          {y}
        </button>
      ))}
    </div>
  );
}

function Calendar({ className, mode = 'single', selected, onSelect, disabled, defaultMonth, showOutsideDays = true }) {
  const initial = selected || defaultMonth || new Date();
  const [currentMonth, setCurrentMonth] = React.useState(initial.getMonth());
  const [currentYear, setCurrentYear] = React.useState(initial.getFullYear());
  const [pickerView, setPickerView] = React.useState(null);

  const handlePrev = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };

  const handleNext = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const startDow = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const cells = [];
  if (showOutsideDays) {
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startDow - 1; i >= 0; i--) {
      cells.push({ date: new Date(currentYear, currentMonth - 1, prevMonthLastDay - i), outside: true });
    }
  } else {
    for (let i = 0; i < startDow; i++) cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(currentYear, currentMonth, d), outside: false });
  }
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7 && showOutsideDays) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ date: new Date(currentYear, currentMonth + 1, d), outside: true });
    }
  }

  const today = new Date();
  const isDisabled = (date) => typeof disabled === 'function' ? disabled(date) : false;
  const thisYear = today.getFullYear();

  return (
    <div className={cn('p-3 bg-white w-full min-w-[280px]', className)}>
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={handlePrev} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-600 cursor-pointer border-0 bg-transparent">
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPickerView(pickerView === 'month' ? null : 'month')}
            className={cn(
              'text-sm font-semibold px-2 py-0.5 rounded-md hover:bg-gray-100 transition-colors cursor-pointer border-0 bg-transparent',
              pickerView === 'month' ? 'text-primary bg-primary/10' : 'text-gray-900',
            )}
          >
            {MONTH_SHORT[currentMonth]}
          </button>
          <button
            type="button"
            onClick={() => setPickerView(pickerView === 'year' ? null : 'year')}
            className={cn(
              'text-sm font-semibold px-2 py-0.5 rounded-md hover:bg-gray-100 transition-colors cursor-pointer border-0 bg-transparent',
              pickerView === 'year' ? 'text-primary bg-primary/10' : 'text-gray-900',
            )}
          >
            {currentYear}
          </button>
        </div>
        <button type="button" onClick={handleNext} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-600 cursor-pointer border-0 bg-transparent">
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>

      {pickerView === 'month' && (
        <div className="grid grid-cols-3 gap-1.5">
          {MONTH_SHORT.map((m, i) => (
            <button
              key={m}
              type="button"
              onClick={() => { setCurrentMonth(i); setPickerView(null); }}
              className={cn(
                'h-10 rounded-md text-xs font-medium transition-colors cursor-pointer border-0 bg-transparent',
                i === currentMonth ? 'bg-primary text-white' : 'text-gray-700 hover:bg-primary/10 hover:text-primary',
              )}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {pickerView === 'year' && (
        <YearGrid yearStart={thisYear - YEAR_RANGE} yearEnd={thisYear + YEAR_RANGE} currentYear={currentYear} onSelect={y => { setCurrentYear(y); setPickerView(null); }} />
      )}

      {!pickerView && (
        <>
          <div className="grid grid-cols-7 mb-1">
            {DAY_NAMES.map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1.5">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell, idx) => {
              if (!cell) return <div key={idx} className="aspect-square" />;
              const { date, outside } = cell;
              const isToday = isSameDay(date, today);
              const isSelected = mode === 'single' && isSameDay(date, selected);
              const dayDisabled = isDisabled(date);
              return (
                <div key={idx} className="flex items-center justify-center p-0.5">
                  <button
                    type="button"
                    disabled={dayDisabled}
                    onClick={() => { if (!dayDisabled) onSelect?.(date); }}
                    className={cn(
                      'w-9 h-9 rounded-md text-xs font-normal transition-colors border-0 bg-transparent',
                      outside && !isSelected && !dayDisabled && 'text-gray-400 hover:bg-primary/10 hover:text-primary cursor-pointer',
                      !outside && !isSelected && !dayDisabled && 'text-gray-700 hover:bg-primary/10 hover:text-primary cursor-pointer',
                      isToday && !isSelected && 'border border-primary text-primary font-semibold',
                      isSelected && 'bg-primary text-white font-semibold hover:bg-primary/90',
                      dayDisabled && 'text-gray-300 cursor-not-allowed',
                    )}
                  >
                    {date.getDate()}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export { Calendar };
