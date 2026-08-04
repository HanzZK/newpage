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
    link.download = `mouravi-qr-${slug()}.png`;
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
            <Label htmlFor="chat-url">სტუმრის ბმული</Label>
            <div className="flex gap-2">
              <Input id="chat-url" readOnly value={chatUrl} />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopy}
                aria-label="ბმულის კოპირება"
              >
                {copied ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              ეს არის მისამართი, რომელსაც QR კოდი ხსნის. თუ დომენს შეცვლი,
              კოდი ხელახლა უნდა დაბეჭდო.
            </p>
          </div>

          <Button type="button" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" aria-hidden />
            PNG-ის ჩამოტვირთვა ({EXPORT_SIZE}px)
          </Button>

          <p className="text-xs text-muted-foreground">
            დაბეჭდე და მაცივარზე ან საინფორმაციო საქაღალდეში დადე. აპლიკაცია და
            რეგისტრაცია არ სჭირდება — სტუმარი სკანირებს და პირდაპირ წერს.
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
