import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import {
  DeleteManualSaleButton,
  ManualSaleForm,
} from "@/components/dashboard/manual-sale-form";
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

export const metadata = { title: "პარამეტრები · მოურავი" };

function formatPrice(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("ka-GE", { style: "currency", currency }).format(
      cents / 100,
    );
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ka-GE", {
      day: "numeric",
      month: "short",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
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
          ყველა ბინა
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">პარამეტრები</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">შემოსავალი შეთავაზებებიდან</CardTitle>
          <CardDescription>
            {Object.keys(totals).length === 0
              ? "ჯერ არაფერი."
              : Object.entries(totals)
                  .map(([currency, cents]) => formatPrice(cents, currency))
                  .join(" · ")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {purchases.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              როცა სტუმარი იყიდის იმას, რაც კონსიერჟმა შესთავაზა, აქ გამოჩნდება.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {purchases.map((purchase) => (
                <li
                  key={purchase.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="min-w-0 truncate text-muted-foreground">
                    {formatDate(purchase.created_at)} ·{" "}
                    {purchase.note ??
                      purchase.guest_email ??
                      (purchase.source === "manual" ? "ხელით ჩაწერილი" : "სტუმარი")}
                  </span>
                  <span className="flex flex-none items-center gap-2">
                    <span className="font-medium">
                      {formatPrice(purchase.amount_cents, purchase.currency)}
                    </span>
                    {purchase.source === "manual" ? (
                      <DeleteManualSaleButton purchaseId={purchase.id} />
                    ) : (
                      <Badge variant="secondary">Stripe</Badge>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">გაყიდვის ჩაწერა</CardTitle>
          <CardDescription>
            ქართული ბანკი გადახდას ავტომატურად ვერ გვატყობინებს. როცა ბანკის
            აპლიკაციაში დაინახავ, რომ სტუმარმა გადაიხადა, აქ ჩაწერე — რომ
            შემოსავალი აღრიცხული იყოს.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ManualSaleForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Stripe</CardTitle>
            <Badge variant={profile?.stripe_webhook_secret ? "secondary" : "outline"}>
              {profile?.stripe_webhook_secret ? "დაკავშირებულია" : "არასავალდებულო"}
            </Badge>
          </div>
          <CardDescription>
            Stripe საქართველოში არ მუშაობს — ეს განყოფილება მხოლოდ იმ
            მასპინძლებისთვისაა, ვისაც უცხოური Stripe ანგარიში აქვს. მათთვის
            გაყიდვები ავტომატურად აღირიცხება. სხვა შემთხვევაში უბრალოდ გამოტოვე.
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
              პროფილს webhook-ის კოდი აკლია. ხელახლა გაუშვი{" "}
              <code>supabase/schema.sql</code> — ის ყველა არსებულ ანგარიშს
              დაამატებს.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
