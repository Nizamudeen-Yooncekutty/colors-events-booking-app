import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Html5Qrcode } from 'html5-qrcode';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ScanLine, CheckCircle2, XCircle, Camera, CameraOff,
  User, Hash, UtensilsCrossed, Building2, Clock, Search,
} from 'lucide-react';

export default function ScannerPage() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [lookupResults, setLookupResults] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);

  const startScanner = async () => {
    setResult(null);
    setError('');
    setLookupResults(null);
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
    try {
      const res = await api.post('/bookings/scan', { qrData });
      setResult({ success: true, ...res.data });
    } catch (err) {
      setResult({
        success: false,
        message: err.response?.data?.message || 'Scan failed',
        booking: err.response?.data?.booking,
      });
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
      setLookupResults(res.data.bookings);
    } catch (err) {
      setError(err.response?.data?.message || 'Employee not found');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleCheckIn = async (bookingId) => {
    try {
      const booking = lookupResults.find(b => b._id === bookingId);
      if (!booking) return;
      const res = await api.post('/bookings/scan', { qrData: booking.qrData });
      setResult({ success: true, ...res.data });
      setLookupResults(null);
      setEmployeeId('');
    } catch (err) {
      setResult({
        success: false,
        message: err.response?.data?.message || 'Check-in failed',
        booking: err.response?.data?.booking,
      });
      setLookupResults(null);
    }
  };

  useEffect(() => {
    return () => { if (html5QrRef.current) html5QrRef.current.stop().catch(() => {}); };
  }, []);

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 text-center sm:mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">QR Scanner</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">Scan employee QR passes for event check-in</p>
      </div>

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
                <p className="mb-2 text-xs text-muted-foreground">QR not working? Enter Employee ID to check in:</p>
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

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="mt-3 flex items-start gap-2 rounded-md bg-error-light p-2.5 text-xs text-error sm:p-3 sm:text-sm">
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" />{error}
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Employee lookup results */}
      <AnimatePresence>
        {lookupResults && lookupResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="mt-4 space-y-2.5"
          >
            <p className="text-xs font-medium text-muted-foreground">
              Found {lookupResults.length} booking{lookupResults.length > 1 ? 's' : ''} — select one to check in:
            </p>
            {lookupResults.map((b) => (
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
      </AnimatePresence>

      {/* Scan result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15 }}
            className="mt-4 sm:mt-5"
          >
            <Card className={`border-2 ${result.success ? 'border-success' : 'border-error'}`}>
              <CardHeader className="pb-2 p-3 sm:p-5 sm:pb-2">
                <div className="flex items-center gap-2.5">
                  {result.success ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
                      <CheckCircle2 className="h-8 w-8 text-success sm:h-10 sm:w-10" />
                    </motion.div>
                  ) : (
                    <XCircle className="h-8 w-8 text-error sm:h-10 sm:w-10" />
                  )}
                  <CardTitle className={`text-sm sm:text-base ${result.success ? 'text-green-700' : 'text-error'}`}>
                    {result.message}
                  </CardTitle>
                </div>
              </CardHeader>
              {result.booking && (
                <CardContent className="space-y-1.5 p-3 pt-0 sm:p-5 sm:pt-0">
                  {[
                    { icon: User, value: result.booking.employee?.name },
                    { icon: Hash, value: result.booking.employee?.employeeId },
                    { icon: Building2, value: result.booking.employee?.department },
                    ...(result.booking.timeSlotLabel ? [{ icon: Clock, value: result.booking.timeSlotLabel }] : []),
                    { icon: UtensilsCrossed, value: result.booking.foodPreference },
                  ].filter(i => i.value).map(({ icon: Icon, value }, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs sm:text-sm">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground sm:h-4 sm:w-4" />
                      <span className="font-medium truncate">{value}</span>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>

            <Button className="mt-3 w-full gap-2 text-sm sm:mt-4" size="lg" onClick={() => { setResult(null); startScanner(); }}>
              <ScanLine className="h-4 w-4" />
              Scan Next
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
