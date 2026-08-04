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
    title: "ხედავს და ლაპარაკობს ნებისმიერ ენაზე",
    body: "სტუმარი უცხოენოვან სარეცხ მანქანას უღებს ფოტოს. AI კითხულობს პანელს და თავის ენაზე უხსნის.",
  },
  {
    icon: Sparkles,
    title: "დამატებითი შემოსავალი",
    body: "გვიანი გასვლა, ტრანსფერი, დასუფთავება — შეთავაზება პირდაპირ საუბარში, გადახდის ბმულთან ერთად.",
  },
  {
    icon: MessageSquareWarning,
    title: "შეფასების გადარჩენა",
    body: "როცა სტუმარი უკმაყოფილოა, AI ბოდიშს იხდის და მასპინძელს ატყობინებს, სანამ ეს ცუდ შეფასებად იქცევა.",
  },
  {
    icon: QrCode,
    title: "თითო ბინაზე ერთი QR",
    body: "დაბეჭდე და მაცივარზე დააკარი. აპლიკაცია და რეგისტრაცია არ სჭირდება, ნებისმიერ ტელეფონზე მუშაობს.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16">
      <section className="space-y-6">
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          მოურავი
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          24/7 კონსიერჟი ყველა ბინისთვის, რომელსაც აქირავებ.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          უპასუხე სტუმრებს ნებისმიერ ენაზე, გაყიდე დამატებითი სერვისები
          ავტომატურად და დაიჭირე პრობლემა მანამ, სანამ ცუდი შეფასება გახდება.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/login">დაწყება</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/dashboard">მასპინძლის პანელი</Link>
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
