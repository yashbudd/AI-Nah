'use client';

import { useEffect, useRef, useState } from 'react';
import { Detector } from '@/ml/detector';
import type { DetResult } from '@/types/hazard';
import { startGeo } from '@/lib/geo';
import { mapToHazard, postHazards } from '@/lib/hazards';

const TARGET_FPS = 15;

export default function DetectionView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const detectorRef = useRef<Detector | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [running, setRunning] = useState(true);
  const [threshold, setThreshold] = useState(0.3);
  const [fps, setFps] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  // latest GPS fix
  const gpsRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const watcher = startGeo((pos) => (gpsRef.current = pos));
    return () => watcher.stop();
  }, []);

  async function startCamera() {
    if (streamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();
    } catch (e: any) {
      setErr(e?.message ?? 'Camera error');
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function draw(canvas: HTMLCanvasElement, results: DetResult[]) {
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.font = '14px system-ui';
    ctx.textBaseline = 'top';

    for (const r of results) {
      const [x, y, w, h] = r.bbox;
      ctx.strokeStyle = 'lime';
      ctx.strokeRect(x, y, w, h);

      const label = `${r.label} ${(r.score * 100).toFixed(0)}%`;
      const tw = ctx.measureText(label).width + 6;
      const th = 18;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x, y - th, tw, th);
      ctx.fillStyle = 'white';
      ctx.fillText(label, x + 3, y - th + 2);
    }
  }

  // main loop (runs once)
  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let fpsTimer: any;
    let lastTick = performance.now();
    let lastPost = 0;

    const loop = async () => {
      raf = requestAnimationFrame(loop);

      const v = videoRef.current!;
      const c = canvasRef.current!;
      if (!v || !c || v.readyState < 2) return;
      if (!running) return;

      const now = performance.now();
      if (now - lastTick < 1000 / TARGET_FPS) return;
      lastTick = now;

      if (c.width !== v.videoWidth) c.width = v.videoWidth;
      if (c.height !== v.videoHeight) c.height = v.videoHeight;

      try {
        const bitmap = await createImageBitmap(v);
        const results = await detectorRef.current!.run(bitmap, {
          scoreThreshold: threshold,
          maxDetections: 10,
        });

        draw(c, results);
        frames++;

        // Batch & post at most once per second
        if (now - lastPost > 1000 && results.length) {
          lastPost = now;
          const fix = gpsRef.current || undefined;
          const hazards = results
            .filter((r) => r.score >= Math.max(threshold, 0.5)) // store only high-confidence
            .map((r) => ({
              type: mapToHazard(r.label),
              confidence: r.score,
              source: 'tfjs' as const,
              bbox: r.bbox,
              frameSize: [v.videoWidth, v.videoHeight] as [number, number],
              position: fix,
            }));
          if (hazards.length) void postHazards(hazards);
        }
      } catch (e: any) {
        console.error(e);
        setErr(e?.message ?? 'Detection error');
      }
    };

    (async () => {
      await startCamera();
      const det = new Detector();
      detectorRef.current = det;
      await det.init();
      fpsTimer = setInterval(() => { setFps(frames); frames = 0; }, 1000);
      raf = requestAnimationFrame(loop);
    })();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (fpsTimer) clearInterval(fpsTimer);
      detectorRef.current?.destroy();
      stopCamera();
    };
  }, [running, threshold]);

  // overlay styles (inline to avoid Tailwind dependency)
  const wrapperStyle: React.CSSProperties = { position: 'relative', display: 'inline-block', width: '100%', maxWidth: 960 };
  const videoStyle:   React.CSSProperties = { display: 'block', width: '100%', height: 'auto', borderRadius: 8 };
  const canvasStyle:  React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1, borderRadius: 8 };

  return (
    <div style={{ width: '100%', padding: 16, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <button
          style={{ padding: '6px 12px', borderRadius: 6, background: '#000', color: '#fff' }}
          onClick={() => setRunning((r) => !r)}
          aria-pressed={running}
        >
          {running ? 'Pause' : 'Resume'}
        </button>

        <label style={{ fontSize: 14, marginLeft: 8 }}>
          Confidence ≥ {Math.round(threshold * 100)}%
          <input
            type="range"
            min={0.2} max={0.9} step={0.05}
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            style={{ marginLeft: 8, verticalAlign: 'middle' }}
          />
        </label>

        <div style={{ marginLeft: 'auto', opacity: 0.7, fontSize: 14 }}>
          {err ? <span style={{ color: '#dc2626' }}>{err}</span> : <>FPS: {fps}</>}
        </div>
      </div>

      <div style={wrapperStyle}>
        <video ref={videoRef} style={videoStyle} playsInline muted autoPlay />
        <canvas ref={canvasRef} style={canvasStyle} />
      </div>
    </div>
  );
}