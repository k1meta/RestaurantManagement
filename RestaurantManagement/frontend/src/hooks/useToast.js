import { useCallback, useRef, useState } from 'react';

let nextId = 1;

/**
 * Custom hook for managing toast notifications.
 *
 * Usage:
 *   const { toasts, addToast, removeToast } = useToast();
 *   addToast('Saved changes.', 'success');   // auto-dismiss 4s
 *   addToast('Something went wrong', 'error'); // auto-dismiss 6s
 */
export default function useToast() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    // Mark the toast as exiting so the component can play the swipe-out animation.
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));

    // After the CSS exit animation completes (280ms), actually remove from state.
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      if (timersRef.current[id]) {
        clearTimeout(timersRef.current[id]);
        delete timersRef.current[id];
      }
    }, 280);
  }, []);

  const addToast = useCallback(
    (message, type = 'success') => {
      const id = nextId++;
      const duration = type === 'error' ? 6000 : 4000;

      setToasts((prev) => {
        const next = [...prev, { id, message, type, exiting: false }];

        // If we exceed 5, dismiss the oldest (first non-exiting) toast.
        const visible = next.filter((t) => !t.exiting);
        if (visible.length > 5) {
          const oldest = visible[0];
          // Trigger dismiss on the oldest — schedule it for next tick so state
          // settles before we mutate again.
          setTimeout(() => removeToast(oldest.id), 0);
        }

        return next;
      });

      // Auto-dismiss timer.
      timersRef.current[id] = setTimeout(() => {
        removeToast(id);
        delete timersRef.current[id];
      }, duration);

      return id;
    },
    [removeToast]
  );

  return { toasts, addToast, removeToast };
}
