import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, CalendarDays, MapPin, UtensilsCrossed,
  User, Hash, CheckCircle2, Building2, Clock,
} from 'lucide-react';

export default function BookingPassPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/bookings/${id}`)
      .then(res => setBooking(res.data.booking))
      .catch(() => navigate('/my-bookings'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[360px]">
        <Skeleton className="mb-3 h-8 w-28" />
        <Card><div className="p-4"><Skeleton className="h-80 w-full" /></div></Card>
      </div>
    );
  }

  if (!booking) return null;

  const passDetails = [
    { icon: User, label: 'Name', value: booking.employee?.name },
    { icon: Hash, label: 'Employee ID', value: booking.employee?.employeeId },
    { icon: Building2, label: 'Department', value: booking.employee?.department || '—' },
    { icon: CalendarDays, label: 'Event Date', value: formatDate(booking.event?.eventDate) },
    { icon: MapPin, label: 'Venue', value: booking.event?.venue },
    ...(booking.timeSlotLabel ? [{ icon: Clock, label: 'Time Slot', value: booking.timeSlotLabel }] : []),
    { icon: UtensilsCrossed, label: 'Food', value: booking.foodPreference },
  ];

  return (
    <div className="mx-auto max-w-[360px]">
      <Button variant="ghost" className="mb-3 gap-1.5 text-muted-foreground -ml-2 text-sm" onClick={() => navigate('/my-bookings')}>
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
      >
        <Card className="overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-primary-800 px-4 py-4 text-center text-white sm:px-6 sm:py-5">
            <h2 className="text-base font-bold sm:text-lg">{booking.event?.title}</h2>
            <p className="mt-0.5 text-[10px] text-white/80 sm:text-xs">Digital Event Pass</p>
          </div>

          <CardContent className="p-4 sm:p-5">
            {/* QR Code */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
              className="mb-4 flex justify-center"
            >
              <div className="rounded-xl border-2 border-border bg-white p-2.5 sm:p-3">
                <img src={booking.qrCode} alt="QR Pass" className="h-36 w-36 sm:h-44 sm:w-44" />
              </div>
            </motion.div>

            {/* Pass Code */}
            {booking.qrData && (
              <div className="mb-4 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">Pass Code</p>
                <code className="inline-block rounded-md bg-ust-gray-200 px-2.5 py-1 text-[10px] font-mono font-medium text-foreground select-all tracking-wide break-all sm:text-xs">
                  {booking.qrData}
                </code>
              </div>
            )}

            {booking.status === 'checked_in' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="mb-3 flex items-center justify-center gap-1.5 rounded-md bg-success-light p-2 text-xs font-semibold text-green-700 sm:text-sm">
                <CheckCircle2 className="h-4 w-4" />
                Checked In
              </motion.div>
            )}

            {/* Details */}
            <div className="space-y-2">
              {passDetails.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-2.5 rounded-md bg-ust-gray-200 p-2 sm:p-2.5">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                    <p className="text-xs font-medium text-foreground truncate sm:text-sm">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-center">
              <Badge variant={booking.status === 'checked_in' ? 'success' : 'default'} className="text-[10px]">
                {booking.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>

            <p className="mt-3 text-center text-[10px] text-muted-foreground sm:text-xs">
              Show this QR code at the venue for entry
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
