import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import EventDetailSheet from '@/components/EventDetailSheet';
import { CalendarDays, MapPin, Users, PartyPopper } from 'lucide-react';

const STATUS_FILTERS = [
  { key: 'all', label: 'All', colorClass: '' },
  { key: 'open', label: 'Open', colorClass: 'bg-success' },
  { key: 'upcoming', label: 'Upcoming', colorClass: 'bg-ust-yellow' },
  { key: 'closed', label: 'Closed', colorClass: 'bg-ust-gray-500' },
  { key: 'full', label: 'Full', colorClass: 'bg-error' },
];

function getEventStatus(event) {
  const isFull = event.maxCapacity > 0 && event.bookingCount >= event.maxCapacity;
  if (isFull) return 'full';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(event.registrationStart);
  const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const end = new Date(event.registrationEnd);
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  if (today < startDate) return 'upcoming';
  if (today > endDate) return 'closed';
  return 'open';
}

const statusBadge = (status) => {
  switch (status) {
    case 'open': return { variant: 'success', label: 'Open' };
    case 'upcoming': return { variant: 'warning', label: 'Upcoming' };
    case 'closed': return { variant: 'secondary', label: 'Closed' };
    case 'full': return { variant: 'destructive', label: 'Full' };
    default: return { variant: 'secondary', label: status };
  }
};

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('open');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    api.get('/events')
      .then(res => setEvents(res.data.events))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const categorized = useMemo(() => {
    const counts = { all: events.length, open: 0, upcoming: 0, closed: 0, full: 0 };
    const tagged = events.map(event => {
      const status = getEventStatus(event);
      counts[status]++;
      return { ...event, _status: status };
    });
    return { tagged, counts };
  }, [events]);

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return categorized.tagged;
    return categorized.tagged.filter(e => e._status === activeFilter);
  }, [categorized.tagged, activeFilter]);

  const openSheet = (index) => {
    setSelectedIndex(index);
    setSheetOpen(true);
  };

  const selectedEvent = filtered[selectedIndex];

  if (loading) {
    return (
      <div>
        <div className="mb-4">
          <Skeleton className="h-7 w-36 mb-1.5" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-full max-w-md mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-lg border bg-white p-4">
              <Skeleton className="h-5 w-3/4 mb-2" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Events</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">Register for celebrations and get your digital pass</p>
      </div>

      {/* ── Filter pills (matches reference UI FilterNavbar) ── */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-4 no-scrollbar">
        {STATUS_FILTERS.map((f) => {
          const count = categorized.counts[f.key];
          const isActive = activeFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full border cursor-pointer transition-all whitespace-nowrap shadow-sm text-xs font-medium sm:text-sm ${
                isActive
                  ? 'border-primary text-white bg-primary'
                  : 'border-ust-gray-350 text-ust-gray-900 bg-white hover:bg-ust-gray-300'
              }`}
            >
              {f.colorClass && (
                <span className={`h-2 w-2 rounded-full shrink-0 ${f.colorClass}`} />
              )}
              <span>{f.label}</span>
              <span className={`ml-0.5 ${isActive ? 'text-white/70' : 'text-muted-foreground'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Event cards ── */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center rounded-xl bg-white px-4 py-16 text-center"
        >
          <PartyPopper className="mb-3 h-12 w-12 text-ust-gray-400" />
          <p className="text-sm font-medium text-ust-gray-700">
            {activeFilter === 'all' ? 'No events available' : `No ${activeFilter} events`}
          </p>
          {activeFilter !== 'all' && (
            <button
              onClick={() => setActiveFilter('all')}
              className="mt-1 text-xs text-primary underline cursor-pointer border-0 bg-transparent"
            >
              View all events
            </button>
          )}
        </motion.div>
      ) : (
        <div className="space-y-3">
          {filtered.map((event, index) => {
            const { variant, label } = statusBadge(event._status);

            return (
              <motion.div
                key={event._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <div
                  onClick={() => openSheet(index)}
                  className="group rounded-lg border bg-white p-4 cursor-pointer transition-all duration-300 hover:bg-ust-gray-200 hover:shadow-sm sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {/* Title + badge */}
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h3 className="text-sm font-semibold text-foreground truncate">{event.title}</h3>
                        <Badge variant={variant} className="shrink-0 text-[10px]">{label}</Badge>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-muted-foreground line-clamp-1 mb-2.5">{event.description}</p>

                      {/* Meta row */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <CalendarDays className="h-3 w-3 text-primary" />
                          {formatDate(event.eventDate)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 text-primary" />
                          <span className="truncate max-w-[140px] sm:max-w-none">{event.venue}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3 w-3 text-primary" />
                          {event.bookingCount}{event.maxCapacity > 0 && ` / ${event.maxCapacity}`}
                        </span>
                      </div>

                      {/* Capacity bar */}
                      {event.maxCapacity > 0 && (
                        <div className="mt-2 h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-ust-gray-300">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${Math.min((event.bookingCount / event.maxCapacity) * 100, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Food tags on right (desktop) */}
                    {event.foodOptions?.length > 0 && (
                      <div className="hidden sm:flex flex-col gap-1 shrink-0">
                        {event.foodOptions.slice(0, 3).map((opt) => (
                          <Badge key={opt._id} variant="outline" className="text-[10px] font-normal">
                            {opt.name}
                          </Badge>
                        ))}
                        {event.foodOptions.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{event.foodOptions.length - 3} more</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Detail sheet (slides from right) ── */}
      <EventDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        eventId={selectedEvent?._id}
        hasPrev={selectedIndex > 0}
        hasNext={selectedIndex < filtered.length - 1}
        onPrev={() => setSelectedIndex(i => Math.max(0, i - 1))}
        onNext={() => setSelectedIndex(i => Math.min(filtered.length - 1, i + 1))}
      />
    </div>
  );
}
