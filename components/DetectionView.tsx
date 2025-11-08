import { useEffect, useRef, useState } from "react";

type Props = {
  onHazardReport: (hazard: {type:"debris"|"water"|"blocked"; lat:number; lng:number}) => void;
  getPosition: () => Promise<{lat:number; lng:number}>;
};

export default function DetectionView({ onHazardReport, getPosition }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setCameraReady(true);
        }
      } catch (error) {
        console.error('Camera access failed:', error);
        alert('📱 Camera access required for hazard detection');
      }
    })();
  }, []);

  async function reportHazard(type: "debris" | "water" | "blocked") {
    try {
      const pos = await getPosition();
      onHazardReport({ type, lat: pos.lat, lng: pos.lng });
      
      // Visual feedback
      setIsRecording(true);
      setTimeout(() => setIsRecording(false), 1000);
      
      const emoji = type === "debris" ? "🪨" : type === "water" ? "💧" : "🚫";
      alert(`${emoji} ${type.charAt(0).toUpperCase() + type.slice(1)} hazard reported!`);
    } catch (error) {
      alert("❌ Could not get your location");
    }
  }

  return (
    <div className="camera-container">
      <div className="relative">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="camera-video"
          style={{ 
            filter: isRecording ? 'brightness(1.2) contrast(1.1)' : 'none',
            transition: 'filter 0.3s ease'
          }}
        />
        
        {/* Camera overlay */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
            {cameraReady ? '🔴 Live' : '⏳ Loading...'}
          </div>
          
          {isRecording && (
            <div className="absolute inset-0 bg-white bg-opacity-20 flex items-center justify-center">
              <div className="bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg">
                ✅ Hazard Recorded!
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="camera-controls">
        <div className={`camera-status ${isRecording ? 'detecting' : ''}`}>
          {isRecording ? '📍 Recording hazard...' : '📱 Tap a button to report hazards'}
        </div>
        
        <div className="camera-controls-row">
          <button 
            className="btn-debris" 
            onClick={() => reportHazard("debris")}
            style={{ flex: 1 }}
            disabled={!cameraReady}
          >
            🪨 Debris
          </button>
          
          <button 
            className="btn-water" 
            onClick={() => reportHazard("water")}
            style={{ flex: 1 }}
            disabled={!cameraReady}
          >
            💧 Water
          </button>
          
          <button 
            className="btn-blocked" 
            onClick={() => reportHazard("blocked")}
            style={{ flex: 1 }}
            disabled={!cameraReady}
          >
            🚫 Blocked
          </button>
        </div>
      </div>
    </div>
  );
}