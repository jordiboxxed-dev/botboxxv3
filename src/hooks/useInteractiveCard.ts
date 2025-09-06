import React from "react";

interface UseInteractiveCardProps {
  glowColor?: string;
}

export const useInteractiveCard = ({ glowColor = 'rgba(29, 78, 216, 0.4)' }: UseInteractiveCardProps = {}) => {
  const cardRef = React.useRef<HTMLElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!cardRef.current) return;
    const { clientX, clientY, currentTarget } = e;
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    const xPct = (clientX - left) / width;
    const yPct = (clientY - top) / height;

    const rotateX = (yPct - 0.5) * -15;
    const rotateY = (xPct - 0.5) * 15;

    cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
    cardRef.current.style.setProperty('--glow-x', `${xPct * 100}%`);
    cardRef.current.style.setProperty('--glow-y', `${yPct * 100}%`);
    cardRef.current.style.setProperty('--glow-color', glowColor);
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
  };

  return {
    ref: cardRef,
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
    className: "interactive-card"
  };
};