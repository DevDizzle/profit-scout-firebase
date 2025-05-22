
'use client';

import { Spinner } from '@/components/Spinner';

// The middleware should handle redirection from the root path.
// This page serves as a fallback or a brief loading state.
export default function HomePage() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Spinner size="xl" />
    </div>
  );
}
