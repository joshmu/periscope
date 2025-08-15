import React from 'react';

interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

// TODO: Add prop validation for accessibility
export function Button({ label, onClick, variant = 'primary' }: ButtonProps) {
  const handleClick = () => {
    console.log('Button clicked');
    onClick();
  };

  return (
    <button className={`btn btn-${variant}`} onClick={handleClick}>
      {label}
    </button>
  );
}

// TODO: Implement button group component
