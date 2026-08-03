import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  CalendarDays,
  LayoutDashboard,
  LogOut,
  ScanLine,
  Ticket,
  Menu,
  X,
  ChevronDown,
  Bell,
} from 'lucide-react';
import { useState } from 'react';

export default function Layout() {
  const { employee, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAdmin = employee?.role === 'admin';
  const isVolunteer = employee?.role === 'volunteer';

  const navItems = [
    { to: '/events', label: 'Events', icon: CalendarDays },
    { to: '/my-bookings', label: 'My Bookings', icon: Ticket },
  ];
  if (isAdmin) {
    navItems.unshift({ to: '/admin', label: 'Dashboard', icon: LayoutDashboard });
  }
  if (isAdmin || isVolunteer) {
    navItems.push({ to: '/scanner', label: 'Scanner', icon: ScanLine });
  }

  const roleColor = {
    admin: 'bg-ust-purple text-white',
    volunteer: 'bg-primary text-white',
    employee: 'bg-secondary text-secondary-foreground',
  };

  const isActive = (to) => location.pathname === to || (to !== '/' && location.pathname.startsWith(to));

  return (
    <div className="min-h-[100dvh] bg-ust-gray-200">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-border bg-white safe-top">
        <div className="mx-auto flex h-12 max-w-[1200px] items-center justify-between px-3 sm:h-13 sm:px-4 lg:px-6">
          {/* Left: Brand + Nav */}
          <div className="flex items-center gap-3 sm:gap-5 min-w-0">
            <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-foreground no-underline shrink-0 sm:text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary sm:h-8 sm:w-8">
                <svg className="h-3.5 w-3.5 text-white sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <span><span className="font-bold">UST</span> PassMint</span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden items-center gap-0.5 md:flex">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.to} to={item.to} className="no-underline">
                    <button
                      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors cursor-pointer border-0 ${
                        isActive(item.to)
                          ? 'bg-accent text-accent-foreground'
                          : 'bg-transparent text-muted-foreground hover:bg-ust-gray-300 hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Profile (desktop) */}
          <div className="hidden items-center gap-2 md:flex">
            <button className="relative cursor-pointer rounded-md p-2 text-muted-foreground hover:bg-ust-gray-300 transition-colors border-0 bg-transparent">
              <Bell className="h-4 w-4" />
            </button>

            <Separator orientation="vertical" className="h-5" />

            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-ust-gray-300 cursor-pointer border-0 bg-transparent"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                  {employee?.name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="hidden text-left lg:block">
                  <p className="text-xs font-medium text-foreground leading-tight">{employee?.name}</p>
                  <p className="text-[11px] text-muted-foreground">{employee?.employeeId}</p>
                </div>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute right-0 top-11 z-50 w-52 rounded-lg border bg-white p-1.5 shadow-md"
                    >
                      <div className="px-3 py-2">
                        <p className="text-sm font-medium text-foreground">{employee?.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{employee?.email}</p>
                        <span className={`mt-1.5 inline-block rounded-md px-2 py-0.5 text-[10px] font-medium ${roleColor[employee?.role] || roleColor.employee}`}>
                          {employee?.role}
                        </span>
                      </div>
                      <Separator className="my-1" />
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-error hover:bg-error-light transition-colors cursor-pointer border-0 bg-transparent"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="rounded-md p-2 text-muted-foreground hover:bg-ust-gray-300 md:hidden cursor-pointer border-0 bg-transparent"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* ── Mobile Nav ── */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border-t bg-white md:hidden"
            >
              <div className="p-3 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.to} to={item.to} className="no-underline block" onClick={() => setMobileOpen(false)}>
                      <button
                        className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer border-0 text-left ${
                          isActive(item.to)
                            ? 'bg-accent text-accent-foreground'
                            : 'bg-transparent text-muted-foreground'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </button>
                    </Link>
                  );
                })}
                <Separator className="my-2" />
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white shrink-0">
                      {employee?.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{employee?.name}</p>
                      <p className="text-xs text-muted-foreground">{employee?.role}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-error hover:bg-error-light cursor-pointer border-0 bg-transparent shrink-0"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Main Content ── */}
      <main className="mx-auto max-w-[1200px] px-3 py-4 sm:px-4 sm:py-6 lg:px-6 safe-bottom">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Outlet />
        </motion.div>
      </main>

      {/* ── Powered by ── */}
      <footer className="py-3 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-3.5 py-1 shadow-sm">
          <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" /></svg>
          <span className="text-[10px] text-white sm:text-xs">Powered by Color <span className="font-bold">Orange</span></span>
        </span>
      </footer>
    </div>
  );
}
