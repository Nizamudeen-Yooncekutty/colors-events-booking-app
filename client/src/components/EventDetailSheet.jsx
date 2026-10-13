import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatDate, isRegistrationOpen } from '@/lib/utils';
import {
  Sheet, SheetContent, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CalendarDays, MapPin, Users, UtensilsCrossed,
  CheckCircle2, XCircle, Ticket, ChevronLeft, ChevronRight, X, Clock,
} from 'lucide-react';

export default function EventDetailSheet({
  open,
  onOpenChange,
  eventId,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}) {
  const navigate = useNavigate();
  const { employee: currentUser } = useAuth();
  const [event, setEvent] = useState(null);
  const [userBooking, setUserBooking] = useState(null);
  const [selectedFood, setSelectedFood] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [adminEmpId, setAdminEmpId] = useState('');
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (!eventId || !open) return;
    setLoading(true);
    setError('');
    setSuccess('');
    setSelectedSlot('');
    api.get(`/events/${eventId}`)
      .then(res => {
        setEvent(res.data.event);
        setUserBooking(res.data.userBooking);
        setSelectedFood('');
        const slots = res.data.event.timeSlots || [];
        const counts = res.data.event.slotCounts || {};
        if (slots.length > 0) {
          const firstAvailable = slots.find(s => s.maxCapacity === 0 || (counts[s._id] || 0) < s.maxCapacity);
          if (firstAvailable) setSelectedSlot(firstAvailable._id);
        }
      })
      .catch(() => onOpenChange(false))
      .finally(() => setLoading(false));
  }, [eventId, open]);

  const handleRegister = async () => {
    const errors = {};
    if (event.foodOptions?.length > 0 && !selectedFood) {
      errors.food = 'Please select a food preference';
    }
    if (event.timeSlots?.length > 0 && !selectedSlot) {
      errors.slot = 'Please select a time slot';
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setError('');
    setRegistering(true);
    try {
      const payload = { eventId, foodPreference: selectedFood };
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
    if (!window.confirm('Cancel your registration?')) return;
    try {
      await api.delete(`/bookings/${userBooking._id}`);
      setUserBooking(null);
      setSuccess('');
    } catch (err) {
      setError(err.response?.data?.message || 'Cancellation failed');
    }
  };

  const regOpen = event && isRegistrationOpen(event.registrationStart, event.registrationEnd);
  const isFull = event && event.maxCapacity > 0 && event.bookingCount >= event.maxCapacity;
  const eventDay = event ? new Date(event.eventDate) : new Date();
  const eventNotPassed = new Date(eventDay.getFullYear(), eventDay.getMonth(), eventDay.getDate()) >= new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const showAdminRegister = currentUser?.role === 'admin' && !regOpen && eventNotPassed && !userBooking;

  const handleAdminRegister = async () => {
    const errors = {};
    if (!adminEmpId.trim()) errors.empId = 'Employee ID is required';
    if (event.foodOptions?.length > 0 && !selectedFood) errors.food = 'Please select food preference';
    if (event.timeSlots?.length > 0 && !selectedSlot) errors.slot = 'Please select a time slot';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setError('');
    setRegistering(true);
    try {
      const payload = { eventId, employeeId: adminEmpId.trim(), foodPreference: selectedFood };
      if (selectedSlot) payload.timeSlotId = selectedSlot;
      const res = await api.post('/admin/register-employee', payload);
      setSuccess(`${res.data.booking?.employee?.name || adminEmpId.trim().toUpperCase()} has been registered successfully.`);
      setAdminEmpId('');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        hideClose
        className="!w-full sm:!w-[480px] sm:!max-w-none h-full p-0 gap-0 bg-white flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-ust-gray-300 shrink-0 xl:px-5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-md p-1.5 hover:bg-ust-gray-300 transition-colors cursor-pointer border-0 bg-transparent"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
            <SheetTitle className="text-sm font-semibold text-foreground truncate">
              {loading ? 'Loading...' : event?.title || 'Event Details'}
            </SheetTitle>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onPrev}
              disabled={!hasPrev}
              className="rounded-md p-1.5 hover:bg-ust-gray-300 transition-colors cursor-pointer border-0 bg-transparent disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={onNext}
              disabled={!hasNext}
              className="rounded-md p-1.5 hover:bg-ust-gray-300 transition-colors cursor-pointer border-0 bg-transparent disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <SheetDescription className="sr-only">Event details and registration</SheetDescription>

        {/* Body */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {loading ? (
            <div className="p-4 space-y-4 xl:p-5">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : event ? (
            <>
              {/* Banner */}
              <div className="bg-gradient-to-r from-primary to-primary-800 px-4 py-5 xl:px-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-white sm:text-lg">{event.title}</h2>
                    <p className="mt-1 text-xs text-white/70">{event.description}</p>
                  </div>
                  <Badge
                    variant={regOpen && !isFull ? 'success' : isFull ? 'destructive' : 'secondary'}
                    className="shrink-0"
                  >
                    {regOpen && !isFull ? 'Open' : isFull ? 'Full' : 'Closed'}
                  </Badge>
                </div>
              </div>

              <div className="p-4 xl:p-5 space-y-4">
                {/* Event info */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: CalendarDays, label: 'Event Date', value: formatDate(event.eventDate) },
                    { icon: MapPin, label: 'Venue', value: event.venue },
                    ...(event.location ? [{ icon: MapPin, label: 'Location', value: event.location }] : []),
                    { icon: Users, label: 'Registrations', value: `${event.bookingCount}${event.maxCapacity > 0 ? ` / ${event.maxCapacity}` : ''}` },
                    { icon: CalendarDays, label: 'Reg. Window', value: `${formatDate(event.registrationStart)} – ${formatDate(event.registrationEnd)}` },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex items-start gap-2 rounded-lg bg-ust-gray-200 p-2.5">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-[10px] text-muted-foreground">{item.label}</p>
                          <p className="text-xs font-medium text-foreground break-words">{item.value}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Capacity bar */}
                {event.maxCapacity > 0 && (
                  <div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Capacity</span>
                      <span>{event.bookingCount} / {event.maxCapacity}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-ust-gray-300">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min((event.bookingCount / event.maxCapacity) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                <Separator />

                {/* Time Slots info */}
                {event.timeSlots?.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold flex items-center gap-1.5 text-foreground">
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
                              <p className="text-xs font-medium text-foreground">{slot.label}</p>
                              {slotFull && <Badge variant="destructive" className="text-[9px]">Full</Badge>}
                            </div>
                            <p className="text-[10px] text-muted-foreground">{slot.startTime} – {slot.endTime}</p>
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

                {/* Food Options info */}
                {event.foodOptions?.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold flex items-center gap-1.5 text-foreground">
                      <UtensilsCrossed className="h-3.5 w-3.5 text-primary" />
                      Food Options
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {event.foodOptions.map((opt) => {
                        const count = event.foodBreakdown?.find(f => f._id === opt.name)?.count || 0;
                        return (
                          <div key={opt._id} className="rounded-lg border px-3 py-2 bg-white min-w-[80px]">
                            <p className="text-xs font-medium text-foreground">{opt.name}</p>
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
                      className="flex items-start gap-2 rounded-md bg-error-light p-3 text-xs text-error">
                      <XCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{error}</span>
                    </motion.div>
                  )}
                  {success && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="flex items-start gap-2 rounded-md bg-success-light p-3 text-xs text-green-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /><span>{success}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer — Registration actions */}
        {!loading && event && (
          <div className="shrink-0 bg-white border-t border-ust-gray-300 px-4 py-3 xl:px-5">
            {userBooking ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 rounded-lg bg-primary-50 p-3 border border-primary/20">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-primary">You're registered!</p>
                    <p className="text-[11px] text-muted-foreground">
                      {userBooking.timeSlotLabel && (
                        <span>Slot: {userBooking.timeSlotLabel} &middot; </span>
                      )}
                      Food: {userBooking.foodPreference} &middot;
                      <Badge variant={userBooking.status === 'checked_in' ? 'success' : 'default'} className="text-[10px] ml-1.5">
                        {userBooking.status.replace('_', ' ')}
                      </Badge>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1 gap-2 text-sm" onClick={() => { onOpenChange(false); navigate(`/my-bookings/${userBooking._id}`); }}>
                    <Ticket className="h-4 w-4" />
                    View QR Pass
                  </Button>
                </div>
              </div>
            ) : regOpen && !isFull ? (
              <div className="space-y-2.5">
                {/* Food preference picker — shown first */}
                {event.foodOptions?.length > 0 && (
                  <div className={`rounded-lg p-2.5 ${formErrors.food ? 'bg-red-50 border-2 border-error' : !selectedFood ? 'bg-amber-50 border-2 border-amber-200' : 'bg-ust-gray-200'}`}>
                    <p className="mb-1.5 text-xs font-semibold text-foreground flex items-center gap-1">
                      <UtensilsCrossed className="h-3.5 w-3.5 text-primary" />
                      Select food preference <span className="text-error">*</span>
                    </p>
                    {!selectedFood && (
                      <p className="mb-1.5 text-[10px] text-amber-700">Please select one option</p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {event.foodOptions.map((opt) => (
                        <button
                          key={opt._id}
                          onClick={() => { setSelectedFood(opt.name); setFormErrors(e => ({ ...e, food: '' })); }}
                          className={`rounded-full border-2 px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                            selectedFood === opt.name
                              ? 'border-primary bg-primary-50 text-primary'
                              : 'border-border bg-white hover:border-primary/40 text-foreground'
                          }`}
                        >
                          {opt.name}
                        </button>
                      ))}
                    </div>
                    {formErrors.food && (
                      <p className="text-error text-[10px] font-medium mt-1">{formErrors.food}</p>
                    )}
                  </div>
                )}

                {/* Time slot picker */}
                {event.timeSlots?.length > 0 && (
                  <div className={`rounded-lg p-2.5 ${formErrors.slot ? 'bg-red-50 border-2 border-error' : 'bg-ust-gray-200'}`}>
                    <p className="mb-1.5 text-xs font-semibold text-foreground flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      Choose time slot <span className="text-error">*</span>
                    </p>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {event.timeSlots.map((slot) => {
                        const booked = event.slotCounts?.[slot._id] || 0;
                        const slotFull = slot.maxCapacity > 0 && booked >= slot.maxCapacity;
                        return (
                          <button
                            key={slot._id}
                            type="button"
                            disabled={slotFull}
                            onClick={() => { if (!slotFull) { setSelectedSlot(slot._id); setFormErrors(e => ({ ...e, slot: '' })); } }}
                            className={`rounded-md border-2 px-2.5 py-2 text-left transition-all ${
                              slotFull
                                ? 'border-border bg-ust-gray-200 opacity-60 cursor-not-allowed'
                                : selectedSlot === slot._id
                                  ? 'border-primary bg-primary-50 text-primary cursor-pointer'
                                  : 'border-border bg-white hover:border-primary/40 text-foreground cursor-pointer'
                            }`}
                          >
                            <span className="text-xs font-medium">{slot.label}</span>
                            <span className="block text-[10px] text-muted-foreground mt-0.5">
                              {slot.startTime} – {slot.endTime}
                              {slot.maxCapacity > 0 && (
                                <span className={`ml-1 ${slotFull ? 'text-error font-medium' : ''}`}>
                                  ({booked}/{slot.maxCapacity}{slotFull ? ' — Full' : ''})
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {formErrors.slot && (
                      <p className="text-error text-[10px] font-medium mt-1">{formErrors.slot}</p>
                    )}
                  </div>
                )}

                <Button
                  className="w-full gap-2 text-sm"
                  onClick={handleRegister}
                  disabled={registering}
                >
                  {registering ? (
                    <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Registering...</>
                  ) : (
                    <><Ticket className="h-4 w-4" />Register & Get QR Pass</>
                  )}
                </Button>
              </div>
            ) : showAdminRegister ? (
              <div className="space-y-2.5">
                {error && (
                  <div className="flex items-start gap-2 rounded-md bg-error-light p-2.5 text-xs text-error">
                    <XCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{error}</span>
                  </div>
                )}
                {success && (
                  <div className="flex items-start gap-2 rounded-md bg-success-light p-2.5 text-xs text-green-700">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /><span>{success}</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Registration closed. Register an employee:</p>
                <div>
                  <input
                    value={adminEmpId}
                    onChange={(e) => { setAdminEmpId(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)); setFormErrors(f => ({ ...f, empId: '' })); }}
                    placeholder="Enter Employee ID"
                    className={`w-full h-9 rounded-md border bg-white px-3 text-sm ${formErrors.empId ? 'border-error' : 'border-border'}`}
                  />
                  {formErrors.empId && <p className="text-error text-[10px] font-medium mt-0.5">{formErrors.empId}</p>}
                </div>

                {event.foodOptions?.length > 0 && (
                  <div className={`rounded-lg p-2.5 ${formErrors.food ? 'bg-red-50 border-2 border-error' : !selectedFood ? 'bg-amber-50 border-2 border-amber-200' : 'bg-ust-gray-200'}`}>
                    <p className="mb-1.5 text-xs font-semibold text-foreground flex items-center gap-1">
                      <UtensilsCrossed className="h-3.5 w-3.5 text-primary" /> Food preference <span className="text-error">*</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {event.foodOptions.map((opt) => (
                        <button key={opt._id} onClick={() => { setSelectedFood(opt.name); setFormErrors(e => ({ ...e, food: '' })); }}
                          className={`rounded-full border-2 px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                            selectedFood === opt.name ? 'border-primary bg-primary-50 text-primary' : 'border-border bg-white hover:border-primary/40 text-foreground'
                          }`}>{opt.name}</button>
                      ))}
                    </div>
                    {formErrors.food && <p className="text-error text-[10px] font-medium mt-1">{formErrors.food}</p>}
                  </div>
                )}

                {event.timeSlots?.length > 0 && (
                  <div className={`rounded-lg p-2.5 ${formErrors.slot ? 'bg-red-50 border-2 border-error' : 'bg-ust-gray-200'}`}>
                    <p className="mb-1.5 text-xs font-semibold text-foreground flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-primary" /> Time slot <span className="text-error">*</span>
                    </p>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {event.timeSlots.map((slot) => {
                        const booked = event.slotCounts?.[slot._id] || 0;
                        const slotFull = slot.maxCapacity > 0 && booked >= slot.maxCapacity;
                        return (
                          <button key={slot._id} type="button" disabled={slotFull}
                            onClick={() => { if (!slotFull) { setSelectedSlot(slot._id); setFormErrors(e => ({ ...e, slot: '' })); } }}
                            className={`rounded-md border-2 px-2.5 py-2 text-left transition-all ${
                              slotFull ? 'border-border bg-ust-gray-200 opacity-60 cursor-not-allowed'
                              : selectedSlot === slot._id ? 'border-primary bg-primary-50 text-primary cursor-pointer'
                              : 'border-border bg-white hover:border-primary/40 text-foreground cursor-pointer'
                            }`}>
                            <span className="text-xs font-medium">{slot.label}</span>
                            <span className="block text-[10px] text-muted-foreground mt-0.5">{slot.startTime} – {slot.endTime}</span>
                          </button>
                        );
                      })}
                    </div>
                    {formErrors.slot && <p className="text-error text-[10px] font-medium mt-1">{formErrors.slot}</p>}
                  </div>
                )}

                <Button className="w-full gap-2 text-sm" onClick={handleAdminRegister} disabled={registering}>
                  {registering ? (
                    <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Registering...</>
                  ) : (
                    <><Ticket className="h-4 w-4" />Register Employee</>
                  )}
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                {isFull ? 'This event is fully booked.' : 'Registration is currently closed.'}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
