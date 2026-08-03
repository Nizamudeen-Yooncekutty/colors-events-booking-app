import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users, CalendarDays, Ticket, ScanLine, Plus, BarChart3, Eye,
  UserPlus, UserCheck, Building2, UsersRound,
} from 'lucide-react';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/dashboard')
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><Skeleton className="h-7 w-40 mb-1.5" /><Skeleton className="h-4 w-56" /></div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="mb-5 grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Card key={i}><CardContent className="p-3 sm:p-4"><Skeleton className="h-14 w-full" /></CardContent></Card>)}
        </div>
        <Card><CardContent className="p-4"><Skeleton className="h-40 w-full" /></CardContent></Card>
      </div>
    );
  }

  const stats = data?.stats || {};
  const recentEvents = data?.recentEvents || [];
  const walkInStats = stats.walkInStats || {};

  const totalAttendees = (stats.totalCheckedIn || 0) + (stats.totalWalkIns || 0);

  const statCards = [
    { label: 'Total Employees', value: stats.totalEmployees, icon: Users, color: 'text-primary bg-primary-100' },
    { label: 'Active Events', value: stats.activeEvents, icon: CalendarDays, color: 'text-ust-purple bg-ust-purple/10' },
    { label: 'Total Bookings', value: stats.totalBookings, icon: Ticket, color: 'text-primary-700 bg-primary-50' },
    { label: 'Total Attended', value: totalAttendees, icon: UserCheck, color: 'text-green-700 bg-success-light' },
  ];

  const classificationCards = [
    { label: 'Employees (Checked In)', value: stats.totalCheckedIn || 0, icon: ScanLine, color: 'text-green-700 bg-green-50' },
    { label: 'Guests', value: walkInStats.guest || 0, icon: UsersRound, color: 'text-blue-700 bg-blue-50' },
    { label: 'Staff', value: walkInStats.staff || 0, icon: Building2, color: 'text-amber-700 bg-amber-50' },
    { label: 'Housekeeping', value: walkInStats.housekeeping || 0, icon: Users, color: 'text-purple-700 bg-purple-50' },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Admin Dashboard</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">Manage events, bookings, and check-ins</p>
        </div>
        <Link to="/admin/create-event" className="no-underline">
          <Button className="gap-2 w-full sm:w-auto text-sm">
            <Plus className="h-4 w-4" />
            Create Event
          </Button>
        </Link>
      </div>

      {/* Primary stats */}
      <div className="mb-5 grid gap-3 grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}>
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground truncate sm:text-xs">{stat.label}</p>
                      <p className="text-lg font-bold text-foreground sm:text-2xl">{stat.value?.toLocaleString() || 0}</p>
                    </div>
                    <div className={`rounded-lg p-2 shrink-0 sm:rounded-xl sm:p-2.5 ${stat.color}`}>
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Classification breakdown */}
      {totalAttendees > 0 && (
        <Card className="mb-5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <UserPlus className="h-4 w-4 text-primary" />
              Attendee Classification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              {classificationCards.map((stat, index) => {
                const Icon = stat.icon;
                const pct = totalAttendees > 0 ? Math.round((stat.value / totalAttendees) * 100) : 0;
                return (
                  <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + index * 0.06 }}>
                    <div className="rounded-lg border p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`rounded-md p-1.5 ${stat.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-[10px] text-muted-foreground sm:text-xs">{stat.label}</p>
                      </div>
                      <div className="flex items-end justify-between">
                        <p className="text-xl font-bold text-foreground">{stat.value}</p>
                        <p className="text-[10px] text-muted-foreground">{pct}%</p>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ust-gray-300">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: 0.5, duration: 0.6 }}
                          className="h-full rounded-full bg-primary"
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {(walkInStats.unregistered_employee || 0) > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <UserPlus className="h-3.5 w-3.5 shrink-0" />
                {walkInStats.unregistered_employee} unregistered employee{walkInStats.unregistered_employee > 1 ? 's' : ''} attended via walk-in
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <BarChart3 className="h-4 w-4 text-primary" />
            Recent Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentEvents.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8 sm:text-sm">No events yet. Create your first event!</p>
          ) : (
            <div className="space-y-3">
              {recentEvents.map((event, index) => (
                <motion.div
                  key={event._id}
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex flex-col gap-2.5 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xs font-semibold text-foreground sm:text-sm">{event.title}</h3>
                      <Badge variant={
                        event.status === 'active' ? 'success' :
                        event.status === 'draft' ? 'secondary' :
                        'outline'
                      } className="text-[10px]">
                        {event.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground sm:text-xs">
                      <span>{formatDate(event.eventDate)}</span>
                      <span>{event.bookingCount} bookings</span>
                      <span>{event.checkedInCount} checked in</span>
                      {event.walkInCount > 0 && (
                        <span className="text-amber-600">{event.walkInCount} walk-ins</span>
                      )}
                    </div>
                    {event.bookingCount > 0 && (
                      <div className="mt-1 h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-ust-gray-300">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{
                            width: `${event.maxCapacity > 0
                              ? Math.min((event.bookingCount / event.maxCapacity) * 100, 100)
                              : 50}%`
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <Link to={`/admin/events/${event._id}`} className="no-underline shrink-0">
                    <Button variant="outline" size="sm" className="gap-1.5 w-full sm:w-auto text-xs">
                      <Eye className="h-3.5 w-3.5" />
                      Manage
                    </Button>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
