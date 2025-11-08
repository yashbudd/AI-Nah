'use client';

import { useEffect, useRef, useState } from 'react';
import { Detector } from '@/ml/detector';
import type { DetResult } from '@/types/hazard';
import { startGeo } from '@/lib/geo';
import { mapToHazard, postHazards, type HazardIn } from '@/lib/hazards';

const TARGET_FPS = 15;

type MappedResult = DetResult & { hazard: HazardIn['type'] };

export default function DetectionView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // hidden capture canvas for frame grabbing fallback
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const detectorRef = useRef<Detector | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const gpsRef = useRef<{ lat: number; lng: number } | null>(null);

  const [running, setRunning] = useState(true);
  const [threshold, setThreshold] = useState(0.5);
  const [fps, setFps] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // lightweight loop heartbeat for debug

  useEffect(() => {
    const stop = startGeo((pos) => {
      gpsRef.current = pos;
    });
    return () => stop?.stop?.();
  }, []);

  function colorFor(hazard: HazardIn['type']) {
    switch (hazard) {
      case 'debris': return '#D97706';   // orange
      case 'water': return '#3B82F6';    // blue
      case 'blockage': return '#EF4444'; // red
      default: return '#10B981';         // green
    }
  }

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

  // Robust frame grabber with fallbacks (iOS/Safari safe)
  async function grabFrame(v: HTMLVideoElement): Promise<ImageBitmap | null> {
    try {
      if ('createImageBitmap' in window) {
        // Works in most modern browsers, but not reliably on older iOS
        // @ts-ignore
        return await createImageBitmap(v);
      }
    } catch {
      // fall through to canvas path
    }

    // Canvas fallback
    if (!captureCanvasRef.current) {
      captureCanvasRef.current = document.createElement('canvas');
    }
    const cap = captureCanvasRef.current;
    if (!cap) return null;
    if (cap.width !== v.videoWidth || cap.height !== v.videoHeight) {
      cap.width = v.videoWidth;
      cap.height = v.videoHeight;
    }
    const ctx = cap.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, cap.width, cap.height);

    try {
      // Fast path if supported
      // @ts-ignore
      if (cap.transferToImageBitmap) {
        // @ts-ignore
        return cap.transferToImageBitmap();
      }
    } catch {
      /* ignore */
    }

    // Universal path
    // @ts-ignore
    if (window.createImageBitmap) {
      // @ts-ignore
      return await createImageBitmap(cap);
    }

    return null;
  }

  function draw(canvas: HTMLCanvasElement, results: MappedResult[]) {
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.font = '14px system-ui';
    ctx.textBaseline = 'top';

    // heartbeat dot so you can see the loop is alive
    ctx.fillStyle = 'rgba(16,185,129,0.8)';
    ctx.fillRect(8, 8, 6, 6);

    for (const r of results) {
      if (r.hazard === 'other') continue;
      const [x, y, w, h] = r.bbox;

      ctx.strokeStyle = colorFor(r.hazard);
      ctx.strokeRect(x, y, w, h);

      const label = `${r.hazard} ${(r.score * 100).toFixed(0)}%`;
      const tw = ctx.measureText(label).width + 6;
      const th = 18;

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x, y - th, tw, th);

      ctx.fillStyle = 'white';
      ctx.fillText(label, x + 3, y - th + 2);
    }
  }

  useEffect(() => {
    let raf = 0;
    let fpsTimer: number | null = null;
    let lastPost = 0;

    const run = async () => {
      if (!running) return;

      await startCamera();

      const det = new Detector();
      detectorRef.current = det;
      await det.init().catch((e: any) => {
        setErr(e?.message ?? 'Detector init error');
        throw e;
      });

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

          if (c.width !== v.videoWidth || c.height !== v.videoHeight) {
            c.width = v.videoWidth;
            c.height = v.videoHeight;
          }

          const start = performance.now();

          const frame = await grabFrame(v); // <— robust frame capture
          if (!frame) {
            // No frame available; still tick so you see the heartbeat
            setTick((t) => (t + 1) % 100000);
            raf = requestAnimationFrame(loop);
            return;
          }

          const raw = await detectorRef.current!.run(frame, {
            scoreThreshold: threshold,
            maxDetections: 10,
          });

          const mapped: MappedResult[] = raw.map((r) => ({
            ...r,
            hazard: mapToHazard(r.label),
          }));

          draw(c, mapped);
          frames++;

          const now = performance.now();
          if (now - lastPost > 1000) {
            lastPost = now;
            const fix = gpsRef.current || undefined;
            const hazards = mapped
              .filter((r) => r.hazard !== 'other' && r.score >= Math.max(threshold, 0.5))
              .map((r) => ({
                type: r.hazard,
                confidence: r.score,
                source: 'tfjs' as const,
                bbox: r.bbox,
                frameSize: [v.videoWidth, v.videoHeight] as [number, number],
                position: fix,
              }));
            if (hazards.length) void postHazards(hazards);
          }

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
  }, [running]);

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
    transform: 'scaleX(-1)', // Mirror the camera feed horizontally
  };
  const canvasStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 1,
    borderRadius: 8,
    transform: 'scaleX(-1)', // Mirror the overlay to match the video
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
          {err ? <span style={{ color: '#dc2626' }}>{err}</span> : <>FPS: {fps} · tick {tick}</>}
        </div>
      </div>

      <div style={wrapperStyle}>
        <video ref={videoRef} style={videoStyle} playsInline muted autoPlay />
        <canvas ref={canvasRef} style={canvasStyle} />
      </div>
    </div>
  );
}