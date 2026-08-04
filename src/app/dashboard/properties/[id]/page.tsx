import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { deleteProperty } from "@/app/dashboard/actions";
import { ApplianceEditor } from "@/components/dashboard/appliance-editor";
import { SubmitButton } from "@/components/dashboard/form-parts";
import { GuideEditor } from "@/components/dashboard/guide-editor";
import { Inbox } from "@/components/dashboard/inbox";
import {
  EmergencyForm,
  EssentialsForm,
  RulesForm,
} from "@/components/dashboard/property-forms";
import { QrPanel } from "@/components/dashboard/qr-panel";
import { UpsellEditor } from "@/components/dashboard/upsell-editor";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireProperty } from "@/lib/dashboard/guard";
import { publicEnv } from "@/lib/env";
import type {
  Alert,
  Appliance,
  ChatSession,
  LocalGuide,
  Upsell,
} from "@/types/database";

type PageProps = { params: { id: string } };

export async function generateMetadata({ params }: PageProps) {
  const context = await requireProperty(params.id);
  return { title: `${context?.property.name ?? "Property"} · HostAI Concierge` };
}

const TABS = [
  { value: "essentials", label: "Essentials" },
  { value: "rules", label: "Rules" },
  { value: "appliances", label: "Appliances" },
  { value: "guide", label: "Local guide" },
  { value: "upsells", label: "Upsells" },
  { value: "emergency", label: "Emergency" },
  { value: "qr", label: "QR code" },
  { value: "inbox", label: "Inbox" },
];

export default async function PropertyPage({ params }: PageProps) {
  const context = await requireProperty(params.id);
  if (!context) notFound();

  const { supabase, property } = context;

  const [appliancesResult, guidesResult, upsellsResult, alertsResult, sessionsResult] =
    await Promise.all([
    supabase
      .from("appliances")
      .select("*")
      .eq("property_id", property.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("local_guides")
      .select("*")
      .eq("property_id", property.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("upsells")
      .select("*")
      .eq("property_id", property.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("alerts")
      .select("*")
      .eq("property_id", property.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("chat_sessions")
      .select("*")
      .eq("property_id", property.id)
      .order("last_seen_at", { ascending: false })
      .limit(10),
  ]);

  const appliances = (appliancesResult.data ?? []) as Appliance[];
  const guides = (guidesResult.data ?? []) as LocalGuide[];
  const upsells = (upsellsResult.data ?? []) as Upsell[];
  const alerts = (alertsResult.data ?? []) as Alert[];
  const sessions = (sessionsResult.data ?? []) as ChatSession[];

  const chatUrl = `${publicEnv.siteUrl()}/chat/${property.id}`;

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

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {property.name}
              </h1>
              <Badge variant={property.is_active ? "secondary" : "outline"}>
                {property.is_active ? "live" : "paused"}
              </Badge>
            </div>
            {property.address ? (
              <p className="text-sm text-muted-foreground">{property.address}</p>
            ) : null}
          </div>

          <form action={deleteProperty}>
            <input type="hidden" name="propertyId" value={property.id} />
            <SubmitButton variant="outline" size="sm">
              Delete property
            </SubmitButton>
          </form>
        </div>
      </div>

      <Tabs defaultValue="essentials" className="space-y-4">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList>
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="essentials">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Wi-Fi, check-in, the basics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EssentialsForm property={property} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">House rules</CardTitle>
            </CardHeader>
            <CardContent>
              <RulesForm property={property} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appliances">
          <ApplianceEditor propertyId={property.id} appliances={appliances} />
        </TabsContent>

        <TabsContent value="guide">
          <GuideEditor propertyId={property.id} guides={guides} />
        </TabsContent>

        <TabsContent value="upsells">
          <UpsellEditor propertyId={property.id} upsells={upsells} />
        </TabsContent>

        <TabsContent value="emergency">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Who to call, and how you get alerted
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EmergencyForm property={property} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qr">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Guest QR code</CardTitle>
            </CardHeader>
            <CardContent>
              <QrPanel chatUrl={chatUrl} propertyName={property.name} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inbox">
          <Inbox propertyId={property.id} alerts={alerts} sessions={sessions} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
