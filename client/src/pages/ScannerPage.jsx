import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Html5Qrcode } from 'html5-qrcode';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { playSuccessBeep, playErrorBeep, playWarningBeep } from '@/lib/beep';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  ScanLine, CheckCircle2, XCircle, Camera, CameraOff,
  User, Hash, UtensilsCrossed, Building2, Clock, Search,
  CalendarDays, MapPin, Phone, Mail, UserPlus, Users, AlertTriangle,
} from 'lucide-react';
import { sanitizeName, sanitizePhone, sanitizeEmployeeId, sanitizeEmail } from '@/lib/sanitize';

const ATTENDEE_TYPES = [
  { value: 'guest', label: 'Guest', color: 'bg-blue-100 text-blue-700' },
  { value: 'staff', label: 'General Staff', color: 'bg-amber-100 text-amber-700' },
  { value: 'housekeeping', label: 'Housekeeping', color: 'bg-purple-100 text-purple-700' },
  { value: 'unregistered_employee', label: 'Unregistered Employee', color: 'bg-orange-100 text-orange-700' },
];

export default function ScannerPage() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [lookupResults, setLookupResults] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('scan');
  const [events, setEvents] = useState([]);
  const [walkInForm, setWalkInForm] = useState({
    eventId: '', name: '', phone: '', email: '',
    attendeeType: 'guest', department: '', employeeId: '',
    foodPreference: '', timeSlotId: '', notes: '',
  });
  const [walkInLoading, setWalkInLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showAddDetails, setShowAddDetails] = useState(false);
  const [pendingWalkIn, setPendingWalkIn] = useState(null);
  const [addDetailsForm, setAddDetailsForm] = useState({ name: '', phone: '', department: '' });
  const [walkInErrors, setWalkInErrors] = useState({});
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);

  useEffect(() => {
    api.get('/events').then(res => {
      const active = (res.data.events || []).filter(e => e.status === 'active');
      setEvents(active);
      if (active.length === 1) {
        setWalkInForm(f => ({ ...f, eventId: active[0]._id }));
        setSelectedEvent(active[0]);
      }
    }).catch(() => {});
  }, []);

  const startScanner = async () => {
    setResult(null);
    setError('');
    setLookupResults(null);
    setShowAddDetails(false);
    setPendingWalkIn(null);
    try {
      const html5Qr = new Html5Qrcode('qr-reader');
      html5QrRef.current = html5Qr;
      await html5Qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          handleScan(decodedText);
          html5Qr.stop().catch(console.error);
          setScanning(false);
        },
        () => {}
      );
      setScanning(true);
    } catch {
      setError('Camera access denied or not available. Use Employee ID to check in manually.');
      setShowManual(true);
    }
  };

  const stopScanner = async () => {
    if (html5QrRef.current) {
      try { await html5QrRef.current.stop(); } catch {}
    }
    setScanning(false);
  };

  const handleScan = async (qrData) => {
    setError('');
    setResult(null);
    setLookupResults(null);
    setShowAddDetails(false);
    setPendingWalkIn(null);
    try {
      const res = await api.post('/bookings/scan', { qrData });
      playSuccessBeep();
      setResult({ success: true, ...res.data });
    } catch (err) {
      const data = err.response?.data;

      if (data?.isWalkInQR) {
        try {
          const walkInRes = await api.post('/walkins/scan', { qrData });
          playSuccessBeep();
          setResult({
            success: true,
            message: walkInRes.data.message,
            walkIn: walkInRes.data.walkIn,
            typeCount: walkInRes.data.typeCount,
            attendeeType: walkInRes.data.attendeeType,
          });
        } catch (walkInErr) {
          playErrorBeep();
          setResult({
            success: false,
            message: walkInErr.response?.data?.message || 'Walk-in scan failed',
          });
        }
        return;
      }

      const isAlreadyCheckedIn = data?.message?.startsWith('Already checked in');
      if (isAlreadyCheckedIn) {
        playWarningBeep();
        setResult({
          success: false,
          alreadyCheckedIn: true,
          message: data.message,
          booking: data.booking,
        });
      } else {
        playErrorBeep();
        setResult({
          success: false,
          message: data?.message || 'Scan failed',
          booking: data?.booking,
        });
      }
    }
  };

  const handleEmployeeLookup = async (e) => {
    e.preventDefault();
    if (!employeeId.trim()) return;
    setLookupLoading(true);
    setLookupResults(null);
    setResult(null);
    setError('');
    try {
      const res = await api.post('/bookings/lookup', { employeeId: employeeId.trim() });
      setLookupResults({ type: 'found', bookings: res.data.bookings });
    } catch (err) {
      if (err.response?.status === 404) {
        setLookupResults({
          type: 'not_found',
          message: err.response?.data?.message || 'Not found',
          searchedId: employeeId.trim(),
        });
      } else {
        setError(err.response?.data?.message || 'Lookup failed');
      }
    } finally {
      setLookupLoading(false);
    }
  };

  const handleCheckIn = async (bookingId) => {
    try {
      const booking = lookupResults.bookings.find(b => b._id === bookingId);
      if (!booking) return;
      const res = await api.post('/bookings/scan', { qrData: booking.qrData });
      playSuccessBeep();
      setResult({ success: true, ...res.data });
      setLookupResults(null);
      setEmployeeId('');
    } catch (err) {
      playErrorBeep();
      setResult({
        success: false,
        message: err.response?.data?.message || 'Check-in failed',
        booking: err.response?.data?.booking,
      });
      setLookupResults(null);
    }
  };

  const handleRegisterAsWalkIn = () => {
    setActiveTab('walkin');
    setWalkInForm(f => ({
      ...f,
      attendeeType: 'unregistered_employee',
      employeeId: lookupResults?.searchedId || employeeId.trim(),
      name: '',
    }));
    setLookupResults(null);
  };

  const validateWalkInForm = () => {
    const errors = {};
    if (!walkInForm.name.trim()) {
      errors.name = 'Name is required';
    } else if (walkInForm.name.trim().length > 100) {
      errors.name = 'Name must be 100 characters or less';
    }
    if (walkInForm.phone && walkInForm.phone.length > 20) {
      errors.phone = 'Phone must be 20 characters or less';
    }
    if (walkInForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(walkInForm.email)) {
      errors.email = 'Invalid email format';
    }
    if (walkInForm.notes && walkInForm.notes.length > 500) {
      errors.notes = 'Notes must be 500 characters or less';
    }
    if (!walkInForm.eventId) {
      errors.eventId = 'Please select an event';
    }
    setWalkInErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleWalkInSubmit = async (e) => {
    e.preventDefault();
    if (!validateWalkInForm()) {
      return;
    }
    setWalkInLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.post('/walkins', walkInForm);
      playSuccessBeep();
      setResult({
        success: true,
        message: res.data.message,
        walkIn: res.data.walkIn,
      });
      setWalkInForm(f => ({
        ...f, name: '', phone: '', email: '', department: '',
        employeeId: '', foodPreference: '', timeSlotId: '', notes: '',
      }));
    } catch (err) {
      playErrorBeep();
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setWalkInLoading(false);
    }
  };

  const handleEventChange = (eventId) => {
    setWalkInForm(f => ({ ...f, eventId, timeSlotId: '' }));
    const ev = events.find(e => e._id === eventId);
    setSelectedEvent(ev || null);
  };

  useEffect(() => {
    return () => { if (html5QrRef.current) html5QrRef.current.stop().catch(() => {}); };
  }, []);

  const renderBookingDetails = (booking) => {
    if (!booking) return null;
    const details = [
      { icon: User, label: 'Name', value: booking.employee?.name },
      { icon: Hash, label: 'Employee ID', value: booking.employee?.employeeId },
      { icon: Building2, label: 'Department', value: booking.employee?.department },
      ...(booking.employee?.phone ? [{ icon: Phone, label: 'Phone', value: booking.employee.phone }] : []),
      ...(booking.employee?.email ? [{ icon: Mail, label: 'Email', value: booking.employee.email }] : []),
    ];
    const eventDetails = [
      { icon: CalendarDays, label: 'Event', value: booking.event?.title },
      { icon: CalendarDays, label: 'Date', value: formatDate(booking.event?.eventDate) },
      { icon: MapPin, label: 'Venue', value: booking.event?.venue },
      ...(booking.timeSlotLabel ? [{ icon: Clock, label: 'Time Slot', value: booking.timeSlotLabel }] : []),
      { icon: UtensilsCrossed, label: 'Food', value: booking.foodPreference },
    ];

    return (
      <div className="space-y-3">
        {booking.slotColor && booking.timeSlotLabel && (
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5" style={{ backgroundColor: booking.slotColor + '18' }}>
            <span className="inline-block h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: booking.slotColor }} />
            <span className="text-xs font-semibold" style={{ color: booking.slotColor }}>{booking.timeSlotLabel}</span>
          </div>
        )}
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Employee</p>
          <div className="space-y-1">
            {details.filter(d => d.value).map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-2 text-xs sm:text-sm">
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 sm:h-4 sm:w-4" />
                <span className="text-muted-foreground text-[10px] w-16 shrink-0 sm:text-xs">{label}</span>
                <span className="font-medium truncate">{value}</span>
              </div>
            ))}
          </div>
        </div>
        <Separator />
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Booking</p>
          <div className="space-y-1">
            {eventDetails.filter(d => d.value).map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-2 text-xs sm:text-sm">
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 sm:h-4 sm:w-4" />
                <span className="text-muted-foreground text-[10px] w-16 shrink-0 sm:text-xs">{label}</span>
                <span className="font-medium truncate">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderWalkInDetails = (walkIn) => {
    if (!walkIn) return null;
    const typeInfo = ATTENDEE_TYPES.find(t => t.value === walkIn.attendeeType);
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge className={`text-[10px] ${typeInfo?.color || ''}`}>{typeInfo?.label || walkIn.attendeeType}</Badge>
          {result?.typeCount != null && (
            <span className="text-xs text-muted-foreground">#{result.typeCount} today</span>
          )}
        </div>
        <div className="space-y-1">
          {[
            { icon: User, label: 'Name', value: walkIn.name },
            ...(walkIn.employeeId ? [{ icon: Hash, label: 'ID', value: walkIn.employeeId }] : []),
            ...(walkIn.department ? [{ icon: Building2, label: 'Dept', value: walkIn.department }] : []),
            ...(walkIn.phone ? [{ icon: Phone, label: 'Phone', value: walkIn.phone }] : []),
            { icon: CalendarDays, label: 'Event', value: walkIn.event?.title },
            ...(walkIn.timeSlotLabel ? [{ icon: Clock, label: 'Slot', value: walkIn.timeSlotLabel }] : []),
            ...(walkIn.foodPreference ? [{ icon: UtensilsCrossed, label: 'Food', value: walkIn.foodPreference }] : []),
          ].filter(d => d.value).map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-2 text-xs sm:text-sm">
              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground text-[10px] w-14 shrink-0 sm:text-xs">{label}</span>
              <span className="font-medium truncate">{value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 text-center sm:mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Check-in Station</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">Scan QR passes or register walk-ins</p>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex rounded-lg border bg-ust-gray-200 p-1">
        {[
          { id: 'scan', label: 'QR Scan', icon: ScanLine },
          { id: 'walkin', label: 'Walk-in', icon: UserPlus },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setResult(null); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all sm:text-sm ${
                activeTab === tab.id
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* QR Scan Tab */}
      {activeTab === 'scan' && (
        <Card>
          <CardContent className="p-3 sm:p-5">
            <div className="mb-3 overflow-hidden rounded-lg bg-ust-gray-900 sm:mb-4" style={{ minHeight: scanning ? 280 : 0 }}>
              <div id="qr-reader" ref={scannerRef} />
            </div>

            <div className="flex gap-2">
              {!scanning ? (
                <Button className="flex-1 gap-2 text-sm" size="lg" onClick={startScanner}>
                  <Camera className="h-4 w-4" />
                  Start Scanning
                </Button>
              ) : (
                <Button className="flex-1 gap-2 text-sm" size="lg" variant="destructive" onClick={stopScanner}>
                  <CameraOff className="h-4 w-4" />
                  Stop Scanner
                </Button>
              )}
              <Button variant="outline" size="lg" onClick={() => setShowManual(!showManual)} className="gap-2 shrink-0" title="Check in by Employee ID">
                <Search className="h-4 w-4" />
              </Button>
            </div>

            <AnimatePresence>
              {showManual && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3"
                >
                  <p className="mb-2 text-xs text-muted-foreground">Enter Employee ID to look up bookings:</p>
                  <form onSubmit={handleEmployeeLookup} className="flex gap-2">
                    <Input
                      placeholder="Enter Employee ID..."
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      className="border-ust-gray-400 text-sm"
                    />
                    <Button type="submit" className="shrink-0 text-sm gap-1.5" disabled={lookupLoading}>
                      <Search className="h-3.5 w-3.5" />
                      {lookupLoading ? 'Searching...' : 'Find'}
                    </Button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {error && activeTab === 'scan' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="mt-3 flex items-start gap-2 rounded-md bg-error-light p-2.5 text-xs text-error sm:p-3 sm:text-sm">
                <XCircle className="h-4 w-4 shrink-0 mt-0.5" />{error}
              </motion.div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Walk-in Tab */}
      {activeTab === 'walkin' && (
        <Card>
          <CardHeader className="p-3 pb-2 sm:p-5 sm:pb-2">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <UserPlus className="h-4 w-4 text-primary" />
              Walk-in Registration
            </CardTitle>
            <p className="text-[10px] text-muted-foreground sm:text-xs">Register guests, staff, or unregistered employees</p>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
            <form onSubmit={handleWalkInSubmit} className="space-y-3">
              {/* Event selection */}
              <div>
                <Label className="text-xs">Event *</Label>
                <select
                  value={walkInForm.eventId}
                  onChange={(e) => {
                    handleEventChange(e.target.value);
                    setWalkInErrors(prev => ({ ...prev, eventId: '' }));
                  }}
                  className={`mt-1 w-full h-9 rounded-md border bg-ust-gray-200 px-3 text-sm ${walkInErrors.eventId ? 'border-error' : 'border-ust-gray-400'}`}
                  required
                >
                  <option value="">Select event...</option>
                  {events.map(ev => (
                    <option key={ev._id} value={ev._id}>{ev.title}</option>
                  ))}
                </select>
                {walkInErrors.eventId && <p className="text-error text-[10px] font-medium mt-0.5">{walkInErrors.eventId}</p>}
              </div>

              {/* Attendee type */}
              <div>
                <Label className="text-xs">Type *</Label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {ATTENDEE_TYPES.map(type => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setWalkInForm(f => ({ ...f, attendeeType: type.value }))}
                      className={`rounded-md border px-3 py-2 text-xs font-medium transition-all ${
                        walkInForm.attendeeType === type.value
                          ? `${type.color} border-current ring-1 ring-current/20`
                          : 'border-ust-gray-400 text-muted-foreground hover:bg-ust-gray-200'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <Label className="text-xs">Name *</Label>
                <Input
                  value={walkInForm.name}
                  onChange={(e) => {
                    setWalkInForm(f => ({ ...f, name: sanitizeName(e.target.value) }));
                    setWalkInErrors(prev => ({ ...prev, name: '' }));
                  }}
                  placeholder="Full name"
                  className={`mt-1 text-sm ${walkInErrors.name ? 'border-error' : 'border-ust-gray-400'}`}
                  maxLength={100}
                  required
                />
                {walkInErrors.name && <p className="text-error text-[10px] font-medium mt-0.5">{walkInErrors.name}</p>}
              </div>

              {/* Employee ID (for unregistered employees) */}
              {walkInForm.attendeeType === 'unregistered_employee' && (
                <div>
                  <Label className="text-xs">Employee ID</Label>
                  <Input
                    value={walkInForm.employeeId}
                    onChange={(e) => setWalkInForm(f => ({ ...f, employeeId: sanitizeEmployeeId(e.target.value) }))}
                    placeholder="e.g. EMP001"
                    className="mt-1 border-ust-gray-400 text-sm"
                    maxLength={20}
                  />
                </div>
              )}

              {/* Contact & department in a row */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Phone</Label>
                  <Input
                    value={walkInForm.phone}
                    onChange={(e) => {
                      setWalkInForm(f => ({ ...f, phone: sanitizePhone(e.target.value) }));
                      setWalkInErrors(prev => ({ ...prev, phone: '' }));
                    }}
                    placeholder="Phone number"
                    className={`mt-1 text-sm ${walkInErrors.phone ? 'border-error' : 'border-ust-gray-400'}`}
                    maxLength={20}
                  />
                  {walkInErrors.phone && <p className="text-error text-[10px] font-medium mt-0.5">{walkInErrors.phone}</p>}
                </div>
                <div>
                  <Label className="text-xs">Department</Label>
                  <Input
                    value={walkInForm.department}
                    onChange={(e) => setWalkInForm(f => ({ ...f, department: e.target.value }))}
                    placeholder="Department"
                    className="mt-1 border-ust-gray-400 text-sm"
                    maxLength={100}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <Label className="text-xs">Email</Label>
                <Input
                  value={walkInForm.email}
                  onChange={(e) => {
                    setWalkInForm(f => ({ ...f, email: sanitizeEmail(e.target.value) }));
                    setWalkInErrors(prev => ({ ...prev, email: '' }));
                  }}
                  placeholder="Email address"
                  className={`mt-1 text-sm ${walkInErrors.email ? 'border-error' : 'border-ust-gray-400'}`}
                  maxLength={255}
                  type="email"
                />
                {walkInErrors.email && <p className="text-error text-[10px] font-medium mt-0.5">{walkInErrors.email}</p>}
              </div>

              {/* Time slot (if event has slots) */}
              {selectedEvent?.timeSlots?.length > 0 && (
                <div>
                  <Label className="text-xs">Time Slot</Label>
                  <select
                    value={walkInForm.timeSlotId}
                    onChange={(e) => setWalkInForm(f => ({ ...f, timeSlotId: e.target.value }))}
                    className="mt-1 w-full h-9 rounded-md border border-ust-gray-400 bg-ust-gray-200 px-3 text-sm"
                  >
                    <option value="">Select slot...</option>
                    {selectedEvent.timeSlots.map(s => (
                      <option key={s._id} value={s._id}>{s.label} ({s.startTime} – {s.endTime})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Food preference */}
              {selectedEvent?.foodOptions?.length > 0 ? (
                <div>
                  <Label className="text-xs">Food Preference</Label>
                  <select
                    value={walkInForm.foodPreference}
                    onChange={(e) => setWalkInForm(f => ({ ...f, foodPreference: e.target.value }))}
                    className="mt-1 w-full h-9 rounded-md border border-ust-gray-400 bg-ust-gray-200 px-3 text-sm"
                  >
                    <option value="">Select food...</option>
                    {selectedEvent.foodOptions.map(o => (
                      <option key={o.name} value={o.name}>{o.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <Label className="text-xs">Food Preference</Label>
                  <Input
                    value={walkInForm.foodPreference}
                    onChange={(e) => setWalkInForm(f => ({ ...f, foodPreference: e.target.value }))}
                    placeholder="e.g. Vegetarian"
                    className="mt-1 border-ust-gray-400 text-sm"
                    maxLength={100}
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <Label className="text-xs">Notes</Label>
                <Input
                  value={walkInForm.notes}
                  onChange={(e) => {
                    setWalkInForm(f => ({ ...f, notes: e.target.value }));
                    setWalkInErrors(prev => ({ ...prev, notes: '' }));
                  }}
                  placeholder="Any additional notes..."
                  className={`mt-1 text-sm ${walkInErrors.notes ? 'border-error' : 'border-ust-gray-400'}`}
                  maxLength={500}
                />
                {walkInErrors.notes && <p className="text-error text-[10px] font-medium mt-0.5">{walkInErrors.notes}</p>}
              </div>

              <Button type="submit" className="w-full gap-2 text-sm" size="lg" disabled={walkInLoading}>
                <UserPlus className="h-4 w-4" />
                {walkInLoading ? 'Registering...' : 'Register & Check In'}
              </Button>
            </form>

            {error && activeTab === 'walkin' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="mt-3 flex items-start gap-2 rounded-md bg-error-light p-2.5 text-xs text-error sm:p-3 sm:text-sm">
                <XCircle className="h-4 w-4 shrink-0 mt-0.5" />{error}
              </motion.div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Employee lookup results */}
      <AnimatePresence>
        {lookupResults && lookupResults.type === 'found' && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="mt-4 space-y-2.5"
          >
            <p className="text-xs font-medium text-muted-foreground">
              Found {lookupResults.bookings.length} booking{lookupResults.bookings.length > 1 ? 's' : ''} — select one to check in:
            </p>
            {lookupResults.bookings.map((b) => (
              <Card key={b._id} className="border">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium text-foreground">{b.employee?.name}</p>
                      <p className="text-xs text-muted-foreground">{b.event?.title}</p>
                      {b.timeSlotLabel && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" /> {b.timeSlotLabel}
                        </p>
                      )}
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <UtensilsCrossed className="h-3 w-3" /> {b.foodPreference}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={b.status === 'checked_in' ? 'success' : 'default'} className="text-[10px]">
                        {b.status.replace('_', ' ')}
                      </Badge>
                      {b.status === 'confirmed' && (
                        <Button size="sm" className="text-xs gap-1" onClick={() => handleCheckIn(b._id)}>
                          <ScanLine className="h-3 w-3" />
                          Check In
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        )}

        {/* Not found - offer walk-in registration */}
        {lookupResults && lookupResults.type === 'not_found' && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="mt-4"
          >
            <Card className="border-2 border-amber-300">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start gap-2.5">
                  <div className="rounded-lg bg-amber-100 p-2">
                    <Users className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{lookupResults.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Employee ID "{lookupResults.searchedId}" not found in the system or has no active bookings.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={handleRegisterAsWalkIn}
                    >
                      <UserPlus className="h-3 w-3" />
                      Register as Walk-in
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scan / walk-in result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15 }}
            className="mt-4 sm:mt-5"
          >
            <Card className={`border-2 ${result.success ? 'border-success' : result.alreadyCheckedIn ? 'border-amber-400' : 'border-error'}`}>
              <CardHeader className="pb-2 p-3 sm:p-5 sm:pb-2">
                <div className="flex items-center gap-2.5">
                  {result.success ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
                      <CheckCircle2 className="h-8 w-8 text-success sm:h-10 sm:w-10" />
                    </motion.div>
                  ) : result.alreadyCheckedIn ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
                      <AlertTriangle className="h-8 w-8 text-amber-500 sm:h-10 sm:w-10" />
                    </motion.div>
                  ) : (
                    <XCircle className="h-8 w-8 text-error sm:h-10 sm:w-10" />
                  )}
                  <div>
                    <CardTitle className={`text-sm sm:text-base ${result.success ? 'text-green-700' : result.alreadyCheckedIn ? 'text-amber-600' : 'text-error'}`}>
                      {result.alreadyCheckedIn ? 'Already Checked In' : result.message}
                    </CardTitle>
                    {result.alreadyCheckedIn && (
                      <p className="text-xs text-amber-600 mt-0.5">{result.message}</p>
                    )}
                    {result.typeCount != null && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Total {ATTENDEE_TYPES.find(t => t.value === result.attendeeType)?.label || 'walk-in'}s: {result.typeCount}
                      </p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
                {result.booking && renderBookingDetails(result.booking)}
                {result.walkIn && renderWalkInDetails(result.walkIn)}
              </CardContent>
            </Card>

            <Button className="mt-3 w-full gap-2 text-sm sm:mt-4" size="lg" onClick={() => {
              setResult(null);
              if (activeTab === 'scan') startScanner();
            }}>
              {activeTab === 'scan' ? (
                <><ScanLine className="h-4 w-4" /> Scan Next</>
              ) : (
                <><UserPlus className="h-4 w-4" /> Register Another</>
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
