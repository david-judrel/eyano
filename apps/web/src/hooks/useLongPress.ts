import { useCallback, useRef, useState } from 'react';

interface UseLongPressOptions {
  delay?: number;
  onLongPress: () => void;
}

export function useLongPress({ delay = 500, onLongPress }: UseLongPressOptions) {
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const timeout = useRef<NodeJS.Timeout>();
  const target = useRef<EventTarget>();

  const start = useCallback((event: React.TouchEvent | React.MouseEvent) => {
    target.current = event.target;
    timeout.current = setTimeout(() => {
      onLongPress();
      setLongPressTriggered(true);
    }, delay);
  }, [delay, onLongPress]);

  const clear = useCallback((event: React.TouchEvent | React.MouseEvent, shouldTriggerClick = true) => {
    if (timeout.current && shouldTriggerClick && !longPressTriggered) {
      // Si c'était un clic court normal, on laisse faire
    }
    if (timeout.current) clearTimeout(timeout.current);
    setLongPressTriggered(false);
  }, [longPressTriggered]);

  return {
    onMouseDown: (e: React.MouseEvent) => start(e),
    onTouchStart: (e: React.TouchEvent) => start(e),
    onMouseUp: (e: React.MouseEvent) => clear(e),
    onMouseLeave: (e: React.MouseEvent) => clear(e, false),
    onTouchEnd: (e: React.TouchEvent) => clear(e),
  };
}