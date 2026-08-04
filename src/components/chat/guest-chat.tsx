"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowUp, ImagePlus, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { downscaleImage } from "@/lib/chat/image";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_MESSAGE_CHARS,
} from "@/lib/chat/limits";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl: string | null;
};

type Attachment = {
  previewUrl: string;
  uploadedUrl: string | null;
  uploading: boolean;
};

const SUGGESTIONS = [
  "What's the wifi password?",
  "How does the washing machine work?",
  "Where can I eat nearby?",
  "Can I check out later?",
];

function storageKey(propertyId: string) {
  return `hostai:session:${propertyId}`;
}

export function GuestChat({
  propertyId,
  propertyName,
  hostName,
}: {
  propertyId: string;
  propertyName: string;
  hostName: string | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);

  const sessionIdRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore the previous conversation, if this browser has one.
  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey(propertyId));
    if (!stored) {
      setRestoring(false);
      return;
    }

    sessionIdRef.current = stored;
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(
          `/api/chat/history?propertyId=${propertyId}&sessionId=${stored}`,
        );
        const data = await response.json();
        if (cancelled) return;

        setMessages(
          (data.messages ?? []).map(
            (row: {
              id: string;
              role: "user" | "assistant";
              content: string;
              image_url: string | null;
            }) => ({
              id: row.id,
              role: row.role,
              content: row.content,
              imageUrl: row.image_url,
            }),
          ),
        );
      } catch {
        // Offline or a stale session — start fresh rather than blocking.
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  const clearAttachment = useCallback(() => {
    setAttachment((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      setError("Send a JPEG, PNG, WebP or GIF image.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setError("That image is too large. Keep it under 8 MB.");
      event.target.value = "";
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setAttachment({ previewUrl, uploadedUrl: null, uploading: true });

    try {
      const shrunk = await downscaleImage(file);
      const formData = new FormData();
      formData.append("propertyId", propertyId);
      formData.append(
        "file",
        new File([shrunk], "photo", { type: shrunk.type || file.type }),
      );

      const response = await fetch("/api/chat/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not upload that photo.");
        clearAttachment();
        return;
      }

      setAttachment((current) =>
        current ? { ...current, uploadedUrl: data.url, uploading: false } : null,
      );
    } catch {
      setError("Could not upload that photo.");
      clearAttachment();
    }
  }

  async function send(rawText: string) {
    const text = rawText.trim();
    if (sending) return;
    if (!text && !attachment?.uploadedUrl) return;
    if (attachment?.uploading) return;

    setError(null);
    setSending(true);

    const imageUrl = attachment?.uploadedUrl ?? null;
    const localPreview = attachment?.previewUrl ?? null;
    const localId = `local-${Date.now()}`;

    setMessages((current) => [
      ...current,
      { id: localId, role: "user", content: text, imageUrl: localPreview },
    ]);
    setInput("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          propertyId,
          sessionId: sessionIdRef.current,
          message: text,
          imageUrl,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }

      sessionIdRef.current = data.sessionId;
      window.localStorage.setItem(storageKey(propertyId), data.sessionId);

      setMessages((current) => [
        // Swap the local blob: preview for the stored URL, so the thumbnail
        // survives a refresh and the object URL can be released.
        ...current.map((message) =>
          message.id === localId && imageUrl
            ? { ...message, imageUrl }
            : message,
        ),
        {
          id: `reply-${Date.now()}`,
          role: "assistant",
          content: data.reply,
          imageUrl: null,
        },
      ]);

      if (localPreview) URL.revokeObjectURL(localPreview);
    } catch {
      setError("You appear to be offline. Check your connection.");
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setAttachment(null);
    }
  }

  const canSend =
    !sending && !attachment?.uploading && (input.trim() || attachment?.uploadedUrl);

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex-none border-b px-4 py-3">
        <h1 className="truncate text-base font-semibold leading-tight">
          {propertyName}
        </h1>
        <p className="text-xs text-muted-foreground">
          {hostName ? `${hostName}'s concierge` : "Guest concierge"} · answers in
          your language
        </p>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {restoring ? null : messages.length === 0 ? (
          <div className="space-y-4 py-6">
            <div className="space-y-1.5">
              <p className="text-lg font-medium">Hi 👋</p>
              <p className="text-sm text-muted-foreground">
                Ask me anything about the apartment or the neighbourhood. You
                can also send a photo — of an appliance, a switch, anything you
                are not sure about.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="rounded-full border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] space-y-2 rounded-2xl px-4 py-2.5 text-sm",
                  message.role === "user"
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : "rounded-bl-sm bg-muted",
                )}
              >
                {message.imageUrl ? (
                  /* Guest uploads come from Supabase Storage, so next/image
                     would need a remote-pattern allowlist per project. A plain
                     img keeps the deploy config empty. */
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={message.imageUrl}
                    alt="Photo sent to the concierge"
                    className="max-h-64 w-full rounded-lg object-cover"
                  />
                ) : null}
                {message.content ? (
                  <p className="whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                ) : null}
              </div>
            </div>
          ))
        )}

        {sending ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
            </div>
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>

      <div className="flex-none border-t bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        {error ? (
          <p role="alert" className="pb-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {attachment ? (
          <div className="relative mb-2 inline-block">
            <Image
              src={attachment.previewUrl}
              alt="Attached photo"
              width={64}
              height={64}
              unoptimized
              className="h-16 w-16 rounded-lg border object-cover"
            />
            {attachment.uploading ? (
              <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/70">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              </span>
            ) : null}
            <button
              type="button"
              onClick={clearAttachment}
              aria-label="Remove photo"
              className="absolute -right-1.5 -top-1.5 rounded-full border bg-background p-0.5 shadow-sm"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </div>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
          }}
          className="flex items-end gap-2"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            capture="environment"
            className="sr-only"
            onChange={handleFile}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 flex-none"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Add a photo"
          >
            <ImagePlus className="h-4 w-4" aria-hidden />
          </Button>

          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            maxLength={MAX_MESSAGE_CHARS}
            placeholder="Ask anything…"
            className="max-h-32 min-h-10 resize-none py-2"
          />

          <Button
            type="submit"
            size="icon"
            className="h-10 w-10 flex-none"
            disabled={!canSend}
            aria-label="Send"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <ArrowUp className="h-4 w-4" aria-hidden />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
