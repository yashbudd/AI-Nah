'use client';
import { useEffect, useRef, useState } from 'react';

export default function CamTest() {
  const v = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        if (!v.current) return;
        v.current.srcObject = stream;
        await v.current.play();
      } catch (e: any) {
        setErr(e?.message ?? 'Camera error');
      }
    })();
    return () => stream?.getTracks().forEach(t => t.stop());
  }, []);

  return (
    <main className="p-4">
      <h1 className="text-xl font-semibold mb-3">Camera Test</h1>
      <video ref={v} className="w-full rounded" playsInline muted autoPlay />
      <div className="mt-2 text-sm">{err && <span className="text-red-600">{err}</span>}</div>
    </main>
  );
}