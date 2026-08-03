"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Check, Copy, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Rendered off-screen at print resolution so the download is crisp. */
const EXPORT_SIZE = 1024;
const PREVIEW_SIZE = 220;

export function QrPanel({
  chatUrl,
  propertyName,
}: {
  chatUrl: string;
  propertyName: string;
}) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  function slug() {
    return (
      propertyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "property"
    );
  }

  function handleDownload() {
    const canvas = exportRef.current?.querySelector("canvas");
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `hostai-qr-${slug()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(chatUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-6 sm:flex-row">
        <div className="rounded-lg border bg-white p-4">
          <QRCodeCanvas
            value={chatUrl}
            size={PREVIEW_SIZE}
            level="M"
            marginSize={2}
          />
        </div>

        <div className="flex-1 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="chat-url">Guest link</Label>
            <div className="flex gap-2">
              <Input id="chat-url" readOnly value={chatUrl} />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopy}
                aria-label="Copy guest link"
              >
                {copied ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The guest chat lands here in Phase 3. The QR code below already
              points at it, so anything you print now stays valid.
            </p>
          </div>

          <Button type="button" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" aria-hidden />
            Download PNG ({EXPORT_SIZE}px)
          </Button>

          <p className="text-xs text-muted-foreground">
            Print it and put it on the fridge or inside the welcome folder. No
            app, no login — the guest scans and starts talking.
          </p>
        </div>
      </div>

      {/* Hidden high-resolution canvas used only for the download. */}
      <div ref={exportRef} className="pointer-events-none absolute -left-[9999px] top-0">
        <QRCodeCanvas
          value={chatUrl}
          size={EXPORT_SIZE}
          level="M"
          marginSize={2}
        />
      </div>
    </div>
  );
}
