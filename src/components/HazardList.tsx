import { useState } from "react";

interface DemoModeProps {
  onAddHazard: (hazard: {type: "debris"|"water"|"blocked"|"branch"|"other"; lat: number; lng: number}) => void;
}

export default function HazardList({ onAddHazard }: DemoModeProps) {
  const [demoActive, setDemoActive] = useState(false);

  // Atlanta trail coordinates for demo hazards
  const demoHazards = [
    { type: "debris" as const, lat: 33.7756, lng: -84.3897, name: "Fallen tree" },
    { type: "water" as const, lat: 33.7741, lng: -84.3884, name: "Flooded path" },
    { type: "blocked" as const, lat: 33.7762, lng: -84.3913, name: "Trail closed" },
    { type: "debris" as const, lat: 33.7750, lng: -84.3901, name: "Rockslide" },
    { type: "water" as const, lat: 33.7768, lng: -84.3889, name: "Stream crossing" }
  ];

  function startDemo() {
    setDemoActive(true);
    
    demoHazards.forEach((hazard, index) => {
      setTimeout(() => {
        onAddHazard({
          type: hazard.type,
          lat: hazard.lat,
          lng: hazard.lng
        });
      }, index * 1500); // Stagger the additions
    });

    setTimeout(() => {
      setDemoActive(false);
    }, demoHazards.length * 1500);
  }

  return (
    <div className="demo-mode">
      <button 
        className={demoActive ? "btn-secondary" : "btn-primary"} 
        onClick={startDemo}
        disabled={demoActive}
        style={{ width: '100%', marginBottom: '10px' }}
      >
        {demoActive ? "🎬 Demo Running..." : "🎬 Start Demo"}
      </button>
      
      {demoActive && (
        <div className="demo-info">
          <div style={{ 
            fontSize: '12px', 
            color: '#666', 
            textAlign: 'center',
            padding: '5px 10px',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
            marginBottom: '5px'
          }}>
            📍 Adding demo hazards to map...
          </div>
        </div>
      )}
    </div>
  );
}