import React from 'react';
import { Button } from './Button';

function renderHeader(title: string) {
  return `<h1>${title}</h1>`;
}

export function Header() {
  const handleLogoClick = () => {
    window.location.href = '/';
  };

  function getNavigationItems() {
    return ['Home', 'About', 'Contact'];
  }

  return (
    <header className="main-header">
      <div className="logo" onClick={handleLogoClick}>
        Periscope Test
      </div>
      <nav>
        {getNavigationItems().map((item) => (
          <Button key={item} label={item} onClick={() => {}} />
        ))}
      </nav>
    </header>
  );
}
