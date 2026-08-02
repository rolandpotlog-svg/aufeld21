# Raumkalender

Minimaler Meetingraum-Kalender für einen kleinen Co-Working-Space. Gebaut mit Next.js, TypeScript, Supabase und Tailwind CSS.

## 1. Supabase-Projekt anlegen

1. Auf [supabase.com](https://supabase.com) ein neues Projekt erstellen.
2. Im Projekt unter **SQL Editor** eine neue Query öffnen.
3. Den vollständigen Inhalt von `supabase/migrations/001_initial_schema.sql` einfügen und ausführen.
4. Unter **Authentication → Providers → Email** den E-Mail-Provider aktivieren.
5. Öffentliche Registrierung deaktivieren: Unter **Authentication → Settings** die Option **Allow new users to sign up** ausschalten. Die App setzt zusätzlich `shouldCreateUser: false`.
6. Unter **Authentication → URL Configuration** die lokale URL `http://localhost:3000` und später die Vercel-URL als Redirect URL ergänzen.

## 2. Ersten Nutzer anlegen

1. Unter **Authentication → Users** mit **Add user** einen Nutzer anlegen. Die E-Mail muss bestätigt sein.
2. Die UUID des neuen Nutzers kopieren.
3. Im SQL Editor ausführen:

```sql
insert into public.members (id, email, name)
values (
  'UUID-AUS-AUTH-USERS',
  'name@beispiel.at',
  'Vorname'
);
```

Den ersten Nutzer anschließend zum Admin machen:

```sql
update public.members
set role = 'admin'
where email = 'name@beispiel.at';
```

Weitere Personen können danach direkt im Admin-Bereich als **Mieter**, **Nutzungspartner** oder **Mitarbeiter** eingeladen werden. Nur Nutzer, die sowohl in `auth.users` als auch in `public.members` existieren, erhalten Zugriff.

Bei einer bereits eingerichteten Datenbank werden anschließend die Migrationen `002_employee_role.sql` bis `008_admin_is_tenant.sql` in numerischer Reihenfolge ausgeführt. Bei einem komplett neuen Projekt genügt die aktuelle `001_initial_schema.sql`, da sie bereits alle Ergänzungen enthält.

Mitarbeiter wie Kylian und Romeo erhalten einen eigenen Magic-Link-Zugang und ein persönliches Meetingraum-Kontingent von 12 Stunden je Kalendermonat. Der Admin kann ihnen monatsweise Bonusstunden geben. Mitarbeiter sehen keine Rechnungen, Kautionen oder Mietverträge; Hausordnung und allgemeine Informationen können ihnen weiterhin bereitgestellt werden. Nutzungspartner wie Daniel und Slavin erhalten ebenfalls 12 Stunden plus Bonus, werden regulär abgerechnet, erscheinen aber nicht in den Bereichen Mietvertrag und Kaution.

## 3. Umgebungsvariablen

`.env.example` als `.env.local` kopieren. Die Werte stehen in Supabase unter **Project Settings → API**:

```bash
cp .env.example .env.local
```

Benötigt werden:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (nur serverseitig, für Admin-Einladungen)
- `CRON_SECRET` (langes zufälliges Geheimnis für die automatische Rechnungserstellung)

Der Publishable Key darf im Browser verwendet werden; die Zugriffsregeln werden durch RLS erzwungen. Der Secret Key darf ausschließlich als serverseitige Umgebungsvariable verwendet und niemals mit `NEXT_PUBLIC_` benannt werden.

## 4. Lokal starten

```bash
npm install
npm run dev
```

Danach die angezeigte lokale URL öffnen.

## 5. Auf Vercel deployen

1. Das Projekt in ein Git-Repository pushen.
2. In [vercel.com](https://vercel.com) **Add New → Project** wählen und das Repository importieren.
3. Unter **Environment Variables** alle vier Variablen aus `.env.local` eintragen.
4. Deploy auslösen.
5. Die fertige `https://…vercel.app`-Adresse in Supabase unter **Authentication → URL Configuration** als **Site URL** und **Redirect URL** eintragen.

## Sicherheit und Zeit

- Postgres verhindert Doppelbuchungen mit einem GiST-Exclusion-Constraint. Die App übersetzt den Postgres-Fehler `23P01` in eine verständliche Meldung.
- RLS erlaubt Lesenzugriff nur angemeldeten Mitgliedern. Anlegen und Löschen ist nur für eigene Buchungen erlaubt.
- Zeitpunkte werden als `timestamptz` in UTC gespeichert und mit `date-fns-tz` in `Europe/Vienna` dargestellt. Sommer- und Winterzeit werden von der IANA-Zeitzonendatenbank behandelt.
- Der Pro-Tarif enthält 12 Meetingraum-Stunden je Kalendermonat. Weitere Nutzung wird in 30-Minuten-Schritten zu 12 € netto pro Stunde berechnet.
- Für Mitarbeiter gelten ebenfalls 12 Stunden plus freigegebene Bonusstunden. Eine Buchung über dieses Kontingent hinaus wird direkt in der Datenbank abgelehnt und nicht verrechnet.
- Admin-Gutschriften gelten für genau einen Kalendermonat und werden mit Admin, Grund und Zeitpunkt protokolliert.
- Am ersten Tag jedes Monats erzeugt ein geschützter Vercel-Cronjob automatisch Rechnungsentwürfe. Er kombiniert die Grundmiete des aktuellen Monats mit den abrechenbaren Meetingraum-Zusatzstunden des abgeschlossenen Vormonats.
- Die automatische Rechnungserstellung berücksichtigt Mieter und Nutzungspartner; Mitarbeiter werden vollständig von der Abrechnung ausgeschlossen.
- Beginnt oder endet ein Vertrag während eines Monats, wird die Grundmiete nach den tatsächlichen Kalendertagen aliquotiert.
- Rechnungsentwürfe erhalten erst beim manuellen Finalisieren eine fortlaufende Nummer im Format `A21-YYYY-NNNN`. Finalisierte Rechnungen können von Mietern im persönlichen Portal als PDF heruntergeladen und vom Admin als bezahlt markiert werden.
- Beim Erfassen einer Zahlung wählt der Admin den tatsächlichen Zahlungstag. Offene und bezahlte Rechnungen sowie das Zahlungsdatum bleiben damit nachvollziehbar dokumentiert.
- Der Admin kann fehlerhafte Zahlungseingänge zurücksetzen und offene Rechnungen beziehungsweise Entwürfe stornieren.
- Monatspreise werden intern netto gespeichert. Bei einem vereinbarten Endpreis von 150 € inklusive 20 % USt sind daher 125 € netto zu hinterlegen.
- Für Rechnungen werden 20 % USt verwendet. Da Geschäftsraumvermietung in Österreich grundsätzlich umsatzsteuerfrei sein kann und die Steuerpflicht von der konkreten Option abhängt, muss diese Einstellung vor Echtnutzung durch die Steuerberatung bestätigt werden.
- Kautionen werden getrennt von Rechnungen mit vereinbartem Betrag, Zahlungseingang, Rückzahlung und interner Notiz geführt.
- Mietverträge und Hausordnung liegen als private PDFs im Supabase-Storage-Bucket `member-documents`. Die Migration legt Bucket und Policies an; Mieter erhalten ausschließlich für eigene freigegebene Dokumente zeitlich begrenzte Download-Links.
- Dokument-Uploads sind auf PDF und maximal 10 MB beschränkt.
- Meldungen aus dem Space können im Admin-Controlling gelesen und als erledigt markiert werden.
- Zugänge lassen sich deaktivieren und später wieder aktivieren, ohne Benutzer- oder Buchungsdaten zu löschen.
- Die App ist installierbar. Browser bieten je nach Plattform im Menü **Zum Home-Bildschirm** oder **App installieren** an.
