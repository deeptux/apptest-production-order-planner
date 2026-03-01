import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const SnackbarContext = createContext(null);

export function SnackbarProvider({ children }) {
  const [message, setMessage] = useState(null);

  const show = useCallback((msg) => {
    setMessage(typeof msg === 'string' ? msg : 'Plan updated');
  }, []);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  return (
    <SnackbarContext.Provider value={{ show, message }}>
      {children}
      {message && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-lg shadow-lg bg-gray-800 text-white text-sm font-medium"
        >
          {message}
        </div>
      )}
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  return useContext(SnackbarContext);
}
