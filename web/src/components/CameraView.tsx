import React, { useEffect, useRef, useState } from "react";
import { detectHazardOnCanvas, loadModel } from "../ml/detector";
import { classifyGemini, createHazard } from "../api";

type Props = {
  onDetected: (h: {type:"debris"|"water"|"blocked"; confidence:number}) => void;
  getPosition: () => Promise<{lat:number; lng:number}>;
};

export default function CameraView({ onDetected, getPosition }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(false);
  const [geminiFallback, setGeminiFallback] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await loadModel();
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
        alert('Camera access required for hazard detection');
      }
    })();
  }, []);

  async function grabFrameBase64(): Promise<string> {
    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg").split(",")[1]; // base64 (no prefix)
  }

  async function tick() {
    if (!running) return;
    const canvas = canvasRef.current!;
    const video = videoRef.current!;
    if (!video.videoWidth) { requestAnimationFrame(tick); return; }

    // Draw latest frame
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);

    // On-device heuristic
    const onDevice = await detectHazardOnCanvas(canvas);
    let result = onDevice;

    // Optional Gemini confirm if on-device is null
    if (!result && geminiFallback) {
      const b64 = await grabFrameBase64();
      try {
        const g = await classifyGemini(b64);
        if (g?.type && g?.confidence) {
          result = { type: g.type, confidence: g.confidence };
        }
      } catch {}
    }

    if (result && result.confidence > 0.6) {
      const pos = await getPosition();
      await createHazard({
        type: result.type,
        lat: pos.lat, lng: pos.lng,
        confidence: result.confidence,
        source: result === onDevice ? "local" : "gemini"
      });
      onDetected(result);
      // brief cooldown
      setTimeout(()=> requestAnimationFrame(tick), 1500);
      return;
    }

    requestAnimationFrame(tick);
  }

  function start() { setRunning(true); requestAnimationFrame(tick); }
  function stop() { setRunning(false); }

  return (
    <div className="camera-container">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className="camera-video"
      />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      
      <div className="camera-controls">
        <div className={`camera-status ${running ? 'detecting' : ''}`}>
          {running ? '🔍 Detecting hazards...' : '📱 Ready to detect'}
        </div>
        
        <div className="camera-controls-row">
          {!running ? (
            <button className="btn-primary" onClick={start} style={{ flex: 1 }}>
              🚀 Start Detection
            </button>
          ) : (
            <button className="btn-secondary" onClick={stop} style={{ flex: 1 }}>
              ⏹️ Stop Detection
            </button>
          )}
        </div>
        
        <div className="camera-controls-row">
          <button 
            className="btn-debris" 
            onClick={async ()=>{
              const pos = await getPosition();
              await createHazard({ type: "debris", lat: pos.lat, lng: pos.lng, confidence: 0.9, source: "local" });
              alert("🪨 Debris hazard reported!");
            }}
            style={{ flex: 1 }}
          >
            🪨 Debris
          </button>
          
          <button 
            className="btn-water" 
            onClick={async ()=>{
              const pos = await getPosition();
              await createHazard({ type: "water", lat: pos.lat, lng: pos.lng, confidence: 0.9, source: "local" });
              alert("💧 Water hazard reported!");
            }}
            style={{ flex: 1 }}
          >
            💧 Water
          </button>
          
          <button 
            className="btn-blocked" 
            onClick={async ()=>{
              const pos = await getPosition();
              await createHazard({ type: "blocked", lat: pos.lat, lng: pos.lng, confidence: 0.9, source: "local" });
              alert("🚫 Blocked path reported!");
            }}
            style={{ flex: 1 }}
          >
            🚫 Blocked
          </button>
        </div>
      </div>
    </div>
  );
}