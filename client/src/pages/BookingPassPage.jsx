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

const SLOT_COLOR_MAP = {
  '#6A1B9A': { bg: '#F3E5F5', border: '#CE93D8', gradient: 'from-[#6A1B9A] to-[#8E24AA]', label: 'text-purple-700', labelBg: 'bg-purple-50' },
  '#1565C0': { bg: '#E3F2FD', border: '#90CAF9', gradient: 'from-[#1565C0] to-[#1E88E5]', label: 'text-blue-700', labelBg: 'bg-blue-50' },
  '#2E7D32': { bg: '#E8F5E9', border: '#A5D6A7', gradient: 'from-[#2E7D32] to-[#43A047]', label: 'text-green-700', labelBg: 'bg-green-50' },
  '#E65100': { bg: '#FFF3E0', border: '#FFCC80', gradient: 'from-[#E65100] to-[#F57C00]', label: 'text-orange-700', labelBg: 'bg-orange-50' },
  '#C62828': { bg: '#FFEBEE', border: '#EF9A9A', gradient: 'from-[#C62828] to-[#E53935]', label: 'text-red-700', labelBg: 'bg-red-50' },
};

function getSlotTheme(slotColor) {
  if (slotColor && SLOT_COLOR_MAP[slotColor]) return SLOT_COLOR_MAP[slotColor];
  return { bg: '#F5F5F5', border: '#E0E0E0', gradient: 'from-primary to-primary-800', label: 'text-gray-700', labelBg: 'bg-gray-50' };
}

export default function BookingPassPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let retryTimer = null;

    const fetchBooking = () => {
      api.get(`/bookings/${id}`)
        .then(res => {
          setBooking(res.data.booking);
          // If QR not ready yet, retry in 2 seconds
          if (!res.data.booking.qrCode) {
            retryTimer = setTimeout(fetchBooking, 2000);
          }
        })
        .catch(() => navigate('/my-bookings'))
        .finally(() => setLoading(false));
    };

    fetchBooking();
    return () => { if (retryTimer) clearTimeout(retryTimer); };
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

  const theme = getSlotTheme(booking.slotColor);

  const passDetails = [
    { icon: User, label: 'Name', value: booking.employee?.name },
    { icon: Hash, label: 'Employee ID', value: booking.employee?.employeeId },
    { icon: Building2, label: 'Department', value: booking.employee?.department || '—' },
    { icon: CalendarDays, label: 'Event Date', value: formatDate(booking.event?.eventDate) },
    { icon: MapPin, label: 'Venue', value: booking.event?.venue },
    ...(booking.timeSlotLabel ? [{
      icon: Clock,
      label: 'Time Slot',
      value: (() => {
        const slot = booking.event?.timeSlots?.find(s => s._id === booking.timeSlot?.toString() || s._id?.toString() === booking.timeSlot?.toString());
        return slot ? `${booking.timeSlotLabel} (${slot.startTime} – ${slot.endTime})` : booking.timeSlotLabel;
      })(),
    }] : []),
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
          {/* Header - colored by slot */}
          <div className={`bg-gradient-to-r ${theme.gradient} px-4 py-4 text-center text-white sm:px-6 sm:py-5`}>
            <h2 className="text-base font-bold sm:text-lg">{booking.event?.title}</h2>
            <p className="mt-0.5 text-[10px] text-white/80 sm:text-xs">Digital Event Token</p>
            {booking.timeSlotLabel && (() => {
              const slot = booking.event?.timeSlots?.find(s => s._id === booking.timeSlot?.toString() || s._id?.toString() === booking.timeSlot?.toString());
              return (
                <span className="mt-2 inline-block rounded-full bg-white/20 px-3 py-0.5 text-[10px] font-medium backdrop-blur-sm sm:text-xs">
                  {booking.timeSlotLabel}{slot ? ` · ${slot.startTime} – ${slot.endTime}` : ''}
                </span>
              );
            })()}
          </div>

          <CardContent className="p-4 sm:p-5">
            {/* QR Code with slot-colored border */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
              className="mb-4 flex justify-center"
            >
              <div
                className="rounded-xl p-2.5 sm:p-3"
                style={{
                  backgroundColor: theme.bg,
                  border: `3px solid ${theme.border}`,
                }}
              >
                {booking.qrCode ? (
                  <img src={booking.qrCode} alt="QR Pass" className="h-36 w-36 sm:h-44 sm:w-44" />
                ) : (
                  <div className="h-36 w-36 sm:h-44 sm:w-44 flex flex-col items-center justify-center bg-ust-gray-200 rounded-lg">
                    <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent mb-2" />
                    <p className="text-[10px] text-muted-foreground sm:text-xs">Generating QR...</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Slot color indicator */}
            {booking.slotColor && booking.timeSlotLabel && (
              <div className="mb-3 flex items-center justify-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: booking.slotColor }}
                />
                <span className="text-[10px] font-medium text-muted-foreground sm:text-xs">
                  {booking.timeSlotLabel}
                </span>
              </div>
            )}

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

            <div className="mt-3 flex justify-center">
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-2.5 py-0.5 shadow-sm">
                <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" /></svg>
                <span className="text-[9px] text-white sm:text-[10px]">Powered by Color <span className="font-bold">Orange</span></span>
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
