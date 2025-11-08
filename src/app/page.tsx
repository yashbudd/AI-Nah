'use client'

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Immediately redirect to the detection page
    router.replace('/detect');
  }, [router]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '50vh',
      flexDirection: 'column',
      gap: '1rem'
    }}>
      <div>🔄 Loading TrailMix...</div>
      <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>
        Redirecting to live detection
      </div>
    </div>
  );
}
