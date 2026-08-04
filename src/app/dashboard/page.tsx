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
  title: "ბინები · მოურავი",
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
        <h1 className="text-2xl font-semibold tracking-tight">ბინები</h1>
        <p className="text-sm text-muted-foreground">
          თითო ბინაზე ერთი კონსიერჟი და ერთი QR კოდი.
        </p>
      </header>

      {error ? (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-base">ბინები ვერ ჩაიტვირთა</CardTitle>
            <CardDescription>
              {error.message}. გაუშვი <code>supabase/schema.sql</code>
              SQL Editor-ში.
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
                      {property.is_active ? "აქტიური" : "შეჩერებული"}
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
                  გახსნა
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
          <CardTitle className="text-base">ბინის დამატება</CardTitle>
          <CardDescription>
            დაიწყე სახელით — დანარჩენს შემდეგ გვერდზე შეავსებ.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewPropertyForm />
        </CardContent>
      </Card>
    </main>
  );
}
