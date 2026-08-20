# AUFELD21

Öffentliche Website und geschütztes Mitgliederportal für den Co-Working-Space AUFELD21 in Traun. Gebaut mit Next.js (App Router, TypeScript), Supabase, Tailwind CSS und Vercel.

- Öffentliche Website: `/`
- Mitgliederportal: `/portal`
- Admin-Controlling: im Portal für Mitglieder mit der Rolle `admin`
- Zeitzone: Speicherung in UTC, Darstellung in `Europe/Vienna`

## 1. Supabase einrichten

1. Auf [supabase.com](https://supabase.com) ein Projekt anlegen.
2. Im **SQL Editor** die Dateien aus `supabase/migrations` in numerischer Reihenfolge ausführen (`001` bis aktuell `014`). Bei einer bestehenden AUFELD21-Datenbank nur die noch fehlenden Migrationen ausführen.
3. Unter **Authentication → Providers → Email** E-Mail/Passwort aktivieren.
4. Öffentliche Registrierung deaktivieren. Die App setzt zusätzlich `shouldCreateUser: false`; Zugang erhalten nur Personen, die ein Admin eingeladen hat und die in `public.members` vorhanden sind.
5. Unter **Authentication → URL Configuration** eintragen:
   - Site URL Produktion: `https://aufeld21.vercel.app` (später die eigene Domain)
   - Redirect URLs: `http://localhost:3000/**`, `https://aufeld21.vercel.app/**` und später `https://DEINE-DOMAIN/**`
6. Für echte Einladungs- und Passwort-Reset-Mails unter **Authentication → SMTP Settings** ein eigenes SMTP-Postfach hinterlegen, beispielsweise `portal@aufeld21.at` von World4You. Der Supabase-Testversand ist kein verlässlicher Produktiv-Maildienst.

### Ersten Admin anlegen

Unter **Authentication → Users** den Nutzer anlegen und dessen UUID kopieren. Danach im SQL Editor:

```sql
insert into public.members (id, email, name, role)
values ('UUID-AUS-AUTH-USERS', 'roland.potlog@gmail.com', 'Roland Potlog', 'admin');
```

Weitere Mieter, Nutzungspartner und Mitarbeiter werden anschließend im Admin-Bereich eingeladen. Mitarbeiter erhalten ein eigenes 12-Stunden-Kontingent, sehen jedoch weder Rechnungen noch Mietunterlagen.

## 2. Umgebungsvariablen

```bash
cp .env.example .env.local
```

Werte aus **Supabase → Project Settings → API** einsetzen:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` – ausschließlich serverseitig
- `CRON_SECRET` – langes, zufälliges Geheimnis für die Rechnungsautomatik

Dieselben Variablen in Vercel unter **Project Settings → Environment Variables** für Production, Preview und Development hinterlegen. Geheimnisse niemals committen oder mit `NEXT_PUBLIC_` benennen.

## 3. Lokal starten und prüfen

```bash
npm install
npm run dev
```

Danach `http://localhost:3000` beziehungsweise die von Next.js ausgegebene Adresse öffnen.

Vor jedem Deployment:

```bash
npm run lint
npm run build
npm audit
```

## 4. Vercel und Domain

1. GitHub-Repository in Vercel importieren.
2. Umgebungsvariablen setzen und deployen.
3. Unter **Settings → Domains** die gekaufte Domain hinzufügen und die von Vercel angezeigten DNS-Einträge beim Domain-Anbieter setzen.
4. Danach Supabase Site URL und Redirect URLs auf die finale Domain ergänzen.
5. Für den Cronjob in `vercel.json` wird Vercel Pro benötigt. Er ruft am 29. jedes Monats um 05:00 UTC die geschützte Rechnungsroute auf. Ohne Pro kann der Admin die gleiche Erzeugung im Controlling manuell starten.

E-Mail bleibt sinnvollerweise beim Domain-/Mailanbieter; Vercel hostet die Web-App, nicht die normalen Postfächer.

## Rechnungen und Verwaltung

- Am 29. werden Rechnungen für den Folgemonat erstellt; Fälligkeit ist der 10. des Leistungsmonats.
- Rechnungsnummern werden atomar in Postgres vergeben (`A21-YYYY-NNNN`). Eine Unique-Constraint verhindert Dubletten zusätzlich.
- Grundmieten werden bei Vertragsbeginn oder -ende im laufenden Monat nach Kalendertagen aliquotiert.
- 12 Meetingraum-Stunden sind je Kalendermonat inklusive; weitere Nutzung kostet 12 € netto je Stunde und wird in 30-Minuten-Schritten erfasst.
- Admins markieren den tatsächlichen Zahlungseingang manuell als bezahlt; offene, überfällige und bezahlte Rechnungen bleiben nachvollziehbar.
- PDFs und Verträge liegen privat im Storage-Bucket `member-documents`. Downloads erfolgen über kurzlebige signierte Links.
- Mitarbeiter sehen keine Rechnungen, Kautionen oder Verträge. Partner werden regulär abgerechnet, aber ohne Mietvertrags-/Kautionsverwaltung.

## Sicherheit und Betrieb

- RLS ist für die geschäftlichen Tabellen aktiv.
- Doppelbuchungen verhindert ein GiST-Exclusion-Constraint auf `tstzrange(start_at, end_at)`.
- Buchungen werden in UTC gespeichert und mit `date-fns-tz` in `Europe/Vienna` angezeigt.
- Dokument-Uploads sind auf PDF und 10 MB beschränkt.
- Admin- und Service-Routen prüfen Rolle beziehungsweise Cron-Secret serverseitig.
- Die PWA startet direkt im Mitgliederportal unter `/portal`.
- Regelmäßig Datenbank-Backups beziehungsweise Exporte prüfen. Für verlässliche automatische Backups und einen nicht pausierenden Produktivbetrieb ist ein kostenpflichtiger Supabase-Tarif sinnvoll.

## Offene Go-live-Punkte

- Eigenes SMTP testen: Einladung, Passwort setzen und Passwort vergessen.
- Firmenbuchgericht und zuständige Gewerbe-/Aufsichtsbehörde im Impressum anhand der offiziellen Unterlagen ergänzen.
- Datenschutzerklärung und steuerliche Rechnungslogik vor öffentlicher Bewerbung einmal rechtlich beziehungsweise steuerlich prüfen lassen.
- Nach Anschluss der finalen Domain alle Supabase-Redirects nochmals mit Mobilgerät testen.
