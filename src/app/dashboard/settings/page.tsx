import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { StripeSettings } from "@/components/dashboard/stripe-settings";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/dashboard/guard";
import { publicEnv } from "@/lib/env";
import type { UpsellPurchase } from "@/types/database";

export const metadata = { title: "Settings · HostAI Concierge" };

function formatPrice(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).format(
      cents / 100,
    );
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export default async function SettingsPage() {
  const { supabase, user } = await requireUser();

  const [profileResult, purchasesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("stripe_webhook_token, stripe_webhook_secret")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("upsell_purchases")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const profile = profileResult.data;
  const purchases = (purchasesResult.data ?? []) as UpsellPurchase[];

  // Purchases are grouped by currency — summing mixed currencies would be a
  // meaningless number.
  const totals = purchases.reduce<Record<string, number>>((acc, purchase) => {
    acc[purchase.currency] = (acc[purchase.currency] ?? 0) + purchase.amount_cents;
    return acc;
  }, {});

  const webhookUrl = profile?.stripe_webhook_token
    ? `${publicEnv.siteUrl()}/api/stripe/webhook/${profile.stripe_webhook_token}`
    : null;

  return (
    <main className="space-y-6">
      <div className="space-y-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          All properties
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Stripe</CardTitle>
            <Badge variant={profile?.stripe_webhook_secret ? "secondary" : "outline"}>
              {profile?.stripe_webhook_secret ? "connected" : "not connected"}
            </Badge>
          </div>
          <CardDescription>
            Payment Links stay in your own Stripe account — we never touch your
            money. Connect this webhook and the dashboard can show you what the
            concierge earned.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {webhookUrl ? (
            <StripeSettings
              webhookUrl={webhookUrl}
              hasSecret={Boolean(profile?.stripe_webhook_secret)}
            />
          ) : (
            <p className="text-sm text-destructive">
              Your profile is missing a webhook token. Re-run{" "}
              <code>supabase/schema.sql</code> — it adds one to every existing
              account.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue from upsells</CardTitle>
          <CardDescription>
            {Object.keys(totals).length === 0
              ? "Nothing yet."
              : Object.entries(totals)
                  .map(([currency, cents]) => formatPrice(cents, currency))
                  .join(" · ")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {purchases.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sales appear here once Stripe is connected and a guest buys
              something the concierge offered.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {purchases.map((purchase) => (
                <li
                  key={purchase.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="truncate text-muted-foreground">
                    {purchase.guest_email ?? "Guest"}
                    {purchase.upsell_id ? "" : " · unattributed"}
                  </span>
                  <span className="flex-none font-medium">
                    {formatPrice(purchase.amount_cents, purchase.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
