import DetectionView from '@/components/DetectionView';

export default function DetectPage() {
  return (
    <main className="p-4">
      <h1 className="text-xl font-semibold mb-3">Live Hazard Detection</h1>
      <DetectionView />
    </main>
  );
}
