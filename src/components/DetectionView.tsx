'use client';

import { useEffect, useRef, useState } from 'react';
import { Detector } from '@/ml/detector';
import type { DetResult } from '@/types/hazard';

export default function DetectionView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<Detector | null>(null);
  const [isRunning, setIsRunning] = useState(true);
  const [fps, setFps] = useState(0);
  const [threshold, setThreshold] = useState(0.5);
  const [error, setError] = useState<string | null>(null);

  // Start and stop camera stream
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      setError(err.message || 'Unable to access camera');
    }
  }

  function stopCamera() {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
  }

  // Drawing detections
  function drawDetections(canvas: HTMLCanvasElement, results: DetResult[]) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.font = '14px system-ui';
    ctx.textBaseline = 'top';

    for (const r of results) {
      const [x, y, w, h] = r.bbox;
      ctx.strokeStyle = 'lime';
      ctx.strokeRect(x, y, w, h);
      const label = `${r.label} ${(r.score * 100).toFixed(0)}%`;
      const textWidth = ctx.measureText(label).width + 6;
      const textHeight = 16;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(x, y - textHeight, textWidth, textHeight);
      ctx.fillStyle = 'white';
      ctx.fillText(label, x + 3, y - textHeight + 2);
    }
  }

  // Main effect: load model + start loop
  useEffect(() => {
    let animationId = 0;
    let fpsCounter = 0;
    let lastFpsTime = performance.now();

    const runDetection = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !isRunning) {
        animationId = requestAnimationFrame(runDetection);
        return;
      }

      // Skip if video not ready
      if (video.readyState < 2) {
        animationId = requestAnimationFrame(runDetection);
        return;
      }

      // Match canvas to video size
      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

      try {
        const bitmap = await createImageBitmap(video);
        const results = await detectorRef.current!.run(bitmap, {
          scoreThreshold: threshold,
          maxDetections: 10,
        });
        drawDetections(canvas, results);
      } catch (err: any) {
        console.error(err);
        setError(err.message);
      }

      fpsCounter++;
      const now = performance.now();
      if (now - lastFpsTime >= 1000) {
        setFps(fpsCounter);
        fpsCounter = 0;
        lastFpsTime = now;
      }

      animationId = requestAnimationFrame(runDetection);
    };

    (async () => {
      await startCamera();

      const detector = new Detector();
      detectorRef.current = detector;
      await detector.init();

      animationId = requestAnimationFrame(runDetection);
    })();

    return () => {
      cancelAnimationFrame(animationId);
      stopCamera();
      detectorRef.current?.destroy();
    };
  }, [isRunning, threshold]);

  return (
    <div className="w-full max-w-3xl mx-auto p-4">
      <div className="flex items-center gap-3 mb-3">
        <button
          className="px-3 py-1 rounded bg-black text-white"
          onClick={() => setIsRunning((r) => !r)}
        >
          {isRunning ? 'Pause' : 'Resume'}
        </button>

        <label className="text-sm ml-2">
          Confidence ≥ {Math.round(threshold * 100)}%
          <input
            type="range"
            className="ml-2 align-middle"
            min={0.2}
            max={0.9}
            step={0.05}
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
          />
        </label>

        <div className="text-sm ml-auto opacity-70">
          {error ? <span className="text-red-600">{error}</span> : <>FPS: {fps}</>}
        </div>
      </div>

      <div className="relative">
        <video
          ref={videoRef}
          className="w-full rounded"
          autoPlay
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
      </div>
    </div>
  );
}