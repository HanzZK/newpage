import { AlertTriangle, Frown, MessageSquare } from "lucide-react";

import { acknowledgeAlert } from "@/app/dashboard/properties/[id]/actions";
import { SubmitButton } from "@/components/dashboard/form-parts";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Alert, ChatSession } from "@/types/database";

function when(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "ახლახან";
  if (minutes < 60) return `${minutes} წთ წინ`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} სთ წინ`;
  return `${Math.round(hours / 24)} დღ წინ`;
}

const SEVERITY_VARIANT = {
  critical: "destructive",
  high: "destructive",
  medium: "secondary",
  low: "outline",
} as const;

export function Inbox({
  propertyId,
  alerts,
  sessions,
}: {
  propertyId: string;
  alerts: Alert[];
  sessions: ChatSession[];
}) {
  const open = alerts.filter((alert) => !alert.acknowledged_at);
  const handled = alerts.filter((alert) => alert.acknowledged_at);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            საჭიროებს ყურადღებას
          </CardTitle>
          <CardDescription>
            ჩნდება, როცა სტუმარი უკმაყოფილოა ან რაიმე გადაუდებელს იტყობინება.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {open.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              ღია არაფერია. სტუმრები კმაყოფილები არიან.
            </p>
          ) : (
            open.map((alert) => (
              <div
                key={alert.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={SEVERITY_VARIANT[alert.severity]}>
                      {alert.severity}
                    </Badge>
                    <Badge variant="outline">{alert.kind}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {when(alert.created_at)}
                    </span>
                    {alert.delivered ? null : (
                      <span className="text-xs text-muted-foreground">
                        {alert.delivery_error
                          ? `webhook ვერ გაიგზავნა: ${alert.delivery_error}`
                          : "webhook არ არის მითითებული"}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium">{alert.summary}</p>
                  {alert.guest_message ? (
                    <p className="text-sm text-muted-foreground">
                      “{alert.guest_message}”
                    </p>
                  ) : null}
                </div>
                <form action={acknowledgeAlert}>
                  <input type="hidden" name="propertyId" value={propertyId} />
                  <input type="hidden" name="alertId" value={alert.id} />
                  <SubmitButton variant="outline" size="sm">
                    მოგვარებულად მონიშვნა
                  </SubmitButton>
                </form>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" aria-hidden />
              ბოლო საუბრები
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                კოდი ჯერ არავის დაუსკანერებია.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {sessions.map((session) => (
                  <li
                    key={session.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-muted-foreground">
                      {session.language
                        ? `სტუმარი — ${session.language}`
                        : "სტუმარი"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {when(session.last_seen_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Frown className="h-4 w-4" aria-hidden />
              მოგვარებული
            </CardTitle>
          </CardHeader>
          <CardContent>
            {handled.length === 0 ? (
              <p className="text-sm text-muted-foreground">ჯერ არაფერი.</p>
            ) : (
              <ul className="space-y-2 text-sm text-muted-foreground">
                {handled.slice(0, 8).map((alert) => (
                  <li key={alert.id} className="truncate">
                    {alert.summary}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
