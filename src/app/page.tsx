'use client'

import TrailMixLogo from '@/components/TrailMixLogo';

export default function HomePage() {
  const features = [
    {
      icon: '📸',
      title: 'Live Detection',
      description: 'AI-powered camera detection to identify trail hazards in real-time',
      link: '/detect'
    },
    {
      icon: '🗺️',
      title: 'Interactive Map',
      description: 'View and report hazards on an interactive trail map with GPS tracking',
      link: '/map'
    },
    {
      icon: '💬',
      title: 'AI Assistant',
      description: 'Get instant trail safety advice and hiking tips from our AI assistant',
      link: '/chat'
    }
  ];

  return (
    <div className="home-page">
      <div className="home-hero">
        <div className="home-logo-large">
          <TrailMixLogo size={120} />
        </div>
        <h1 className="home-title">
          <span className="trail-text">Trail</span>
          <span className="mix-text">Mix</span>
        </h1>
        <p className="home-motto">Explore Smarter, Adventure Safer</p>
        <p className="home-description">
          Your intelligent companion for safer trail adventures. 
          Detect hazards, navigate trails, and get expert safety advice—all in one app.
        </p>
      </div>

      <div className="home-features">
        <h2 className="home-features-title">Features</h2>
        <div className="home-features-grid">
          {features.map((feature, index) => (
            <a
              key={index}
              href={feature.link}
              className="home-feature-card"
            >
              <div className="feature-icon-large">{feature.icon}</div>
              <h3 className="feature-card-title">{feature.title}</h3>
              <p className="feature-card-description">{feature.description}</p>
              <span className="feature-card-link">Learn more →</span>
            </a>
          ))}
        </div>
      </div>

      <div className="home-info">
        <div className="home-info-card">
          <h3 className="info-card-title">🌲 About TrailMix</h3>
          <p className="info-card-text">
            TrailMix is designed to make outdoor adventures safer and more enjoyable. 
            Our AI-powered platform helps hikers, trail runners, and outdoor enthusiasts 
            identify potential hazards, navigate trails, and access expert safety advice.
          </p>
        </div>
        
        <div className="home-info-card">
          <h3 className="info-card-title">🚀 Get Started</h3>
          <p className="info-card-text">
            Start by using the Live Detection feature to scan for hazards, explore the 
            interactive map to see reported issues, or chat with our AI assistant for 
            personalized trail safety advice.
          </p>
        </div>
      </div>
    </div>
  );
}
