import Link from "next/link";
import {
  Languages,
  MessageSquareWarning,
  QrCode,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const FEATURES = [
  {
    icon: Languages,
    title: "Multilingual Vision AI",
    body: "Guests photograph the Italian washing machine. The AI reads the panel and explains it in their language.",
  },
  {
    icon: Sparkles,
    title: "Upselling engine",
    body: "Late check-out, airport transfer, mid-stay clean — offered in-conversation with a Stripe payment link.",
  },
  {
    icon: MessageSquareWarning,
    title: "Review saver",
    body: "Sentiment turns negative, the AI apologises and pings the host before it becomes a 3-star review.",
  },
  {
    icon: QrCode,
    title: "One QR per apartment",
    body: "Print it, stick it on the fridge. No app, no login, works on any phone.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16">
      <section className="space-y-6">
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          HostAI Concierge
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          A 24/7 concierge for every apartment you rent.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Answer guest questions in any language, sell extras automatically, and
          catch problems before they turn into bad reviews.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/login">Get started</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/dashboard">Host dashboard</Link>
          </Button>
        </div>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <Card key={title}>
            <CardHeader className="space-y-3">
              <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{body}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </main>
  );
}
