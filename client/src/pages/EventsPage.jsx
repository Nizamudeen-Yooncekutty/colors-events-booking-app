import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import EventDetailSheet from '@/components/EventDetailSheet';
import LoadingMore from '@/components/LoadingMore';
import useInfiniteScroll from '@/hooks/useInfiniteScroll';
import { CalendarDays, MapPin, Users, PartyPopper, Search, X } from 'lucide-react';

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
  const [activeFilter, setActiveFilter] = useState('open');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchEvents = useCallback(async (page) => {
    const res = await api.get('/events', {
      params: { page, limit: 20, search: debouncedSearch || undefined },
    });
    return { items: res.data.events, pagination: res.data.pagination };
  }, [debouncedSearch]);

  const { items: events, loading, loadingMore, sentinelRef } = useInfiniteScroll(
    fetchEvents, { deps: [debouncedSearch] }
  );

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
      {/* ── Page header ── */}
      <div className="mb-3">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Events</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">Register for celebrations and get your digital pass</p>
      </div>

      {/* ── Sticky bar: pills left, search right ── */}
      <div className="sticky top-12 sm:top-13 z-40 -mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6 py-2.5 bg-ust-gray-200/95 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          {/* Filter pills */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar shrink min-w-0">
            {STATUS_FILTERS.map((f) => {
              const count = categorized.counts[f.key];
              const isActive = activeFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full border cursor-pointer transition-all whitespace-nowrap shadow-sm text-[11px] font-medium sm:px-3 sm:py-1.5 sm:text-xs ${
                    isActive
                      ? 'border-primary text-white bg-primary'
                      : 'border-ust-gray-350 text-ust-gray-900 bg-white hover:bg-ust-gray-300'
                  }`}
                >
                  {f.colorClass && (
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 sm:h-2 sm:w-2 ${f.colorClass}`} />
                  )}
                  <span>{f.label}</span>
                  <span className={`ml-0.5 ${isActive ? 'text-white/70' : 'text-muted-foreground'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Compact search — pushed to far right */}
          <div className="relative shrink-0 w-36 sm:w-48 ml-auto">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              placeholder="Search..."
              className="h-7 w-full rounded-full border border-ust-gray-400 bg-white pl-7 pr-7 text-[11px] outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors sm:h-8 sm:pl-8 sm:text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground cursor-pointer border-0 bg-transparent"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Event cards ── */}
      <div className="mt-3">
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center rounded-xl bg-white px-4 py-16 text-center"
          >
            <PartyPopper className="mb-3 h-12 w-12 text-ust-gray-400" />
            <p className="text-sm font-medium text-ust-gray-700">
              {debouncedSearch
                ? `No events matching "${debouncedSearch}"`
                : activeFilter === 'all' ? 'No events available' : `No ${activeFilter} events`}
            </p>
            {(activeFilter !== 'all' || debouncedSearch) && (
              <button
                onClick={() => { setActiveFilter('all'); setSearch(''); }}
                className="mt-1 text-xs text-primary underline cursor-pointer border-0 bg-transparent"
              >
                Clear filters
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
                    className="group rounded-lg border bg-white p-3 cursor-pointer transition-all duration-300 hover:bg-ust-gray-200 hover:shadow-sm sm:p-4"
                  >
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-xs font-semibold text-foreground truncate sm:text-sm">{event.title}</h3>
                          <Badge variant={variant} className="shrink-0 text-[10px]">{label}</Badge>
                        </div>

                        <p className="text-[11px] text-muted-foreground line-clamp-1 mb-2 sm:text-xs">{event.description}</p>

                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground sm:text-xs sm:gap-x-4">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3 text-primary" />
                            {formatDate(event.eventDate)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-primary" />
                            <span className="truncate max-w-[120px] sm:max-w-none">{event.venue}{event.location ? `, ${event.location}` : ''}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-primary" />
                            {event.bookingCount}{event.maxCapacity > 0 && ` / ${event.maxCapacity}`}
                          </span>
                        </div>

                        {event.maxCapacity > 0 && (
                          <div className="mt-1.5 h-1 w-full max-w-[180px] overflow-hidden rounded-full bg-ust-gray-300 sm:mt-2 sm:h-1.5">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${Math.min((event.bookingCount / event.maxCapacity) * 100, 100)}%` }}
                            />
                          </div>
                        )}
                      </div>

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
            <LoadingMore ref={sentinelRef} loading={loadingMore} />
          </div>
        )}
      </div>

      {/* ── Detail sheet ── */}
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
