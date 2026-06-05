import { useEffect, useRef, useState, useCallback, createContext, useContext } from 'react';

/**
 * Context for announcing messages to screen readers via an aria-live region.
 * Used to announce split/join operations and other state changes.
 */
interface AnnouncerContextValue {
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
}

const AnnouncerContext = createContext<AnnouncerContextValue>({
  announce: () => {},
});

/**
 * Hook to access the announcer for screen reader messages.
 */
export function useAnnouncer(): AnnouncerContextValue {
  return useContext(AnnouncerContext);
}

/**
 * AnnouncerProvider wraps the app and provides a live region for screen reader
 * announcements. Messages are announced via aria-live="polite" (default) or
 * aria-live="assertive" for urgent notifications.
 *
 * Usage:
 *   <AnnouncerProvider>
 *     <App />
 *   </AnnouncerProvider>
 *
 * Then in any child component:
 *   const { announce } = useAnnouncer();
 *   announce('Subnet 10.0.0.0/16 split into two subnets');
 */
export function AnnouncerProvider({ children }: { children: React.ReactNode }) {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');
  const politeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assertiveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (priority === 'assertive') {
      // Clear previous message first to ensure re-announcement
      setAssertiveMessage('');
      if (assertiveTimeoutRef.current) {
        clearTimeout(assertiveTimeoutRef.current);
      }
      // Set new message after a brief delay to trigger re-read
      assertiveTimeoutRef.current = setTimeout(() => {
        setAssertiveMessage(message);
      }, 50);
    } else {
      setPoliteMessage('');
      if (politeTimeoutRef.current) {
        clearTimeout(politeTimeoutRef.current);
      }
      politeTimeoutRef.current = setTimeout(() => {
        setPoliteMessage(message);
      }, 50);
    }
  }, []);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (politeTimeoutRef.current) clearTimeout(politeTimeoutRef.current);
      if (assertiveTimeoutRef.current) clearTimeout(assertiveTimeoutRef.current);
    };
  }, []);

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}
      {/* Polite live region — for non-urgent announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {politeMessage}
      </div>
      {/* Assertive live region — for urgent announcements */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {assertiveMessage}
      </div>
    </AnnouncerContext.Provider>
  );
}
