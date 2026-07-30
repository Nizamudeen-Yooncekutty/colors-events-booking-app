import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { formatDate, isRegistrationOpen } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CalendarDays, MapPin, Users, UtensilsCrossed,
  CheckCircle2, XCircle, ArrowLeft, Ticket, Clock,
} from 'lucide-react';

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [userBooking, setUserBooking] = useState(null);
  const [selectedFood, setSelectedFood] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.get(`/events/${id}`)
      .then(res => {
        setEvent(res.data.event);
        setUserBooking(res.data.userBooking);
        if (res.data.event.foodOptions?.length > 0) {
          setSelectedFood(res.data.event.foodOptions[0].name);
        }
        const slots = res.data.event.timeSlots || [];
        const counts = res.data.event.slotCounts || {};
        if (slots.length > 0) {
          const firstAvailable = slots.find(s => s.maxCapacity === 0 || (counts[s._id] || 0) < s.maxCapacity);
          if (firstAvailable) setSelectedSlot(firstAvailable._id);
        }
      })
      .catch(() => navigate('/events'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleRegister = async () => {
    setError('');
    setRegistering(true);
    try {
      const payload = { eventId: id, foodPreference: selectedFood };
      if (selectedSlot) payload.timeSlotId = selectedSlot;
      const res = await api.post('/bookings', payload);
      setUserBooking(res.data.booking);
      setSuccess('Registration successful! Your QR pass is ready.');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setRegistering(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel your registration?')) return;
    try {
      await api.delete(`/bookings/${userBooking._id}`);
      setUserBooking(null);
      setSuccess('');
    } catch (err) {
      setError(err.response?.data?.message || 'Cancellation failed');
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <Skeleton className="mb-3 h-8 w-28" />
        <Card><div className="p-4 space-y-3"><Skeleton className="h-7 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-48 w-full" /></div></Card>
      </div>
    );
  }

  if (!event) return null;

  const regOpen = isRegistrationOpen(event.registrationStart, event.registrationEnd);
  const isFull = event.maxCapacity > 0 && event.bookingCount >= event.maxCapacity;

  return (
    <div className="mx-auto max-w-2xl">
      <Button variant="ghost" className="mb-3 gap-1.5 text-muted-foreground -ml-2 text-sm" onClick={() => navigate('/events')}>
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-primary to-ust-purple" />
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="text-lg sm:text-xl">{event.title}</CardTitle>
                <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">{event.description}</p>
              </div>
              <Badge variant={regOpen && !isFull ? 'success' : isFull ? 'destructive' : 'secondary'} className="shrink-0">
                {regOpen && !isFull ? 'Open' : isFull ? 'Full' : 'Closed'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Event info grid */}
            <div className="grid gap-2 grid-cols-1 xs:grid-cols-2">
              {[
                { icon: CalendarDays, label: 'Event Date', value: formatDate(event.eventDate) },
                { icon: MapPin, label: 'Venue', value: event.venue },
                { icon: Users, label: 'Registrations', value: `${event.bookingCount}${event.maxCapacity > 0 ? ` / ${event.maxCapacity}` : ''} registered` },
                { icon: CalendarDays, label: 'Registration Window', value: `${formatDate(event.registrationStart)} – ${formatDate(event.registrationEnd)}` },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-start gap-2.5 rounded-lg bg-ust-gray-200 p-2.5 sm:p-3">
                    <Icon className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground sm:text-xs">{item.label}</p>
                      <p className="text-xs font-medium text-foreground sm:text-sm break-words">{item.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Time Slots */}
            {event.timeSlots?.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold flex items-center gap-1.5 text-foreground sm:text-sm">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Available Time Slots
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {event.timeSlots.map((slot) => {
                    const booked = event.slotCounts?.[slot._id] || 0;
                    const slotFull = slot.maxCapacity > 0 && booked >= slot.maxCapacity;
                    return (
                      <div key={slot._id} className={`rounded-lg border px-3 py-2 bg-white ${slotFull ? 'border-error/30 opacity-70' : ''}`}>
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-foreground sm:text-sm">{slot.label}</p>
                          {slotFull && <Badge variant="destructive" className="text-[9px]">Full</Badge>}
                        </div>
                        <p className="text-[10px] text-muted-foreground sm:text-xs">{slot.startTime} – {slot.endTime}</p>
                        {slot.maxCapacity > 0 && (
                          <p className={`text-[10px] mt-0.5 ${slotFull ? 'text-error' : 'text-muted-foreground'}`}>
                            {booked} / {slot.maxCapacity} registered
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Food Options */}
            {event.foodOptions?.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold flex items-center gap-1.5 text-foreground sm:text-sm">
                  <UtensilsCrossed className="h-3.5 w-3.5 text-primary" />
                  Food Options
                </h3>
                <div className="flex flex-wrap gap-2">
                  {event.foodOptions.map((opt) => {
                    const count = event.foodBreakdown?.find(f => f._id === opt.name)?.count || 0;
                    return (
                      <div key={opt._id} className="rounded-lg border px-3 py-2 bg-white min-w-[80px]">
                        <p className="text-xs font-medium text-foreground sm:text-sm">{opt.name}</p>
                        {opt.description && (
                          <p className="text-[10px] text-muted-foreground">{opt.description}</p>
                        )}
                        {count > 0 && (
                          <p className="text-[10px] text-primary font-medium mt-0.5">{count} selected</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Messages */}
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="flex items-start gap-2 rounded-md bg-error-light p-3 text-xs text-error sm:text-sm">
                  <XCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{error}</span>
                </motion.div>
              )}
              {success && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="flex items-start gap-2 rounded-md bg-success-light p-3 text-xs text-green-700 sm:text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /><span>{success}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Registration section */}
            {userBooking ? (
              <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                className="rounded-lg border-2 border-primary/20 bg-primary-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-primary">You're registered!</h3>
                </div>
                <div className="space-y-1 text-xs sm:text-sm">
                  {userBooking.timeSlotLabel && (
                    <p className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-primary" />
                      <span className="text-muted-foreground">Slot:</span> {userBooking.timeSlotLabel}
                    </p>
                  )}
                  <p><span className="text-muted-foreground">Food:</span> {userBooking.foodPreference}</p>
                  <p className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={userBooking.status === 'checked_in' ? 'success' : 'default'} className="text-[10px]">
                      {userBooking.status.replace('_', ' ')}
                    </Badge>
                  </p>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Button className="gap-2 text-sm" onClick={() => navigate(`/my-bookings/${userBooking._id}`)}>
                    <Ticket className="h-4 w-4" />
                    View QR Pass
                  </Button>
                  {userBooking.status !== 'checked_in' && (
                    <Button variant="outline" className="text-error hover:bg-error-light text-sm" onClick={handleCancel}>
                      Cancel
                    </Button>
                  )}
                </div>
              </motion.div>
            ) : regOpen && !isFull ? (
              <div className="rounded-lg border p-4 bg-white">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Register for this Event</h3>
                {event.timeSlots?.length > 0 && (
                  <div className="mb-3">
                    <p className="mb-2 text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-primary" />
                      Choose your time slot
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {event.timeSlots.map((slot) => {
                        const booked = event.slotCounts?.[slot._id] || 0;
                        const slotFull = slot.maxCapacity > 0 && booked >= slot.maxCapacity;
                        return (
                          <button
                            key={slot._id}
                            type="button"
                            disabled={slotFull}
                            onClick={() => !slotFull && setSelectedSlot(slot._id)}
                            className={`rounded-md border-2 px-3 py-2.5 text-left transition-all ${
                              slotFull
                                ? 'border-border bg-ust-gray-200 opacity-60 cursor-not-allowed'
                                : selectedSlot === slot._id
                                  ? 'border-primary bg-primary-50 text-primary cursor-pointer'
                                  : 'border-border bg-transparent hover:border-primary/40 text-foreground cursor-pointer'
                            }`}
                          >
                            <span className="text-xs font-medium sm:text-sm">{slot.label}</span>
                            <span className="block text-[10px] text-muted-foreground mt-0.5">
                              {slot.startTime} – {slot.endTime}
                              {slot.maxCapacity > 0 && (
                                <span className={`ml-1.5 ${slotFull ? 'text-error font-medium' : ''}`}>
                                  ({booked}/{slot.maxCapacity}{slotFull ? ' — Full' : ''})
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {event.foodOptions?.length > 0 && (
                  <div className="mb-3">
                    <p className="mb-2 text-xs font-medium text-foreground flex items-center gap-1.5">
                      <UtensilsCrossed className="h-3 w-3 text-primary" />
                      Choose your food preference
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                      {event.foodOptions.map((opt) => (
                        <button
                          key={opt._id}
                          onClick={() => setSelectedFood(opt.name)}
                          className={`rounded-md border-2 px-3 py-2 text-xs font-medium transition-all cursor-pointer text-left sm:text-sm ${
                            selectedFood === opt.name
                              ? 'border-primary bg-primary-50 text-primary'
                              : 'border-border bg-transparent hover:border-primary/40 text-foreground'
                          }`}
                        >
                          {opt.name}
                          {opt.description && (
                            <span className="block text-[10px] font-normal text-muted-foreground mt-0.5">{opt.description}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <Button size="lg" className="w-full gap-2 text-sm" onClick={handleRegister} disabled={registering || (event.timeSlots?.length > 0 && !selectedSlot)}>
                  {registering ? (
                    <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Registering...</>
                  ) : (
                    <><Ticket className="h-4 w-4" />Register & Get QR Pass</>
                  )}
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-5 text-center text-xs text-muted-foreground bg-white sm:text-sm">
                {isFull ? 'This event is fully booked.' : 'Registration is currently closed for this event.'}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
