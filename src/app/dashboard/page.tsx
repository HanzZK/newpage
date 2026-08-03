import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Dashboard · HostAI Concierge",
};

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already gates this route; this is the defence-in-depth check.
  if (!user) redirect("/login?next=/dashboard");

  const { data: properties, error } = await supabase
    .from("properties")
    .select("id, name, address, is_active")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {user.email}
          </p>
        </div>
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Properties</CardTitle>
          <CardDescription>
            {error
              ? "Could not load properties — is the schema applied?"
              : `${properties?.length ?? 0} property/properties on this account.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {error ? (
            <p className="text-destructive">{error.message}</p>
          ) : properties && properties.length > 0 ? (
            <ul className="divide-y">
              {properties.map((property) => (
                <li key={property.id} className="py-2">
                  <span className="font-medium">{property.name}</span>
                  {property.address ? (
                    <span className="text-muted-foreground">
                      {" "}
                      — {property.address}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">
              No properties yet. The full property editor and QR generator land
              in Phase 2.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
