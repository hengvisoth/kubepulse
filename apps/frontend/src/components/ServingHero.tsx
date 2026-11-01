'use client';

import React from 'react';
import { PodTelemetry } from '../types';

interface ServingHeroProps {
  telemetry: PodTelemetry | null;
  podHits: Record<string, number>;
  totalRequests: number;
}

// Uses fixed hex colors on purpose: tailwind.config.js flips the accent scales for the
// light theme, so teal-* classes would turn dark on this dark band.
export const ServingHero: React.FC<ServingHeroProps> = ({ telemetry, podHits, totalRequests }) => {
  const pods = Object.entries(podHits).sort(([a], [b]) => a.localeCompare(b));
  const current = telemetry?.podName;

  return (
    <section className="bg-[#10243A] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <p className="text-sm text-[#9FD8CF]">This page was answered by pod</p>
          <h1 className="mt-2 font-display text-3xl sm:text-5xl font-semibold tracking-tight break-all">
            {current || 'Waiting for the backend…'}
          </h1>
          {telemetry && (
            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm text-[#C5D5DC]">
              <div className="flex gap-2">
                <dt className="text-[#7FA1AE]">Node</dt>
                <dd className="font-mono">{telemetry.nodeName}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-[#7FA1AE]">Pod IP</dt>
                <dd className="font-mono">{telemetry.podIp}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-[#7FA1AE]">Version</dt>
                <dd className="font-mono">{telemetry.appVersion}</dd>
              </div>
            </dl>
          )}
        </div>

        <div className="lg:max-w-md">
          <p className="text-sm text-[#9FD8CF]">
            {pods.length === 0
              ? 'No replies yet'
              : `${totalRequests} replies from ${pods.length} ${pods.length === 1 ? 'pod' : 'pods'}`}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {pods.map(([name, hits]) => (
              <li
                key={name}
                title={name}
                className={`rounded-full px-3 py-1 text-xs font-mono ${
                  name === current
                    ? 'bg-[#5EEAD4] text-[#10243A] font-semibold'
                    : 'border border-[#2C4A63] text-[#C5D5DC]'
                }`}
              >
                {name.split('-').slice(-1)[0]} × {hits}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};
