import { useState, useEffect, useRef } from 'react';

interface UseTypewriterOptions {
  text: string;
  speed?: number;
  delay?: number;
  onComplete?: () => void;
}

export function useTypewriter({ text, speed = 12, delay = 200, onComplete }: UseTypewriterOptions) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const indexRef = useRef(0);
  const hasStarted = useRef(false);

  useEffect(() => {
    indexRef.current = 0;
    setDisplayedText('');
    setIsComplete(false);
    hasStarted.current = false;

    const startTimeout = setTimeout(() => {
      hasStarted.current = true;
      const interval = setInterval(() => {
        if (indexRef.current < text.length) {
          indexRef.current += 1;
          setDisplayedText(text.slice(0, indexRef.current));
        } else {
          clearInterval(interval);
          setIsComplete(true);
          onComplete?.();
        }
      }, speed);

      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(startTimeout);
  }, [text, speed, delay, onComplete]);

  return { displayedText, isComplete };
}
