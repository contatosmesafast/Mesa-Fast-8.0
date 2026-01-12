
import React, { useEffect } from 'react';

export default function Layout({ children, currentPageName }) {
  useEffect(() => {
    // Previne tradução automática do navegador
    document.documentElement.setAttribute('translate', 'no');
    document.documentElement.setAttribute('lang', 'pt-BR');
    
    const metaTag = document.querySelector('meta[name="google"]');
    if (!metaTag) {
      const meta = document.createElement('meta');
      meta.name = 'google';
      meta.content = 'notranslate';
      document.head.appendChild(meta);
    }
  }, []);
  // Pages that should have full-screen layout (no wrapper)
  const fullScreenPages = [
    'Home',
    'AdminDashboard',
    'AdminTables',
    'AdminMenu',
    'AdminStaff',
    'AdminReports',
    'WaiterDashboard',
    'TableOrder',
    'CustomerRating',
    'KitchenDashboard'
  ];

  if (fullScreenPages.includes(currentPageName)) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}
