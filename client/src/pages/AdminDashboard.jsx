import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import LoadingMore from '@/components/LoadingMore';
import useInfiniteScroll from '@/hooks/useInfiniteScroll';
import {
  Users, CalendarDays, Ticket, ScanLine, Plus, BarChart3, Eye,
  UserPlus, UserCheck, Building2, UsersRound, Search, X,
} from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    api.get('/admin/dashboard', { params: { page: 1, limit: 1 } })
      .then(res => setStats(res.data.stats))
      .catch(console.error)
      .finally(() => setStatsLoading(false));
  }, []);

  const fetchEvents = useCallback(async (page) => {
    const res = await api.get('/admin/dashboard', {
      params: { page, limit: 20, search: debouncedSearch || undefined },
    });
    if (!stats) setStats(res.data.stats);
    return { items: res.data.events, pagination: res.data.pagination };
  }, [stats, debouncedSearch]);

  const { items: events, loading: eventsLoading, loadingMore, sentinelRef } = useInfiniteScroll(
    fetchEvents, { deps: [debouncedSearch] }
  );

  const loading = statsLoading && eventsLoading;

  if (loading) {
    return (
      <div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><Skeleton className="h-7 w-40 mb-1.5" /><Skeleton className="h-4 w-56" /></div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="mb-4 grid gap-2 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Card key={i}><CardContent className="p-3"><Skeleton className="h-12 w-full" /></CardContent></Card>)}
        </div>
        <Card><CardContent className="p-4"><Skeleton className="h-40 w-full" /></CardContent></Card>
      </div>
    );
  }

  const s = stats || {};
  const walkInStats = s.walkInStats || {};
  const totalAttendees = (s.totalCheckedIn || 0) + (s.totalWalkIns || 0);

  const statCards = [
    { label: 'Employees', value: s.totalEmployees, icon: Users, color: 'text-primary bg-primary-100' },
    { label: 'Active Events', value: s.activeEvents, icon: CalendarDays, color: 'text-ust-purple bg-ust-purple/10' },
    { label: 'Bookings', value: s.totalBookings, icon: Ticket, color: 'text-primary-700 bg-primary-50' },
    { label: 'Attended', value: totalAttendees, icon: UserCheck, color: 'text-green-700 bg-success-light' },
  ];

  const classificationCards = [
    { label: 'Checked In', value: s.totalCheckedIn || 0, icon: ScanLine, color: 'text-green-700 bg-green-50' },
    { label: 'Guests', value: walkInStats.guest || 0, icon: UsersRound, color: 'text-blue-700 bg-blue-50' },
    { label: 'Staff', value: walkInStats.staff || 0, icon: Building2, color: 'text-amber-700 bg-amber-50' },
    { label: 'Housekeeping', value: walkInStats.housekeeping || 0, icon: Users, color: 'text-purple-700 bg-purple-50' },
  ];

  return (
    <div>
      {/* ── Sticky top section: header + stats ── */}
      <div className="sticky top-12 sm:top-13 z-40 -mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6 pt-1 pb-3 bg-ust-gray-200/95 backdrop-blur-sm">
        {/* Header row */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">Admin Dashboard</h1>
            <p className="text-[11px] text-muted-foreground sm:text-xs">Manage events, bookings, and check-ins</p>
          </div>
          <Link to="/admin/create-event" className="no-underline shrink-0">
            <Button size="sm" className="gap-1.5 text-xs sm:text-sm sm:gap-2">
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Create Event</span>
              <span className="sm:hidden">New</span>
            </Button>
          </Link>
        </div>

        {/* Stat cards */}
        <div className="grid gap-2 grid-cols-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="shadow-none">
                <CardContent className="p-2 sm:p-3">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className={`rounded-md p-1 shrink-0 sm:rounded-lg sm:p-1.5 ${stat.color}`}>
                      <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground leading-tight sm:text-lg">{stat.value?.toLocaleString() || 0}</p>
                      <p className="text-[9px] text-muted-foreground truncate sm:text-[11px]">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Classification breakdown ── */}
      {totalAttendees > 0 && (
        <Card className="mt-3 mb-3">
          <CardHeader className="p-3 pb-2 sm:p-4 sm:pb-2">
            <CardTitle className="flex items-center gap-2 text-xs sm:text-sm">
              <UserPlus className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />
              Attendee Classification
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
            <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
              {classificationCards.map((stat) => {
                const Icon = stat.icon;
                const pct = totalAttendees > 0 ? Math.round((stat.value / totalAttendees) * 100) : 0;
                return (
                  <div key={stat.label} className="rounded-lg border p-2.5 sm:p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className={`rounded-md p-1 ${stat.color}`}>
                        <Icon className="h-3 w-3" />
                      </div>
                      <p className="text-[10px] text-muted-foreground sm:text-xs">{stat.label}</p>
                    </div>
                    <div className="flex items-end justify-between">
                      <p className="text-lg font-bold text-foreground">{stat.value}</p>
                      <p className="text-[10px] text-muted-foreground">{pct}%</p>
                    </div>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-ust-gray-300 sm:h-1.5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.3, duration: 0.5 }}
                        className="h-full rounded-full bg-primary"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {(walkInStats.unregistered_employee || 0) > 0 && (
              <div className="mt-2 flex items-center gap-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700 sm:text-xs">
                <UserPlus className="h-3 w-3 shrink-0" />
                {walkInStats.unregistered_employee} unregistered employee{walkInStats.unregistered_employee > 1 ? 's' : ''} via walk-in
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Events list with search ── */}
      <Card className={totalAttendees === 0 ? 'mt-3' : ''}>
        <CardHeader className="p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2 text-xs sm:text-sm shrink-0">
              <BarChart3 className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />
              Events
            </CardTitle>
            <div className="flex-1" />
            {/* Compact search */}
            <div className="relative w-36 sm:w-52">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                placeholder="Search events..."
                className="h-7 w-full rounded-full border border-ust-gray-400 bg-ust-gray-200 pl-7 pr-7 text-[11px] outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors sm:h-8 sm:pl-8 sm:text-xs"
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
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
          {events.length === 0 && !eventsLoading ? (
            <div className="flex flex-col items-center py-8">
              <p className="text-center text-xs text-muted-foreground sm:text-sm">
                {debouncedSearch ? `No events matching "${debouncedSearch}"` : 'No events yet. Create your first event!'}
              </p>
              {debouncedSearch && (
                <button onClick={() => setSearch('')} className="mt-1 text-xs text-primary underline cursor-pointer border-0 bg-transparent">
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {events.map((event, index) => (
                <motion.div
                  key={event._id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex flex-col gap-2 rounded-lg border p-2.5 sm:flex-row sm:items-center sm:justify-between sm:p-3"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-xs font-semibold text-foreground sm:text-sm">{event.title}</h3>
                      <Badge variant={
                        event.status === 'active' ? 'success' :
                        event.status === 'draft' ? 'secondary' :
                        'outline'
                      } className="text-[9px] sm:text-[10px]">
                        {event.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] text-muted-foreground sm:text-xs">
                      <span>{formatDate(event.eventDate)}</span>
                      <span>{event.venue}</span>
                    </div>

                    <div className="flex flex-wrap gap-1 mt-0.5">
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-primary-100 px-1.5 py-0.5 text-[9px] font-medium text-primary-700 sm:text-[11px]">
                        <Ticket className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> {event.bookingCount}
                      </span>
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-green-50 px-1.5 py-0.5 text-[9px] font-medium text-green-700 sm:text-[11px]">
                        <ScanLine className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> {event.checkedInCount}
                      </span>
                      {event.walkInCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 sm:text-[11px]">
                          <UserPlus className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> {event.walkInCount}
                        </span>
                      )}
                      {event.totalAttended > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-ust-gray-300 px-1.5 py-0.5 text-[9px] font-semibold text-foreground sm:text-[11px]">
                          <UserCheck className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> {event.totalAttended}
                        </span>
                      )}
                    </div>

                    {event.walkInCount > 0 && event.walkInBreakdown && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {[
                          { key: 'guest', label: 'Guests', color: 'text-blue-600 bg-blue-50' },
                          { key: 'staff', label: 'Staff', color: 'text-amber-600 bg-amber-50' },
                          { key: 'housekeeping', label: 'HK', color: 'text-purple-600 bg-purple-50' },
                          { key: 'unregistered_employee', label: 'Unreg', color: 'text-orange-600 bg-orange-50' },
                        ].filter(t => event.walkInBreakdown[t.key] > 0).map(t => (
                          <span key={t.key} className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-medium sm:text-[10px] ${t.color}`}>
                            {t.label}: {event.walkInBreakdown[t.key]}
                          </span>
                        ))}
                      </div>
                    )}

                    {event.bookingCount > 0 && event.maxCapacity > 0 && (
                      <div className="mt-1 h-1 w-full max-w-[160px] overflow-hidden rounded-full bg-ust-gray-300">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min((event.bookingCount / event.maxCapacity) * 100, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <Link to={`/admin/events/${event._id}`} className="no-underline shrink-0 self-start sm:self-center">
                    <Button variant="outline" size="sm" className="gap-1 w-full sm:w-auto text-[11px] h-7 sm:h-8 sm:text-xs">
                      <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      Manage
                    </Button>
                  </Link>
                </motion.div>
              ))}
              <LoadingMore ref={sentinelRef} loading={loadingMore} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
