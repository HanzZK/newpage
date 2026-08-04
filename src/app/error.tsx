"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-lg font-medium">Something broke</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Sorry — that did not work. Trying again usually fixes it.
      </p>
      {/* The digest is the only safe handle on the server-side stack; the
          message itself may contain internals and is not shown. */}
      {error.digest ? (
        <p className="font-mono text-xs text-muted-foreground">
          {error.digest}
        </p>
      ) : null}
      <Button onClick={reset} variant="outline" size="sm">
        Try again
      </Button>
    </main>
  );
}
