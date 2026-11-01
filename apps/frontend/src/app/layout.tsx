import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'KubePulse — Incident Status & Chaos Testing Board',
  description: 'Incident Status Page & Chaos Testing Platform for Rancher, Kubernetes, and ArgoCD',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-teal-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
