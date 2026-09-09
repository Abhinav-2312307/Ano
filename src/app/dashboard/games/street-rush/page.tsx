'use client';

import { Suspense } from 'react';
import { StreetRushGameHub } from '@/components/games/street-rush/components/StreetRushGameHub';

export default function StreetRushPage() {
  return (
    <div className="fixed inset-0 w-screen h-screen max-w-full max-h-screen overflow-hidden bg-slate-950">
      <Suspense
        fallback={
          <div className="w-full h-full bg-[#060812] flex items-center justify-center text-white">
            <div className="text-center space-y-3">
              <div className="text-4xl font-black text-white tracking-wide uppercase italic">
                Ano <span className="text-cyan-400">Street Rush</span>
              </div>
              <div className="text-slate-400 text-sm font-bold uppercase tracking-wider">
                Preparing Neon City Circuit...
              </div>
            </div>
          </div>
        }
      >
        <StreetRushGameHub />
      </Suspense>
    </div>
  );
}
