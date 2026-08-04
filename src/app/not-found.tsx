import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-lg font-medium">Nothing here</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        That link is wrong, or the property behind it was removed. If you
        scanned a QR code in an apartment, ask your host for a fresh one.
      </p>
      <Button asChild variant="outline" size="sm">
        <Link href="/">Go home</Link>
      </Button>
    </main>
  );
}
