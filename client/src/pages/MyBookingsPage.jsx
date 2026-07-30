import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, MapPin, Ticket, UtensilsCrossed, QrCode } from 'lucide-react';

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/bookings/my')
      .then(res => setBookings(res.data.bookings))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <div className="mb-5"><Skeleton className="h-7 w-36 mb-1.5" /><Skeleton className="h-4 w-56" /></div>
        <div className="space-y-3">{[1, 2].map(i => <Card key={i}><div className="p-4"><Skeleton className="h-14 w-full" /></div></Card>)}</div>
      </div>
    );
  }

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
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">My Bookings</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">Your event registrations and QR passes</p>
      </div>

      {bookings.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center rounded-xl bg-white px-4 py-16 text-center">
          <Ticket className="mb-3 h-12 w-12 text-ust-gray-400" />
          <p className="text-sm font-medium text-ust-gray-700">No bookings yet</p>
          <Link to="/events" className="no-underline">
            <Button className="mt-3 gap-2 text-sm"><CalendarDays className="h-4 w-4" />Browse Events</Button>
          </Link>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking, index) => (
            <motion.div
              key={booking._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-foreground truncate">{booking.event?.title || 'Event'}</h3>
                        <Badge variant={statusVariant(booking.status)} className="text-[10px] shrink-0">
                          {booking.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3 text-primary" />
                          {booking.event?.eventDate ? formatDate(booking.event.eventDate) : '—'}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-primary" />
                          <span className="truncate max-w-[120px] sm:max-w-none">{booking.event?.venue || '—'}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <UtensilsCrossed className="h-3 w-3 text-primary" />
                          {booking.foodPreference}
                        </span>
                      </div>
                    </div>
                    {booking.status !== 'cancelled' && (
                      <Link to={`/my-bookings/${booking._id}`} className="no-underline shrink-0">
                        <Button variant="outline" className="gap-2 w-full sm:w-auto text-sm">
                          <QrCode className="h-4 w-4" />
                          View Pass
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
