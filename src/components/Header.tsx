'use client';

import { usePathname } from 'next/navigation';
import TrailMixLogo from './TrailMixLogo';

export default function Header() {
  const pathname = usePathname();

  // Page-specific configurations
  const getPageConfig = () => {
    switch (pathname) {
      case '/detect':
        return {
          icon: '📸',
          title: 'Live Detection',
          subtitle: 'AI-powered hazard detection',
          showStatus: true,
          showLogo: false,
        };
      case '/map':
        return {
          icon: '🗺️',
          title: 'Trail Map',
          subtitle: 'Interactive hazard mapping',
          showStatus: true,
          showLogo: false,
        };
      case '/chat':
        return {
          icon: '🥜',
          title: 'Peanut',
          subtitle: 'Trail safety assistant',
          showStatus: false,
          showLogo: false,
        };
      case '/profile':
        return {
          icon: '👤',
          title: 'Profile',
          subtitle: 'User settings & preferences',
          showStatus: false,
          showLogo: false,
        };
      case '/admin':
        return {
          icon: '⚙️',
          title: 'Admin',
          subtitle: 'System administration',
          showStatus: false,
          showLogo: false,
        };
      case '/':
        return {
          icon: null,
          title: 'TrailMix',
          subtitle: 'Explore Smarter, Adventure Safer',
          showStatus: false,
          showLogo: true,
        };
      default:
        return {
          icon: '🥾',
          title: 'TrailMix',
          subtitle: 'Trail safety platform',
          showStatus: false,
          showLogo: false,
        };
    }
  };

  const config = getPageConfig();
  const isHomePage = pathname === '/';

  return (
    <div className="trailmix-header">
      <div className="header-pattern"></div>
      <div className="header-content">
        <div className="header-main">
          {config.showLogo ? (
            <>
              <div className="header-logo-container">
                <TrailMixLogo size={44} />
              </div>
              <div className="header-text">
                <h1 className="header-title-logo">
                  <span className="trail-text">Trail</span>
                  <span className="mix-text">Mix</span>
                </h1>
                <p className="header-subtitle motto">{config.subtitle}</p>
              </div>
            </>
          ) : (
            <>
              <div className="header-icon">{config.icon}</div>
              <div className="header-text">
                <h1 className="header-title">{config.title}</h1>
                <p className="header-subtitle">{config.subtitle}</p>
              </div>
            </>
          )}
        </div>
        {config.showStatus && (
          <div className="header-status">
            <div className="status-dot active" title="Active"></div>
          </div>
        )}
      </div>
      <div className="header-accent"></div>
    </div>
  );
}

