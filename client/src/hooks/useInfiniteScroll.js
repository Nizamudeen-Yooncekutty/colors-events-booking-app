import { useState, useEffect, useCallback, useRef } from 'react';

export default function useInfiniteScroll(fetchFn, { deps = [], enabled = true } = {}) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const sentinelRef = useRef(null);
  const pageRef = useRef(1);

  const load = useCallback(async (page, append = false) => {
    if (!enabled) return;
    if (page === 1) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const result = await fetchFn(page);
      setItems(prev => append ? [...prev, ...result.items] : result.items);
      setPagination(result.pagination);
      pageRef.current = page;
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [fetchFn, enabled]);

  const reset = useCallback(() => {
    pageRef.current = 1;
    setItems([]);
    setPagination(null);
    load(1, false);
  }, [load]);

  useEffect(() => {
    pageRef.current = 1;
    load(1, false);
  }, [...deps, load]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && pagination?.hasMore && !loadingMore && !loading) {
          load(pageRef.current + 1, true);
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [pagination?.hasMore, loadingMore, loading, load]);

  return { items, setItems, pagination, loading, loadingMore, error, sentinelRef, reset };
}
