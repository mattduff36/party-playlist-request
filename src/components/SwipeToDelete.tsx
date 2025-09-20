import { useCallback, useEffect, useState, useRef, ReactNode } from "react"

interface SwipeToDeleteProps {
  children: ReactNode;
  onDelete: () => void;
  disabled?: boolean;
  className?: string;
}

export default function SwipeToDelete({ children, onDelete, disabled = false, className }: SwipeToDeleteProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!wrapperRef.current?.contains(e.target as Node) || disabled) {
      return;
    }

    setStartX(e.touches[0].clientX);
    setStartY(e.touches[0].clientY);
  }, [disabled]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!wrapperRef.current?.contains(e.target as Node) || disabled) {
      return;
    }

    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - startX;
    const deltaY = endY - startY;

    // Check if it's a horizontal swipe (more horizontal than vertical)
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Swipe left to delete (negative deltaX)
      if (deltaX < -100) { // Minimum swipe distance of 100px
        setIsDeleting(true);
        setTimeout(() => {
          onDelete();
        }, 200); // Small delay for animation
      }
    }
  }, [startX, startY, onDelete, disabled]);

  useEffect(() => {
    const handleTouchStartPassive = (e: TouchEvent) => handleTouchStart(e);
    const handleTouchEndPassive = (e: TouchEvent) => handleTouchEnd(e);

    document.addEventListener("touchstart", handleTouchStartPassive, { passive: true });
    document.addEventListener("touchend", handleTouchEndPassive, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStartPassive);
      document.removeEventListener("touchend", handleTouchEndPassive);
    };
  }, [handleTouchStart, handleTouchEnd]);

  return (
    <div 
      ref={wrapperRef}
      className={`transition-all duration-200 ${
        isDeleting ? 'opacity-0 transform translate-x-full' : 'opacity-100 transform translate-x-0'
      } ${className || ''}`}
    >
      {children}
    </div>
  );
}
