import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, Printer, QrCode, UsersRound, Building2,
  Users, UserPlus, RefreshCw,
} from 'lucide-react';

const TYPE_CONFIG = {
  guest: { label: 'Guest', icon: UsersRound, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', headerBg: 'bg-blue-600' },
  staff: { label: 'General Staff', icon: Building2, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', headerBg: 'bg-amber-600' },
  housekeeping: { label: 'Housekeeping', icon: Users, color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', headerBg: 'bg-purple-600' },
  unregistered_employee: { label: 'Unregistered Employee', icon: UserPlus, color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', headerBg: 'bg-orange-600' },
};

export default function WalkInQRPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchQRCodes = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const res = await api.get(`/walkins/event/${eventId}/qrcodes`);
      setData(res.data);
    } catch {
      navigate(`/admin/events/${eventId}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchQRCodes(); }, [eventId]);

  useEffect(() => {
    const interval = setInterval(() => fetchQRCodes(), 15000);
    return () => clearInterval(interval);
  }, [eventId]);

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div>
        <Skeleton className="mb-3 h-8 w-24" />
        <Skeleton className="h-7 w-60 mb-5" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          {[1, 2, 3, 4].map(i => <Card key={i}><CardContent className="p-4"><Skeleton className="h-72 w-full" /></CardContent></Card>)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { event, qrCodes } = data;
  const totalCount = qrCodes.reduce((s, q) => s + q.count, 0);

  return (
    <div>
      <div className="print:hidden">
        <Button variant="ghost" className="mb-3 gap-1.5 text-muted-foreground -ml-2 text-sm" onClick={() => navigate(`/admin/events/${eventId}`)}>
          <ArrowLeft className="h-4 w-4" />
          Back to Event
        </Button>

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Walk-in QR Codes</h1>
            <p className="text-sm font-medium text-foreground">{event?.title}</p>
            <p className="text-xs text-muted-foreground">{formatDate(event?.eventDate)} &middot; {event?.venue}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 text-sm" onClick={() => fetchQRCodes(true)} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button className="gap-2 text-sm" onClick={handlePrint}>
              <Printer className="h-4 w-4" />
              Print All
            </Button>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-3 rounded-lg border bg-ust-gray-200 p-3 sm:p-4">
          <QrCode className="h-5 w-5 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground sm:text-sm">How it works</p>
            <p className="text-[10px] text-muted-foreground sm:text-xs">
              Print these QR codes and place them at venue entry points. Volunteers scan a category QR with the scanner —
              each scan instantly counts +1 for that category. No form needed.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold text-primary">{totalCount}</p>
            <p className="text-[10px] text-muted-foreground">total walk-ins</p>
          </div>
        </div>
      </div>

      {/* QR Code Cards - visible on screen and print */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 print:grid-cols-2 print:gap-8">
        {qrCodes.map((qr, index) => {
          const config = TYPE_CONFIG[qr.type];
          const Icon = config.icon;
          return (
            <motion.div
              key={qr.type}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="print:break-inside-avoid"
            >
              <Card className={`overflow-hidden border-2 ${config.border}`}>
                {/* Colored header */}
                <div className={`${config.headerBg} px-4 py-3 text-center text-white print:py-4`}>
                  <div className="flex items-center justify-center gap-2">
                    <Icon className="h-5 w-5" />
                    <h3 className="text-base font-bold sm:text-lg print:text-xl">{config.label}</h3>
                  </div>
                  <p className="mt-0.5 text-[10px] text-white/80 sm:text-xs print:text-sm">Scan to check in</p>
                </div>

                <CardContent className="p-4 sm:p-5 print:p-6">
                  {/* QR Code */}
                  <div className="flex justify-center mb-3">
                    <div
                      className={`rounded-xl p-3 ${config.bg} print:p-4`}
                      style={{ border: `2px solid ${qr.color.dark}30` }}
                    >
                      <img src={qr.qrImage} alt={`${config.label} QR`} className="h-44 w-44 sm:h-52 sm:w-52 print:h-56 print:w-56" />
                    </div>
                  </div>

                  {/* Event info */}
                  <div className="text-center mb-3 print:mb-4">
                    <p className="text-sm font-semibold text-foreground sm:text-base print:text-lg">{event?.title}</p>
                    <p className="text-[10px] text-muted-foreground sm:text-xs print:text-sm">
                      {formatDate(event?.eventDate)} &middot; {event?.venue}
                    </p>
                  </div>

                  {/* Live count (screen only) */}
                  <div className="print:hidden">
                    <div className={`rounded-lg ${config.bg} p-2.5 text-center`}>
                      <p className={`text-2xl font-bold ${config.color}`}>{qr.count}</p>
                      <p className="text-[10px] text-muted-foreground">checked in so far</p>
                    </div>
                  </div>

                  {/* Print instruction */}
                  <p className="hidden print:block text-center text-sm text-gray-500 mt-2">
                    Place this QR code at the venue entrance. Scan with UST PassMint to check in.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:grid-cols-2, .print\\:grid-cols-2 * { visibility: visible; }
          .print\\:hidden { display: none !important; }
          .hidden.print\\:block { display: block !important; visibility: visible; }
          @page { margin: 1cm; }
        }
      `}</style>
    </div>
  );
}
