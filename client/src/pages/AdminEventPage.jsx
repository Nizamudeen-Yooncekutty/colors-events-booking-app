import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, Users, ScanLine, Ticket, Search,
  UtensilsCrossed, Download, Pencil, Trash2, Clock,
} from 'lucide-react';

export default function AdminEventPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState({});
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSlot, setFilterSlot] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [eventRes, bookingsRes] = await Promise.all([
        api.get(`/events/${eventId}`),
        api.get(`/admin/events/${eventId}/bookings`, {
          params: { search, status: filterStatus, slot: filterSlot || undefined },
        }),
      ]);
      setEvent(eventRes.data.event);
      setBookings(bookingsRes.data.bookings);
      setStats(bookingsRes.data.stats);
    } catch {
      console.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [eventId]);

  useEffect(() => {
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [search, filterStatus, filterSlot]);

  const exportCSV = () => {
    const hasSlots = event?.timeSlots?.length > 0;
    const headers = ['Employee ID', 'Name', 'Email', 'Department', ...(hasSlots ? ['Time Slot'] : []), 'Food Preference', 'Status', 'Registered At'];
    const rows = bookings.map(b => [
      b.employee?.employeeId,
      b.employee?.name,
      b.employee?.email,
      b.employee?.department,
      ...(hasSlots ? [b.timeSlotLabel || ''] : []),
      b.foodPreference,
      b.status,
      new Date(b.createdAt).toISOString(),
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event?.title || 'bookings'}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div>
        <Skeleton className="mb-3 h-8 w-24" />
        <Skeleton className="h-6 w-52 mb-1.5" />
        <Skeleton className="h-4 w-36 mb-5" />
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-5">
          {[1, 2, 3, 4].map(i => <Card key={i}><CardContent className="p-3"><Skeleton className="h-12 w-full" /></CardContent></Card>)}
        </div>
        <Card><CardContent className="p-4"><Skeleton className="h-48 w-full" /></CardContent></Card>
      </div>
    );
  }

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${event?.title}"?\n\nThis will cancel all ${stats.total || 0} bookings for this event. This action cannot be undone.`
    );
    if (!confirmed) return;
    try {
      await api.delete(`/events/${eventId}`);
      navigate('/admin');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete event');
    }
  };

  const statusVariant = (status) => {
    switch (status) {
      case 'confirmed': return 'default';
      case 'checked_in': return 'success';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <div>
      <Button variant="ghost" className="mb-3 gap-1.5 text-muted-foreground -ml-2 text-sm" onClick={() => navigate('/admin')}>
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{event?.title}</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">{formatDate(event?.eventDate)} &middot; {event?.venue}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" className="gap-1.5 text-xs sm:text-sm" onClick={() => navigate(`/admin/events/${eventId}/edit`)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit Event
          </Button>
          <Button variant="outline" className="gap-1.5 text-xs text-error hover:bg-error-light sm:text-sm" onClick={handleDelete}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-4 grid gap-3 grid-cols-2 sm:grid-cols-4">
        {[
          { label: 'Total', value: stats.total, icon: Ticket, color: 'text-primary bg-primary-100' },
          { label: 'Confirmed', value: stats.confirmed, icon: Users, color: 'text-primary-700 bg-primary-50' },
          { label: 'Checked In', value: stats.checkedIn, icon: ScanLine, color: 'text-green-700 bg-success-light' },
          { label: 'Cancelled', value: stats.cancelled, icon: Users, color: 'text-error bg-error-light' },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card>
                <CardContent className="flex items-center gap-2.5 p-3 sm:gap-3 sm:p-4">
                  <div className={`rounded-lg p-1.5 sm:p-2 ${s.color}`}><Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></div>
                  <div>
                    <p className="text-lg font-bold text-foreground sm:text-xl">{s.value || 0}</p>
                    <p className="text-[10px] text-muted-foreground sm:text-xs">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Slot breakdown */}
      {event?.timeSlots?.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs sm:text-sm">
              <Clock className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />
              Time Slot Availability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {event.timeSlots.map(slot => {
                const booked = event.slotCounts?.[slot._id] || 0;
                const isFull = slot.maxCapacity > 0 && booked >= slot.maxCapacity;
                return (
                  <div key={slot._id} className={`rounded-md border px-3 py-1.5 text-center bg-white sm:px-4 sm:py-2 ${isFull ? 'border-error/40' : ''}`}>
                    <p className={`text-base font-bold sm:text-lg ${isFull ? 'text-error' : 'text-primary'}`}>
                      {booked}{slot.maxCapacity > 0 ? `/${slot.maxCapacity}` : ''}
                    </p>
                    <p className="text-[10px] text-muted-foreground sm:text-xs">{slot.label}</p>
                    <p className="text-[9px] text-muted-foreground">{slot.startTime} – {slot.endTime}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Food breakdown */}
      {event?.foodBreakdown?.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs sm:text-sm">
              <UtensilsCrossed className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />
              Food Preference Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {event.foodBreakdown.map(item => (
                <div key={item._id} className="rounded-md border px-3 py-1.5 text-center bg-white sm:px-4 sm:py-2">
                  <p className="text-base font-bold text-primary sm:text-lg">{item.count}</p>
                  <p className="text-[10px] text-muted-foreground sm:text-xs">{item._id}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bookings */}
      <Card>
        <CardHeader className="p-3 sm:p-5">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-xs sm:text-sm">Bookings ({bookings.length})</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search name or ID..."
                  className="pl-8 border-ust-gray-400 h-8 text-xs sm:h-9 sm:text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="h-8 flex-1 rounded-md border border-ust-gray-400 bg-ust-gray-200 px-2 text-xs sm:h-9 sm:flex-none sm:px-3 sm:text-sm"
                >
                  <option value="">All Status</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="checked_in">Checked In</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                {event?.timeSlots?.length > 0 && (
                  <select
                    value={filterSlot}
                    onChange={(e) => setFilterSlot(e.target.value)}
                    className="h-8 flex-1 rounded-md border border-ust-gray-400 bg-ust-gray-200 px-2 text-xs sm:h-9 sm:flex-none sm:px-3 sm:text-sm"
                  >
                    <option value="">All Slots</option>
                    {event.timeSlots.map(s => (
                      <option key={s._id} value={s._id}>{s.label}</option>
                    ))}
                  </select>
                )}
                <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs sm:h-9" onClick={exportCSV}>
                  <Download className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  CSV
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-ust-gray-200">
                  <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Employee</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Department</th>
                  {event?.timeSlots?.length > 0 && (
                    <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Slot</th>
                  )}
                  <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Food</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Registered</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b, i) => (
                  <motion.tr
                    key={b._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b last:border-0 hover:bg-ust-gray-200 transition-colors"
                  >
                    <td className="py-2 px-3">
                      <p className="font-medium text-foreground text-sm">{b.employee?.name}</p>
                      <p className="text-xs text-muted-foreground">{b.employee?.employeeId}</p>
                    </td>
                    <td className="py-2 px-3 text-sm text-muted-foreground">{b.employee?.department || '—'}</td>
                    {event?.timeSlots?.length > 0 && (
                      <td className="py-2 px-3 text-sm text-muted-foreground">{b.timeSlotLabel || '—'}</td>
                    )}
                    <td className="py-2 px-3 text-sm">{b.foodPreference}</td>
                    <td className="py-2 px-3">
                      <Badge variant={statusVariant(b.status)} className="text-[10px]">{b.status.replace('_', ' ')}</Badge>
                    </td>
                    <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(b.createdAt)}</td>
                  </motion.tr>
                ))}
                {bookings.length === 0 && (
                  <tr><td colSpan={event?.timeSlots?.length > 0 ? 6 : 5} className="py-8 text-center text-sm text-muted-foreground">No bookings found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2.5 sm:hidden">
            {bookings.map((b) => (
              <div key={b._id} className="rounded-lg border p-2.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{b.employee?.name}</p>
                    <p className="text-[10px] text-muted-foreground">{b.employee?.employeeId}</p>
                  </div>
                  <Badge variant={statusVariant(b.status)} className="text-[10px] shrink-0">{b.status.replace('_', ' ')}</Badge>
                </div>
                <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span>{b.employee?.department || '—'}</span>
                  {b.timeSlotLabel && <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{b.timeSlotLabel}</span>}
                  <span>{b.foodPreference}</span>
                  <span>{formatDateTime(b.createdAt)}</span>
                </div>
              </div>
            ))}
            {bookings.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">No bookings found</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
