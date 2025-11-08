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
  const gpsRef = useRef<{ lat: number; lng: number } | null>(null);

  const [running, setRunning] = useState(true);
  const [threshold, setThreshold] = useState(0.5);
  const [fps, setFps] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  // start passive geolocation watcher once
  useEffect(() => {
    const geoWatcher = startGeo((pos) => {
      gpsRef.current = pos;
    });
    return () => geoWatcher?.stop?.(); // Explicitly call the `stop` method
  }, []);

  // camera helpers
  async function startCamera() {
    if (streamRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      streamRef.current = stream;

      const v = videoRef.current!;
      if (v.srcObject !== stream) v.srcObject = stream;

      await new Promise<void>((res) => {
        if (v.readyState >= 1) return res();
        v.onloadedmetadata = () => res();
      });

      await v.play();
    } catch (e: any) {
      setErr(e?.message ?? 'Camera error');
    }
  }

  function stopCamera() {
    try {
      const v = videoRef.current;
      if (v) {
        v.pause();
        v.srcObject = null;
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } finally {
      streamRef.current = null;
    }
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

  // detection lifecycle
  useEffect(() => {
    let raf = 0;
    let fpsTimer: number | null = null;
    let lastPost = 0;

    const run = async () => {
      if (!running) return;

      await startCamera();

      const det = new Detector();
      detectorRef.current = det;
      try {
        await det.init();
      } catch (e: any) {
        setErr(e?.message ?? 'Detector init error');
        return;
      }

      let frames = 0;
      fpsTimer = window.setInterval(() => {
        setFps(frames);
        frames = 0;
      }, 1000) as unknown as number;

      const loop = async () => {
        if (!running) return;

        try {
          const v = videoRef.current!;
          const c = canvasRef.current!;
          if (!v || !c || v.videoWidth === 0 || v.videoHeight === 0) {
            raf = requestAnimationFrame(loop);
            return;
          }

          // keep canvas in lockstep with video size
          if (c.width !== v.videoWidth || c.height !== v.videoHeight) {
            c.width = v.videoWidth;
            c.height = v.videoHeight;
          }

          // throttle to target FPS
          const start = performance.now();
          const frame = await createImageBitmap(v);
          const results = await detectorRef.current!.run(frame, {
            scoreThreshold: threshold,
            maxDetections: 10,
          });

          draw(c, results);
          frames++;

          // post at most once per second
          const now = performance.now();
          if (now - lastPost > 1000 && results.length) {
            lastPost = now;
            const fix = gpsRef.current || undefined;
            const hazards = results
              .filter((r) => r.score >= Math.max(threshold, 0.5))
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

          // simple pacing toward TARGET_FPS without blocking the UI
          const elapsed = performance.now() - start;
          const frameBudget = 1000 / TARGET_FPS;
          if (elapsed < frameBudget) {
            await new Promise((r) => setTimeout(r, frameBudget - elapsed));
          }
        } catch (e: any) {
          console.error(e);
          setErr(e?.message ?? 'Detection error');
        }

        raf = requestAnimationFrame(loop);
      };

      raf = requestAnimationFrame(loop);
    };

    run();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (fpsTimer) clearInterval(fpsTimer);
      detectorRef.current?.destroy();
      stopCamera();
    };
  }, [running]); // Only restart when running toggles

  // overlay styles
  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    width: '100%',
    maxWidth: 960,
  };
  const videoStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    height: 'auto',
    borderRadius: 8,
  };
  const canvasStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 1,
    borderRadius: 8,
  };

  return (
    <div style={{ width: '100%', padding: 16, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, opacity: 0.8 }}>Threshold</span>
          <input
            type="range"
            min={0.2}
            max={0.9}
            step={0.05}
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
          />
          <span style={{ width: 36, textAlign: 'right' }}>{threshold.toFixed(2)}</span>
        </label>

        <button
          style={{ padding: '6px 12px', borderRadius: 6, background: '#000', color: '#fff' }}
          onClick={() => setRunning((r) => !r)}
          aria-pressed={running}
        >
          {running ? 'Pause' : 'Resume'}
        </button>

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