import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { MoonStar } from "lucide-react";

import { GuestChat } from "@/components/chat/guest-chat";
import { loadGuestProperty } from "@/lib/chat/property";

type PageProps = { params: { propertyId: string } };

/** The guest UI is a phone-first full-height app, so lock the viewport. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#ffffff",
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const property = await loadGuestProperty(params.propertyId);
  return {
    title: property ? `${property.name} · Concierge` : "Concierge",
    description: "Your 24/7 guest concierge. Ask anything, in any language.",
    robots: { index: false, follow: false },
  };
}

export default async function GuestChatPage({ params }: PageProps) {
  const property = await loadGuestProperty(params.propertyId);
  if (!property) notFound();

  if (!property.is_active) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <MoonStar className="h-8 w-8 text-muted-foreground" aria-hidden />
        <h1 className="text-lg font-medium">The concierge is asleep</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This apartment&apos;s assistant is switched off right now. Please
          contact your host directly.
        </p>
      </main>
    );
  }

  return (
    <GuestChat
      propertyId={property.id}
      propertyName={property.name}
      hostName={property.host_name}
    />
  );
}
