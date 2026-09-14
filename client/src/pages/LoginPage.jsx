import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, Eye, EyeOff, Shield } from 'lucide-react';
import { sanitizeEmployeeId } from '@/lib/sanitize';
import { loginRequest } from '@/auth/msalConfig';
import { useMsalInstance } from '@/auth/useMsalSafe';

export default function LoginPage() {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const { login, loginWithSSO } = useAuth();
  const navigate = useNavigate();
  const msalInstance = useMsalInstance();
  const ssoEnabled = !!msalInstance;

  const validateAll = () => {
    const errors = {};
    if (!employeeId.trim()) {
      errors.employeeId = 'Employee ID is required';
    }
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSSOLogin = () => {
    if (!msalInstance) return;
    setError('');
    setSsoLoading(true);
    msalInstance.loginRedirect(loginRequest).catch((err) => {
      setSsoLoading(false);
      if (err.errorCode !== 'user_cancelled') {
        setError(err.message || 'SSO login failed');
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateAll()) return;
    setLoading(true);
    try {
      const data = await login(employeeId, password);
      navigate(data.employee.role === 'admin' ? '/admin' : '/events');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-ust-gray-200 px-4 py-8">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-ust-purple/5" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-[360px]"
      >
        <div className="rounded-xl bg-white p-5 shadow-md sm:p-8">
          <div className="mb-5 text-center sm:mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
              className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary sm:mb-4 sm:h-14 sm:w-14"
            >
              <svg className="h-6 w-6 text-white sm:h-7 sm:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </motion.div>
            <h1 className="text-base font-semibold text-foreground sm:text-lg">
              <span className="font-bold">UST</span> QPass
            </h1>
            <p className="mt-0.5 text-[11px] text-ust-gray-600 sm:text-xs">Digital Event Token System</p>
          </div>

          <div className="mb-4 sm:mb-5">
            <h2 className="text-base font-medium text-foreground sm:text-lg">Welcome Back</h2>
            <p className="text-xs text-ust-gray-800">Sign in to your account</p>
          </div>

          <div className="space-y-3.5">
            {error && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-md bg-error-light p-2.5 text-xs text-error sm:p-3 sm:text-sm"
              >
                {error}
              </motion.div>
            )}

            {ssoEnabled && (
              <Button
                type="button"
                className="w-full gap-2 rounded-full text-sm"
                size="lg"
                onClick={handleSSOLogin}
                disabled={ssoLoading}
              >
                {ssoLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Connecting to UST SSO...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4" />
                    Sign in with UST SSO
                  </>
                )}
              </Button>
            )}

            <p className="text-center text-[11px] text-muted-foreground sm:text-xs">
              Use your UST corporate credentials to sign in
            </p>
          </div>
        </div>

        <p className="mt-3 text-center text-[11px] text-ust-gray-500 sm:mt-4 sm:text-xs">
          Secure authentication powered by Microsoft Azure AD
        </p>
        <div className="mt-3 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-3.5 py-1 shadow-sm">
            <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" /></svg>
            <span className="text-[10px] text-white sm:text-xs">Powered by Color <span className="font-bold">Orange</span></span>
          </span>
        </div>
      </motion.div>
    </div>
  );
}
