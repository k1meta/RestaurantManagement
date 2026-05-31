import React from 'react';

/**
 * Fixed-position toast container. Renders in the bottom-left corner.
 * Newer toasts appear at the BOTTOM of the stack, older ones rise upward.
 *
 * Props:
 *   toasts      - Array of { id, message, type: 'success'|'error', exiting }
 *   removeToast - Function to dismiss a toast by id
 */
export default function ToastContainer({ toasts, removeToast }) {
  if (!toasts.length) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: '400px',
        width: '100%',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => {
        const isError = toast.type === 'error';
        return (
          <button
            key={toast.id}
            type="button"
            onClick={() => removeToast(toast.id)}
            className={toast.exiting ? 'toast-exit' : 'toast-enter'}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              borderLeft: `4px solid ${isError ? '#b3261e' : '#1b6d24'}`,
              background: isError ? '#ffdad6' : '#c4eed0',
              color: isError ? '#601410' : '#0a3818',
              fontSize: '13px',
              fontFamily: "'Work Sans', sans-serif",
              fontWeight: 700,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
              lineHeight: 1.4,
              cursor: 'pointer',
              border: 'none',
              borderLeftStyle: 'solid',
              borderLeftWidth: '4px',
              borderLeftColor: isError ? '#b3261e' : '#1b6d24',
              textAlign: 'left',
              width: '100%',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
              animation: isError
                ? undefined
                : undefined,
              /* error toasts also get a pulsing border */
              ...(isError && !toast.exiting
                ? { animation: 'toast-pulse-border 2s ease-in-out infinite' }
                : {}),
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: '18px',
                flexShrink: 0,
                fontVariationSettings: "'FILL' 1",
              }}
            >
              {isError ? 'error' : 'check_circle'}
            </span>
            <span style={{ flex: 1 }}>{toast.message}</span>
          </button>
        );
      })}
    </div>
  );
}
