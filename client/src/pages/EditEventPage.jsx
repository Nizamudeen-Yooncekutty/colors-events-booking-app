import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Plus, X, Save, Clock } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';

export default function EditEventPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [form, setForm] = useState({
    title: '',
    description: '',
    eventDate: '',
    venue: '',
    registrationStart: '',
    registrationEnd: '',
    maxCapacity: '',
    status: 'active',
  });
  const [foodOptions, setFoodOptions] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);

  const addTimeSlot = () => {
    setTimeSlots([...timeSlots, { label: '', startTime: '', endTime: '', maxCapacity: '' }]);
  };

  const removeTimeSlot = (index) => {
    setTimeSlots(timeSlots.filter((_, i) => i !== index));
  };

  const updateTimeSlot = (index, field, value) => {
    const updated = [...timeSlots];
    updated[index][field] = value;
    setTimeSlots(updated);
  };

  useEffect(() => {
    api.get(`/events/${eventId}`)
      .then(res => {
        const e = res.data.event;
        setForm({
          title: e.title || '',
          description: e.description || '',
          eventDate: e.eventDate?.split('T')[0] || '',
          venue: e.venue || '',
          registrationStart: e.registrationStart?.split('T')[0] || '',
          registrationEnd: e.registrationEnd?.split('T')[0] || '',
          maxCapacity: e.maxCapacity || '',
          status: e.status || 'active',
        });
        setFoodOptions(
          e.foodOptions?.map(o => ({ name: o.name, description: o.description || '' })) || []
        );
        setTimeSlots(
          e.timeSlots?.map(s => ({
            label: s.label || '',
            startTime: s.startTime || '',
            endTime: s.endTime || '',
            maxCapacity: s.maxCapacity || '',
          })) || []
        );
      })
      .catch(() => navigate('/admin'))
      .finally(() => setLoading(false));
  }, [eventId, navigate]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setFieldErrors(prev => ({ ...prev, [e.target.name]: '' }));
  };

  const addFoodOption = () => {
    setFoodOptions([...foodOptions, { name: '', description: '' }]);
  };

  const removeFoodOption = (index) => {
    setFoodOptions(foodOptions.filter((_, i) => i !== index));
  };

  const updateFoodOption = (index, field, value) => {
    const updated = [...foodOptions];
    updated[index][field] = value;
    setFoodOptions(updated);
  };

  const validateAll = () => {
    const errors = {};
    if (!form.title.trim()) {
      errors.title = 'Event Title is required';
    } else if (form.title.trim().length < 2 || form.title.trim().length > 200) {
      errors.title = 'Event Title must be 2-200 characters';
    }
    if (!form.eventDate) {
      errors.eventDate = 'Event Date is required';
    }
    if (!form.venue.trim()) {
      errors.venue = 'Venue is required';
    } else if (form.venue.trim().length < 2 || form.venue.trim().length > 200) {
      errors.venue = 'Venue must be 2-200 characters';
    }
    if (!form.registrationStart) {
      errors.registrationStart = 'Registration Start is required';
    }
    if (!form.registrationEnd) {
      errors.registrationEnd = 'Registration End is required';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!validateAll()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        maxCapacity: form.maxCapacity ? parseInt(form.maxCapacity) : 0,
        foodOptions: foodOptions.filter(o => o.name.trim()),
        timeSlots: timeSlots
          .filter(s => s.label.trim() && s.startTime && s.endTime)
          .map(s => ({ ...s, maxCapacity: s.maxCapacity ? parseInt(s.maxCapacity) : 0 })),
      };
      await api.put(`/events/${eventId}`, payload);
      setSuccess('Event updated successfully!');
      setTimeout(() => navigate(`/admin/events/${eventId}`), 1200);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update event');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <Skeleton className="mb-3 h-8 w-24" />
        <Card><div className="p-4 space-y-3"><Skeleton className="h-6 w-48" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div></Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Button variant="ghost" className="mb-3 gap-1.5 text-muted-foreground -ml-2 text-sm" onClick={() => navigate(`/admin/events/${eventId}`)}>
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Save className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
              Edit Event
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="rounded-md bg-error-light p-2.5 text-xs text-error sm:p-3 sm:text-sm">{error}</motion.div>
              )}
              {success && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="rounded-md bg-success-light p-2.5 text-xs text-green-700 sm:p-3 sm:text-sm">{success}</motion.div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="title">Event Title *</Label>
                <Input id="title" name="title" value={form.title} onChange={handleChange} required className={`${fieldErrors.title ? 'border-error' : 'border-ust-gray-400'}`} />
                {fieldErrors.title && <p className="text-error text-[10px] font-medium mt-0.5">{fieldErrors.title}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  className="flex min-h-16 w-full rounded-md border border-ust-gray-400 bg-ust-gray-200 px-3 py-2 text-sm ring-offset-background placeholder:text-ust-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                  style={{ fieldSizing: 'content' }}
                />
              </div>

              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 sm:gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="eventDate">Event Date *</Label>
                  <DatePicker
                    value={form.eventDate}
                    onChange={(e) => handleChange({ target: { name: 'eventDate', value: e.target.value } })}
                    placeholder="Select event date"
                    hasError={!!fieldErrors.eventDate}
                  />
                  {fieldErrors.eventDate && <p className="text-error text-[10px] font-medium mt-0.5">{fieldErrors.eventDate}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="venue">Venue *</Label>
                  <Input id="venue" name="venue" value={form.venue} onChange={handleChange} required className={`${fieldErrors.venue ? 'border-error' : 'border-ust-gray-400'}`} />
                  {fieldErrors.venue && <p className="text-error text-[10px] font-medium mt-0.5">{fieldErrors.venue}</p>}
                </div>
              </div>

              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 sm:gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="registrationStart">Registration Start *</Label>
                  <DatePicker
                    value={form.registrationStart}
                    onChange={(e) => handleChange({ target: { name: 'registrationStart', value: e.target.value } })}
                    placeholder="Select start date"
                    hasError={!!fieldErrors.registrationStart}
                  />
                  {fieldErrors.registrationStart && <p className="text-error text-[10px] font-medium mt-0.5">{fieldErrors.registrationStart}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="registrationEnd">Registration End *</Label>
                  <DatePicker
                    value={form.registrationEnd}
                    onChange={(e) => handleChange({ target: { name: 'registrationEnd', value: e.target.value } })}
                    placeholder="Select end date"
                    hasError={!!fieldErrors.registrationEnd}
                  />
                  {fieldErrors.registrationEnd && <p className="text-error text-[10px] font-medium mt-0.5">{fieldErrors.registrationEnd}</p>}
                </div>
              </div>

              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 sm:gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="maxCapacity">Max Capacity (0 = unlimited)</Label>
                  <Input id="maxCapacity" name="maxCapacity" type="number" min="0" value={form.maxCapacity} onChange={handleChange} className="border-ust-gray-400" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className="flex h-10 w-full rounded-md border border-ust-gray-400 bg-ust-gray-200 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="closed">Closed</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              {/* Time Slots */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    Time Slots
                  </Label>
                  <Button type="button" variant="outline" size="sm" className="gap-1 text-xs" onClick={addTimeSlot}>
                    <Plus className="h-3 w-3" />
                    Add Slot
                  </Button>
                </div>
                {timeSlots.length === 0 && (
                  <p className="text-xs text-muted-foreground">No time slots — the event will be a single session.</p>
                )}
                {timeSlots.map((slot, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="rounded-lg border border-ust-gray-400 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Slot {index + 1}</span>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeTimeSlot(index)} className="h-6 w-6 text-error hover:bg-error-light">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Input
                      placeholder="Slot label (e.g. Morning Session)"
                      value={slot.label}
                      onChange={(e) => updateTimeSlot(index, 'label', e.target.value)}
                      className="border-ust-gray-400"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Start Time</label>
                        <Input
                          type="time"
                          value={slot.startTime}
                          onChange={(e) => updateTimeSlot(index, 'startTime', e.target.value)}
                          className="border-ust-gray-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">End Time</label>
                        <Input
                          type="time"
                          value={slot.endTime}
                          onChange={(e) => updateTimeSlot(index, 'endTime', e.target.value)}
                          className="border-ust-gray-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Capacity (0=∞)</label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={slot.maxCapacity}
                          onChange={(e) => updateTimeSlot(index, 'maxCapacity', e.target.value)}
                          className="border-ust-gray-400"
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Food Options */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label>Food Options</Label>
                  <Button type="button" variant="outline" size="sm" className="gap-1 text-xs" onClick={addFoodOption}>
                    <Plus className="h-3 w-3" />
                    Add
                  </Button>
                </div>
                {foodOptions.map((opt, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="flex flex-col gap-2 sm:flex-row"
                  >
                    <Input
                      placeholder="Option name"
                      value={opt.name}
                      onChange={(e) => updateFoodOption(index, 'name', e.target.value)}
                      className="border-ust-gray-400"
                    />
                    <Input
                      placeholder="Description"
                      value={opt.description}
                      onChange={(e) => updateFoodOption(index, 'description', e.target.value)}
                      className="border-ust-gray-400"
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeFoodOption(index)} className="shrink-0 text-error hover:bg-error-light self-end sm:self-auto">
                      <X className="h-4 w-4" />
                    </Button>
                  </motion.div>
                ))}
              </div>

              <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                <Button type="submit" size="lg" className="flex-1 gap-2 text-sm" disabled={saving}>
                  {saving ? (
                    <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Saving...</>
                  ) : (
                    <><Save className="h-4 w-4" />Save Changes</>
                  )}
                </Button>
                <Button type="button" variant="outline" size="lg" className="text-sm sm:w-auto" onClick={() => navigate(`/admin/events/${eventId}`)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
