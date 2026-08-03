import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

import { NewPropertyForm } from "@/components/dashboard/new-property-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/dashboard/guard";

export const metadata = {
  title: "Properties · HostAI Concierge",
};

export default async function DashboardPage() {
  const { supabase } = await requireUser();

  const { data: properties, error } = await supabase
    .from("properties")
    .select("id, name, address, is_active, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Properties</h1>
        <p className="text-sm text-muted-foreground">
          One concierge, one QR code, per apartment.
        </p>
      </header>

      {error ? (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-base">Could not load properties</CardTitle>
            <CardDescription>
              {error.message}. Have you run <code>supabase/schema.sql</code> in
              the SQL Editor?
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {properties && properties.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {properties.map((property) => (
            <Link
              key={property.id}
              href={`/dashboard/properties/${property.id}`}
              className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full transition-colors group-hover:border-foreground/20">
                <CardHeader className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{property.name}</CardTitle>
                    <Badge
                      variant={property.is_active ? "secondary" : "outline"}
                    >
                      {property.is_active ? "live" : "paused"}
                    </Badge>
                  </div>
                  {property.address ? (
                    <CardDescription className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" aria-hidden />
                      {property.address}
                    </CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  Open
                  <ArrowRight
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : null}

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Add a property</CardTitle>
          <CardDescription>
            Start with the name — you can fill in the rest on the next screen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewPropertyForm />
        </CardContent>
      </Card>
    </main>
  );
}
