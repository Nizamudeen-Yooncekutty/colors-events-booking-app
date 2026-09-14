import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

const LoadingMore = forwardRef(function LoadingMore({ loading }, ref) {
  return (
    <div ref={ref} className="flex justify-center py-4">
      {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
    </div>
  );
});

export default LoadingMore;
