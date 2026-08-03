import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Users, ScanLine, Ticket, Download,
  UtensilsCrossed, Clock, UserPlus, UsersRound,
  Building2, BarChart3, TrendingUp, UserCheck, PieChart,
} from 'lucide-react';

const TYPE_COLORS = {
  employees: '#2563eb',
  guests: '#3b82f6',
  staff: '#f59e0b',
  housekeeping: '#8b5cf6',
  unregisteredEmployees: '#ea580c',
};

export default function EventReportPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/admin/events/${eventId}/report`)
      .then(res => setReport(res.data))
      .catch(() => navigate(`/admin/events/${eventId}`))
      .finally(() => setLoading(false));
  }, [eventId, navigate]);

  const downloadReport = async () => {
    try {
      const res = await api.get(`/admin/events/${eventId}/report/download`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report?.event?.title || 'event'}_report.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download report');
    }
  };

  if (loading) {
    return (
      <div>
        <Skeleton className="mb-3 h-8 w-24" />
        <Skeleton className="h-7 w-60 mb-1.5" />
        <Skeleton className="h-4 w-40 mb-5" />
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-5">
          {[1, 2, 3, 4].map(i => <Card key={i}><CardContent className="p-3"><Skeleton className="h-16 w-full" /></CardContent></Card>)}
        </div>
      </div>
    );
  }

  if (!report) return null;

  const { event, classification, totalAttendees, foodBreakdown, slotBreakdown, checkInTimeline } = report;

  const classificationItems = [
    { key: 'employees', label: 'Employees', value: classification.employees.checkedIn, icon: UserCheck, color: 'text-blue-700 bg-blue-50', barColor: TYPE_COLORS.employees },
    { key: 'guests', label: 'Guests', value: classification.guests.total, icon: UsersRound, color: 'text-sky-700 bg-sky-50', barColor: TYPE_COLORS.guests },
    { key: 'staff', label: 'Staff', value: classification.staff.total, icon: Building2, color: 'text-amber-700 bg-amber-50', barColor: TYPE_COLORS.staff },
    { key: 'housekeeping', label: 'Housekeeping', value: classification.housekeeping.total, icon: Users, color: 'text-purple-700 bg-purple-50', barColor: TYPE_COLORS.housekeeping },
    { key: 'unregisteredEmployees', label: 'Unreg. Employees', value: classification.unregisteredEmployees.total, icon: UserPlus, color: 'text-orange-700 bg-orange-50', barColor: TYPE_COLORS.unregisteredEmployees },
  ].filter(c => c.value > 0);

  const maxTimeline = Math.max(...(checkInTimeline.map(t => t.total) || [1]), 1);

  return (
    <div>
      <Button variant="ghost" className="mb-3 gap-1.5 text-muted-foreground -ml-2 text-sm" onClick={() => navigate(`/admin/events/${eventId}`)}>
        <ArrowLeft className="h-4 w-4" />
        Back to Event
      </Button>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Event Report</h1>
          <p className="text-sm font-medium text-foreground">{event?.title}</p>
          <p className="text-xs text-muted-foreground">{formatDate(event?.eventDate)} &middot; {event?.venue}</p>
        </div>
        <Button className="gap-2 text-sm shrink-0" onClick={downloadReport}>
          <Download className="h-4 w-4" />
          Download CSV
        </Button>
      </div>

      {/* Summary cards */}
      <div className="mb-5 grid gap-3 grid-cols-2 sm:grid-cols-4">
        {[
          { label: 'Total Registrations', value: classification.employees.total, icon: Ticket, color: 'text-primary bg-primary-100' },
          { label: 'Employee Check-ins', value: classification.employees.checkedIn, icon: ScanLine, color: 'text-green-700 bg-success-light' },
          { label: 'Walk-ins', value: totalAttendees - classification.employees.checkedIn, icon: UserPlus, color: 'text-amber-700 bg-amber-50' },
          { label: 'Total Attended', value: totalAttendees, icon: Users, color: 'text-primary-700 bg-primary-50' },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground sm:text-xs">{s.label}</p>
                      <p className="text-xl font-bold text-foreground sm:text-2xl">{s.value || 0}</p>
                    </div>
                    <div className={`rounded-lg p-2 shrink-0 ${s.color}`}>
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Attendance rate */}
      {classification.employees.total > 0 && (
        <Card className="mb-5">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">Attendance Rate</p>
                <p className="text-xs text-muted-foreground">Registered employees who checked in</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-2xl font-bold text-primary">
                  {Math.round((classification.employees.checkedIn / classification.employees.total) * 100)}%
                </p>
              </div>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-ust-gray-300">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(classification.employees.checkedIn / classification.employees.total) * 100}%` }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="h-full rounded-full bg-primary"
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>{classification.employees.checkedIn} checked in</span>
              <span>{classification.employees.pending} pending</span>
              <span>{classification.employees.total} total</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Classification breakdown */}
        {classificationItems.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <PieChart className="h-4 w-4 text-primary" />
                Attendee Classification
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {classificationItems.map((item, i) => {
                  const Icon = item.icon;
                  const pct = totalAttendees > 0 ? Math.round((item.value / totalAttendees) * 100) : 0;
                  return (
                    <motion.div
                      key={item.key}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.08 }}
                    >
                      <div className="flex items-center gap-2.5 mb-1">
                        <div className={`rounded-md p-1 ${item.color}`}>
                          <Icon className="h-3 w-3" />
                        </div>
                        <span className="text-xs font-medium flex-1">{item.label}</span>
                        <span className="text-sm font-bold">{item.value}</span>
                        <span className="text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-ust-gray-300">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: 0.5 + i * 0.08, duration: 0.5 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: item.barColor }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Food breakdown */}
        {foodBreakdown.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <UtensilsCrossed className="h-4 w-4 text-primary" />
                Food Preferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {foodBreakdown.map((item, i) => {
                  const totalFood = foodBreakdown.reduce((s, f) => s + f.count, 0);
                  const pct = totalFood > 0 ? Math.round((item.count / totalFood) * 100) : 0;
                  return (
                    <motion.div
                      key={item.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.08 }}
                    >
                      <div className="flex items-center gap-2.5 mb-1">
                        <span className="text-xs font-medium flex-1">{item.name}</span>
                        <span className="text-sm font-bold">{item.count}</span>
                        <span className="text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-ust-gray-300">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: 0.5 + i * 0.08, duration: 0.5 }}
                          className="h-full rounded-full bg-primary"
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Slot breakdown */}
      {slotBreakdown.length > 0 && (
        <Card className="mt-5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-primary" />
              Attendance by Time Slot
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {slotBreakdown.map((slot, i) => (
                <motion.div
                  key={slot.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.06 }}
                  className="rounded-lg border p-3 text-center"
                >
                  <p className="text-xs font-medium text-foreground mb-2">{slot.label}</p>
                  <p className="text-2xl font-bold text-primary">{slot.employees + slot.walkIns}</p>
                  <div className="mt-1.5 flex justify-center gap-3 text-[10px] text-muted-foreground">
                    <span>{slot.employees} emp</span>
                    <span>{slot.walkIns} walk-in</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Check-in timeline */}
      {checkInTimeline.length > 0 && (
        <Card className="mt-5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BarChart3 className="h-4 w-4 text-primary" />
              Check-in Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {checkInTimeline.map((t, i) => (
                <motion.div
                  key={t.hour}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  className="flex items-center gap-3"
                >
                  <span className="text-xs font-mono text-muted-foreground w-12 shrink-0">{t.hour}</span>
                  <div className="flex-1 flex h-6 gap-0.5 rounded overflow-hidden">
                    {t.employees > 0 && (
                      <div
                        className="bg-primary rounded-l flex items-center justify-center"
                        style={{ width: `${(t.employees / maxTimeline) * 100}%`, minWidth: t.employees > 0 ? 20 : 0 }}
                      >
                        <span className="text-[9px] text-white font-medium">{t.employees}</span>
                      </div>
                    )}
                    {t.walkIns > 0 && (
                      <div
                        className="bg-amber-400 rounded-r flex items-center justify-center"
                        style={{ width: `${(t.walkIns / maxTimeline) * 100}%`, minWidth: t.walkIns > 0 ? 20 : 0 }}
                      >
                        <span className="text-[9px] text-amber-900 font-medium">{t.walkIns}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-bold w-8 text-right">{t.total}</span>
                </motion.div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-primary" /> Employees</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-amber-400" /> Walk-ins</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No-show info */}
      {classification.employees.pending > 0 && (
        <Card className="mt-5">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-50 p-2.5">
                <Users className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{classification.employees.pending} Registered but Not Checked In</p>
                <p className="text-xs text-muted-foreground">
                  These employees registered but did not attend. Download the full report for details.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
