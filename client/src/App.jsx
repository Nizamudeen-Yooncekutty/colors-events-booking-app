import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import Layout from '@/components/Layout';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import EventsPage from '@/pages/EventsPage';
import EventDetailPage from '@/pages/EventDetailPage';
import MyBookingsPage from '@/pages/MyBookingsPage';
import BookingPassPage from '@/pages/BookingPassPage';
import ScannerPage from '@/pages/ScannerPage';
import AdminDashboard from '@/pages/AdminDashboard';
import CreateEventPage from '@/pages/CreateEventPage';
import AdminEventPage from '@/pages/AdminEventPage';
import EditEventPage from '@/pages/EditEventPage';
import EventReportPage from '@/pages/EventReportPage';
import WalkInQRPage from '@/pages/WalkInQRPage';

function ProtectedRoute({ children, roles }) {
  const { employee, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!employee) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(employee.role)) return <Navigate to="/events" replace />;

  return children;
}

function PublicRoute({ children }) {
  const { employee, loading } = useAuth();
  if (loading) return null;
  if (employee) return <Navigate to="/events" replace />;
  return children;
}

function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/events" element={<EventsPage />} />
            <Route path="/events/:id" element={<EventDetailPage />} />
            <Route path="/my-bookings" element={<MyBookingsPage />} />
            <Route path="/my-bookings/:id" element={<BookingPassPage />} />

            {/* Admin/Volunteer routes */}
            <Route path="/scanner" element={
              <ProtectedRoute roles={['admin', 'volunteer']}><ScannerPage /></ProtectedRoute>
            } />

            {/* Admin only routes */}
            <Route path="/admin" element={
              <ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>
            } />
            <Route path="/admin/create-event" element={
              <ProtectedRoute roles={['admin']}><CreateEventPage /></ProtectedRoute>
            } />
            <Route path="/admin/events/:eventId" element={
              <ProtectedRoute roles={['admin']}><AdminEventPage /></ProtectedRoute>
            } />
            <Route path="/admin/events/:eventId/edit" element={
              <ProtectedRoute roles={['admin']}><EditEventPage /></ProtectedRoute>
            } />
            <Route path="/admin/events/:eventId/report" element={
              <ProtectedRoute roles={['admin']}><EventReportPage /></ProtectedRoute>
            } />
            <Route path="/admin/events/:eventId/walkin-qr" element={
              <ProtectedRoute roles={['admin']}><WalkInQRPage /></ProtectedRoute>
            } />
          </Route>

          {/* Redirect root */}
          <Route path="/" element={<Navigate to="/events" replace />} />
          <Route path="*" element={<Navigate to="/events" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
