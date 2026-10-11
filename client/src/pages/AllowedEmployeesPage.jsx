import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Upload, Trash2, X, Users, MapPin, FileText } from 'lucide-react';

export default function AllowedEmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [newUid, setNewUid] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [bulkResult, setBulkResult] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkUids, setBulkUids] = useState('');
  const [bulkLocation, setBulkLocation] = useState('');

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (search) params.search = search;
      if (locationFilter) params.location = locationFilter;
      const res = await api.get('/admin/allowed-employees', { params });
      setEmployees(res.data.employees);
      setLocations(res.data.locations);
      setPagination(res.data.pagination);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [page, search, locationFilter]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const handleAddSingle = async (e) => {
    e.preventDefault();
    setAddError('');
    setAddSuccess('');
    if (!newUid.trim() || !newLocation.trim()) {
      setAddError('Both UID and Location are required');
      return;
    }
    try {
      await api.post('/admin/allowed-employees', { uid: newUid.trim(), name: newName.trim(), location: newLocation.trim() });
      setAddSuccess(`${newUid.toUpperCase()} added successfully`);
      setNewUid('');
      setNewName('');
      setNewLocation('');
      fetchEmployees();
    } catch (err) {
      setAddError(err.response?.data?.message || 'Failed to add');
    }
  };

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBulkResult(null);
    setAddError('');

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target.result;
        const lines = text.split('\n').filter(l => l.trim());
        const header = lines[0].toLowerCase();
        const startIdx = (header.includes('uid') || header.includes('employee')) ? 1 : 0;

        const entries = [];
        for (let i = startIdx; i < lines.length; i++) {
          const parts = lines[i].split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
          if (parts.length >= 3 && parts[0] && parts[2]) {
            entries.push({ uid: parts[0], name: parts[1] || '', location: parts[2] });
          } else if (parts.length >= 2 && parts[0] && parts[1]) {
            entries.push({ uid: parts[0], name: '', location: parts[1] });
          }
        }

        if (entries.length === 0) {
          setAddError('No valid entries found in CSV. Format: uid,name,location');
          return;
        }

        const res = await api.post('/admin/allowed-employees/bulk', { entries });
        setBulkResult(res.data);
        fetchEmployees();
      } catch (err) {
        setAddError(err.response?.data?.message || 'Bulk upload failed');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleBulkAdd = async (e) => {
    e.preventDefault();
    setAddError('');
    setBulkResult(null);
    if (!bulkUids.trim() || !bulkLocation.trim()) {
      setAddError('Both UIDs and Location are required');
      return;
    }
    const uids = bulkUids.split(/[\n,;]+/).map(u => u.trim()).filter(Boolean);
    if (uids.length === 0) {
      setAddError('No valid UIDs found');
      return;
    }
    try {
      const entries = uids.map(uid => ({ uid, location: bulkLocation.trim() }));
      const res = await api.post('/admin/allowed-employees/bulk', { entries });
      setBulkResult(res.data);
      setBulkUids('');
      setBulkLocation('');
      fetchEmployees();
    } catch (err) {
      setAddError(err.response?.data?.message || 'Bulk add failed');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/admin/allowed-employees/${id}`);
      fetchEmployees();
    } catch {
      // handled
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      await api.post('/admin/allowed-employees/bulk/delete', { ids: selectedIds });
      setSelectedIds([]);
      fetchEmployees();
    } catch {
      // handled
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === employees.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(employees.map(e => e._id));
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Allowed Employees</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">Manage which employees can access events and bookings</p>
      </div>

      {/* Stats */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{pagination?.total || 0} Total</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{locations.length} Locations</span>
        </div>
      </div>

      {/* Actions */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => { setShowAddForm(!showAddForm); setShowBulkUpload(false); setShowBulkAdd(false); }}>
          <Plus className="mr-1 h-4 w-4" /> Add Single
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setShowBulkAdd(!showBulkAdd); setShowAddForm(false); setShowBulkUpload(false); }}>
          <Users className="mr-1 h-4 w-4" /> Bulk Add
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setShowBulkUpload(!showBulkUpload); setShowAddForm(false); setShowBulkAdd(false); }}>
          <Upload className="mr-1 h-4 w-4" /> Bulk Upload CSV
        </Button>
        {selectedIds.length > 0 && (
          <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
            <Trash2 className="mr-1 h-4 w-4" /> Delete {selectedIds.length} Selected
          </Button>
        )}
      </div>

      {/* Add Single Form */}
      {showAddForm && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-4 rounded-lg border bg-white p-4">
          <form onSubmit={handleAddSingle} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[120px]">
              <Label className="text-xs">Employee UID</Label>
              <Input placeholder="e.g. 196285" value={newUid} onChange={e => setNewUid(e.target.value)} />
            </div>
            <div className="flex-1 min-w-[150px]">
              <Label className="text-xs">Name</Label>
              <Input placeholder="e.g. Rajesh Kumar" value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <div className="flex-1 min-w-[120px]">
              <Label className="text-xs">Location</Label>
              <Input placeholder="e.g. Trivandrum" value={newLocation} onChange={e => setNewLocation(e.target.value)} />
            </div>
            <Button type="submit" size="sm">Add</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddForm(false)}><X className="h-4 w-4" /></Button>
          </form>
          {addError && <p className="mt-2 text-xs text-error">{addError}</p>}
          {addSuccess && <p className="mt-2 text-xs text-success">{addSuccess}</p>}
        </motion.div>
      )}

      {/* Bulk Add (manual paste) */}
      {showBulkAdd && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-4 rounded-lg border bg-white p-4">
          <form onSubmit={handleBulkAdd} className="space-y-3">
            <div>
              <Label className="text-xs">Location (common for all UIDs)</Label>
              <Input placeholder="e.g. TVM" value={bulkLocation} onChange={e => setBulkLocation(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Employee UIDs (one per line, or comma/semicolon separated)</Label>
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={"196285\n196286\n196287\nor: 196285, 196286, 196287"}
                value={bulkUids}
                onChange={e => setBulkUids(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {bulkUids.split(/[\n,;]+/).filter(u => u.trim()).length} UIDs entered
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm">Add All</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowBulkAdd(false)}><X className="h-4 w-4" /></Button>
            </div>
          </form>
          {bulkResult && (
            <div className="mt-3 rounded-md bg-muted p-3 text-xs">
              <p>Total: {bulkResult.total} | Added: <span className="font-medium text-success">{bulkResult.added}</span> | Skipped (duplicates): {bulkResult.skipped} | Errors: {bulkResult.errors}</p>
            </div>
          )}
          {addError && <p className="mt-2 text-xs text-error">{addError}</p>}
        </motion.div>
      )}

      {/* Bulk Upload */}
      {showBulkUpload && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-4 rounded-lg border bg-white p-4">
          <div className="mb-2">
            <p className="text-sm font-medium">Upload CSV File</p>
            <p className="text-xs text-muted-foreground">CSV format: <code className="rounded bg-muted px-1">uid,location</code> (one per line)</p>
            <p className="text-xs text-muted-foreground mt-1">Example:</p>
            <pre className="mt-1 rounded bg-muted p-2 text-xs">uid,name,location{'\n'}196285,Rajesh Kumar,Trivandrum{'\n'}196286,Priya Nair,Trivandrum{'\n'}196287,Arun Das,Kochi</pre>
          </div>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer">
              <input type="file" accept=".csv,.txt" onChange={handleBulkUpload} className="hidden" />
              <span className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary/90">
                <FileText className="h-4 w-4" /> Choose CSV File
              </span>
            </label>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowBulkUpload(false)}><X className="h-4 w-4" /></Button>
          </div>
          {bulkResult && (
            <div className="mt-3 rounded-md bg-muted p-3 text-xs">
              <p>Total: {bulkResult.total} | Added: <span className="font-medium text-success">{bulkResult.added}</span> | Skipped (duplicates): {bulkResult.skipped} | Errors: {bulkResult.errors}</p>
            </div>
          )}
          {addError && <p className="mt-2 text-xs text-error">{addError}</p>}
        </motion.div>
      )}

      {/* Search and Filter */}
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by UID or location..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        {locations.length > 0 && (
          <select
            value={locationFilter}
            onChange={e => { setLocationFilter(e.target.value); setPage(1); }}
            className="rounded-md border bg-white px-3 py-2 text-sm"
          >
            <option value="">All Locations</option>
            {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : employees.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No allowed employees found. Add employees to control event access.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left">
                  <input type="checkbox" checked={selectedIds.length === employees.length && employees.length > 0} onChange={toggleSelectAll} />
                </th>
                <th className="px-3 py-2 text-left font-medium">UID</th>
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">Location</th>
                <th className="px-3 py-2 text-left font-medium">Added By</th>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp._id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selectedIds.includes(emp._id)} onChange={() => toggleSelect(emp._id)} />
                  </td>
                  <td className="px-3 py-2 font-mono font-medium">{emp.uid}</td>
                  <td className="px-3 py-2 text-sm">{emp.name || '—'}</td>
                  <td className="px-3 py-2"><Badge variant="outline">{emp.location}</Badge></td>
                  <td className="px-3 py-2 text-muted-foreground">{emp.addedBy?.name || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(emp.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(emp._id)}>
                      <Trash2 className="h-4 w-4 text-error" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {pagination.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
