// src/components/DetectionView.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Detector } from '@/ml/detector';
import type { DetResult } from '@/types/hazard';

const TARGET_FPS = 10;

export default function DetectionView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<Detector | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [running, setRunning] = useState(true);
  const [threshold, setThreshold] = useState(0.5);
  const [fps, setFps] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  // start camera with current facingMode
  async function startCamera() {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
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
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    let cancel = false;
    let frames = 0;
    let lastTick = performance.now();
    let fpsTimer: any;
    let raf = 0;

    (async () => {
      await startCamera();

      const detector = new Detector();
      detectorRef.current = detector;
      await detector.init();

      // FPS counter
      fpsTimer = setInterval(() => { setFps(frames); frames = 0; }, 1000);

      const tickRAF = async () => {
        if (cancel) return;
        raf = requestAnimationFrame(tickRAF);
        await step();
      };

      // Prefer rVFC for efficiency if available
      const v = videoRef.current!;
      const useRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
      if (useRVFC) {
        // @ts-ignore
        const loop = async (_: any, __: any) => {
          if (cancel) return;
          await step();
          // @ts-ignore
          v.requestVideoFrameCallback(loop);
        };
        // @ts-ignore
        v.requestVideoFrameCallback(loop);
      } else {
        raf = requestAnimationFrame(tickRAF);
      }

      async function step() {
        if (!running) return;
        const video = videoRef.current!;
        if (!video || video.readyState < 2) return;

        // throttle to TARGET_FPS when not using rVFC
        const now = performance.now();
        if (now - lastTick < 1000 / TARGET_FPS) return;
        lastTick = now;

        const w = video.videoWidth, h = video.videoHeight;
        const canvas = canvasRef.current!;
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;

        const bitmap = await createImageBitmap(video);
        const results = await detector.run(bitmap, { scoreThreshold: threshold, maxDetections: 10 });

        draw(canvas, results);
        frames++;

        // Optional: send top detection to backend
        if (results[0]) {
          void sendDetection(results[0], w, h);
        }
      }
    })();

    return () => {
      cancel = true;
      if (raf) cancelAnimationFrame(raf);
      if (fpsTimer) clearInterval(fpsTimer);
      detectorRef.current?.destroy();
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]); // restart camera if you flip front/back

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="flex gap-2 items-center mb-3">
        <button
          className="px-3 py-1 rounded bg-black text-white"
          onClick={() => setRunning(r => !r)}
        >
          {running ? 'Pause' : 'Resume'}
        </button>
        <button
          className="px-3 py-1 rounded border"
          onClick={() => setFacingMode(m => (m === 'environment' ? 'user' : 'environment'))}
        >
          Camera: {facingMode === 'environment' ? 'Rear' : 'Front'}
        </button>
        <label className="text-sm ml-2">
          Confidence ≥ {Math.round(threshold * 100)}%
          <input
            type="range"
            className="ml-2 align-middle"
            min={0.2} max={0.9} step={0.05}
            value={threshold}
            onChange={e => setThreshold(parseFloat(e.target.value))}
          />
        </label>
        <div className="text-sm ml-auto opacity-70">
          {err ? <span className="text-red-600">{err}</span> : <>FPS: {fps}</>}
        </div>
      </div>

      <div className="relative">
        <video ref={videoRef} className="w-full rounded" playsInline muted autoPlay />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      </div>
    </div>
  );
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
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeRect(x, y, w, h);

    const label = `${r.label} ${(r.score * 100).toFixed(0)}%`;
    const tw = ctx.measureText(label).width + 6;
    const th = 18;

    ctx.fillRect(x, y - th, tw, th);
    ctx.fillStyle = 'white';
    ctx.fillText(label, x + 3, y - th + 2);
  }
}

async function sendDetection(r: DetResult, frameW: number, frameH: number) {
  // Example: POST a simplified hazard payload to your API
  try {
    await fetch('/api/hazards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: mapToHazard(r.label),
        confidence: r.score,
        bbox: r.bbox,
        frameSize: [frameW, frameH]
      })
    });
  } catch {}
}

function mapToHazard(label: string) {
  const l = label.toLowerCase();
  if (['bottle', 'cup', 'fork', 'knife', 'spoon'].includes(l)) return 'debris';
  if (['chair', 'bench'].includes(l)) return 'blockage';
  if (['sink', 'toilet'].includes(l)) return 'water';
  return 'other';
}