'use client';

import { useEffect, useRef, useState } from 'react';
import { Detector } from '@/ml/detector';
import type { DetResult } from '@/types/hazard';
import { postHazards, mapToHazard } from '@/lib/hazards';

const TARGET_FPS = 15;

export default function DetectionView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<Detector | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [running, setRunning] = useState(true);
  const [threshold, setThreshold] = useState(0.5);
  const [fps, setFps] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  async function startCamera() {
    stopCamera();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    streamRef.current = stream;
    const v = videoRef.current!;
    v.srcObject = stream;
    await v.play();
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    let cancel = false;
    let frames = 0;
    let fpsTimer: any;
    let raf = 0;
    let postTick = 0;

    (async () => {
      try {
        await startCamera();

        const detector = new Detector();
        detectorRef.current = detector;
        await detector.init();

        fpsTimer = setInterval(() => { setFps(frames); frames = 0; }, 1000);

        const tick = async () => {
          if (cancel) return;
          raf = requestAnimationFrame(tick);

          if (!running) return;
          const v = videoRef.current!;
          if (!v || v.readyState < 2) return;

          const now = performance.now();
          if (now - postTick < 1000 / TARGET_FPS) return;
          postTick = now;

          const w = v.videoWidth, h = v.videoHeight;
          const canvas = canvasRef.current!;
          if (canvas.width !== w) canvas.width = w;
          if (canvas.height !== h) canvas.height = h;

          const bitmap = await createImageBitmap(v);
          const results = await detector.run(bitmap, { scoreThreshold: threshold, maxDetections: 10 });

          draw(canvas, results);
          frames++;

          // Send high-confidence hazards to API (throttled by TARGET_FPS)
          const hazards = results
            .filter(r => r.score >= 0.6)
            .map(r => ({
              type: mapToHazard(r.label),
              confidence: r.score,
              source: 'tfjs' as const,
              bbox: r.bbox,
              frameSize: [w, h]
            }));
          if (hazards.length) void postHazards(hazards);
        };

        raf = requestAnimationFrame(tick);
      } catch (e: any) {
        setErr(e?.message ?? 'Camera error');
      }
    })();

    return () => {
      cancel = true;
      if (raf) cancelAnimationFrame(raf);
      if (fpsTimer) clearInterval(fpsTimer);
      detectorRef.current?.destroy();
      stopCamera();
    };
  }, [running, threshold]);

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="flex gap-2 items-center mb-3">
        <button
          className="px-3 py-1 rounded bg-black text-white"
          onClick={() => setRunning(r => !r)}
        >
          {running ? 'Pause' : 'Resume'}
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