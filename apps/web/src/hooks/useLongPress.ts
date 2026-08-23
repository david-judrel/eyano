import { useCallback, useRef, useState } from 'react';

interface UseLongPressOptions {
  delay?: number;
  onLongPress: (event: React.TouchEvent | React.MouseEvent) => void;
}

export function useLongPress({
  delay = 500,
  onLongPress,
}: UseLongPressOptions) {
  const [longPressTriggered, setLongPressTriggered] = useState(false);

  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(
    (event: React.TouchEvent | React.MouseEvent) => {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }

      timeout.current = setTimeout(() => {
        onLongPress(event);
        setLongPressTriggered(true);
      }, delay);
    },
    [delay, onLongPress]
  );

  const clear = useCallback(
    (_event: React.TouchEvent | React.MouseEvent) => {
      if (timeout.current) {
        clearTimeout(timeout.current);
        timeout.current = null;
      }

      setLongPressTriggered(false);
    },
    []
  );

  return {
    onMouseDown: (event: React.MouseEvent) => start(event),
    onTouchStart: (event: React.TouchEvent) => start(event),

    onMouseUp: (event: React.MouseEvent) => clear(event),
    onMouseLeave: (event: React.MouseEvent) => clear(event),
    onTouchEnd: (event: React.TouchEvent) => clear(event),
  };
}