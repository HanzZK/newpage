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
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
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
            Needs your attention
          </CardTitle>
          <CardDescription>
            Raised when a guest sounds unhappy or reports something urgent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {open.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing open. Guests are happy.
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
                          ? `webhook failed: ${alert.delivery_error}`
                          : "no webhook configured"}
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
                    Mark handled
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
              Recent conversations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No guest has scanned the code yet.
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
                        ? `Guest speaking ${session.language}`
                        : "Guest"}
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
              Already handled
            </CardTitle>
          </CardHeader>
          <CardContent>
            {handled.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet.</p>
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
