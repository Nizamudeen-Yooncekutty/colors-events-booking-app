import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const bgColors = {
  success: 'bg-success',
  error: 'bg-error',
  warning: 'bg-warning',
  info: 'bg-primary',
};

export default function Toast({ message, type = 'info', duration = 4000, onClose }) {
  const [progress, setProgress] = useState(100);
  const Icon = icons[type];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          onClose?.();
          return 0;
        }
        return prev - (100 / (duration / 50));
      });
    }, 50);
    return () => clearInterval(interval);
  }, [duration, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`fixed top-4 right-4 z-50 min-w-[320px] max-w-[420px] rounded-lg ${bgColors[type]} text-white shadow-lg overflow-hidden`}
    >
      <div className="flex items-start gap-3 p-4">
        <Icon className="h-5 w-5 mt-0.5 shrink-0" />
        <p className="flex-1 text-sm font-medium">{message}</p>
        <button onClick={onClose} className="shrink-0 cursor-pointer opacity-80 hover:opacity-100 transition-opacity">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="h-0.5 bg-white/20">
        <div className="h-full bg-white/50 transition-all duration-50" style={{ width: `${progress}%` }} />
      </div>
    </motion.div>
  );
}
