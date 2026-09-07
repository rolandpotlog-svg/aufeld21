# AUFELD21

Öffentliche Website und geschütztes Mitgliederportal für den Co-Working-Space AUFELD21 in Traun. Gebaut mit Next.js (App Router, TypeScript), Supabase, Tailwind CSS und Vercel.

- Öffentliche Website: `https://www.aufeld21.at/`
- Mitgliederportal: `https://www.aufeld21.at/portal`
- Admin-Controlling: im Portal für Mitglieder mit der Rolle `admin`
- Zeitzone: Speicherung in UTC, Darstellung in `Europe/Vienna`

## 1. Supabase einrichten

1. Auf [supabase.com](https://supabase.com) ein Projekt anlegen.
2. Im **SQL Editor** die Dateien aus `supabase/migrations` in numerischer Reihenfolge ausführen (`001` bis `014`, anschließend die datierten Migrationen). Bei einer bestehenden AUFELD21-Datenbank nur die noch fehlenden Migrationen ausführen.
3. Unter **Authentication → Providers → Email** E-Mail/Passwort aktivieren.
4. Öffentliche Registrierung deaktivieren. Die App setzt zusätzlich `shouldCreateUser: false`; Zugang erhalten nur Personen, die ein Admin eingeladen hat und die in `public.members` vorhanden sind.
5. Unter **Authentication → URL Configuration** eintragen:
   - Site URL Produktion: `https://www.aufeld21.at`
   - Produktions-Redirects: `https://www.aufeld21.at/portal` und `https://www.aufeld21.at/portal?setup=password` (Magic Link, Einladung und Passwort-Reset).
   - Bestehende Freigabe `https://aufeld21.vercel.app/**` beibehalten, damit bereits versendete Links weiterhin funktionieren. Lokale Entwicklungsadressen separat freigeben (derzeit `http://localhost:3210/**`). Keine pauschale Freigabe fremder Domains.
6. Für echte Einladungs- und Passwort-Reset-Mails unter **Authentication → SMTP Settings** einen Versanddienst hinterlegen. AUFELD21 verwendet Resend; ein kostenpflichtiges Postfach bei World4You ist dafür nicht nötig. World4You verwaltet nur die DNS-Freigabe der Domain. Der Supabase-Testversand ist kein Produktiv-Maildienst und erreicht nur vorab zugelassene Team-Adressen.

### Auth-Mails über Resend

- Domain `aufeld21.at` in Resend verifizieren; die dort angezeigten DKIM-/Versand-DNS-Einträge bei World4You ergänzen. Bestehende Web- und Mail-Einträge nicht überschreiben.
- SMTP: Host `smtp.resend.com`, Port `465`, Benutzer `resend`, Absender `AUFELD21 <noreply@aufeld21.at>`.
- Als SMTP-Passwort einen Resend-Schlüssel mit **Sending access**, beschränkt auf **aufeld21.at**, direkt in Supabase speichern. Keine Schlüssel in Git, Browser-Code oder `NEXT_PUBLIC_`-Variablen ablegen.
- Klick-/Öffnungs-Tracking für Auth-Mails nicht aktivieren. Das vorhandene 60-Sekunden-Intervall je Nutzer beibehalten; zunächst 30 Auth-Mails pro Stunde.
- Free-Tarif am 07.09.2026: 3.000 Transaktionsmails pro Monat, maximal 100 pro Tag. Kostenpflichtige Zusatzkontingente bleiben deaktiviert; aktuelle Limits im Resend-Konto prüfen.
- Nach der Einrichtung zuerst eine Passwort-Mail an den Admin testen und den Zustellstatus in Resend prüfen. Empfänger bestätigt zusätzlich den Posteingang und testet den Link selbst, ohne das Passwort weiterzugeben. Erst danach Einladungen bzw. neue Passwort-Links an Mieter senden.
- `noreply@aufeld21.at` ist nur ein Versandabsender, kein empfangendes Postfach.

### Passwort- und Einladungslinks

Das Portal verarbeitet Mail-Callbacks zentral in `lib/supabase/portal-auth.ts`: Browser-Anforderungen bleiben PKCE-geschützt; vom Admin ausgelöste Einladungs-/Reset-Links mit Tokenpaar werden mit `auth.setSession` bei Supabase validiert. Deshalb ist die automatische URL-Erkennung des SSR-Browserclients deaktiviert, nicht jedoch PKCE. Callback-Codes werden nur einmal eingelöst, sensible URL-Parameter sofort entfernt und Fehler sichtbar angezeigt. Das Passwortformular erscheint erst nach erfolgreicher Sitzungsermittlung; die bestehende Prüfung aktiver Mitglieder und sämtliche RLS-/Admin-Prüfungen bleiben erhalten.

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
- `NEXT_PUBLIC_SITE_URL=https://www.aufeld21.at` – öffentliche HTTPS-Domain für Canonical-Links und Sitemap; Änderungen erfordern ein neues Deployment
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
npm test
npm run build
npm audit
```

## 4. Vercel und Domain

1. GitHub-Repository in Vercel importieren.
2. Umgebungsvariablen setzen und deployen.
3. Unter **Settings → Domains** ist `www.aufeld21.at` mit Production verbunden; `aufeld21.at` leitet mit 308 darauf weiter. Die von Vercel angezeigten DNS-Einträge beim Domain-Anbieter setzen. Alte, widersprüchliche Web-Einträge ersetzen; Mail-, MX- und TXT-Einträge unverändert lassen.
4. HTTPS und die Weiterleitung prüfen, danach Supabase Site URL und die exakten Portal-Redirects wie oben ergänzen. Die bisherige `aufeld21.vercel.app`-Adresse bleibt mit Production verbunden. Browser-Anmeldungen sind domaingebunden: Auf der neuen Domain müssen Mitglieder sich einmal neu anmelden; vorhandene Konten und Passwörter bleiben gültig.
5. Der Cronjob in `vercel.json` prüft täglich um 05:00 UTC fehlende Rechnungen für den aktuellen Monat; ab dem 25. zusätzlich für den Folgemonat (Europe/Vienna). So werden kurzzeitig fehlgeschlagene Läufe nachgeholt. `CRON_SECRET` muss dafür in Vercel gesetzt sein. Im Vercel-Dashboard muss der Produktions-Cron aktiviert und ein erfolgreicher Lauf kontrolliert werden. Der Admin kann dieselbe Prüfung im Controlling manuell starten. Nicht abgeschlossene und fehlgeschlagene Läufe bleiben im Abrechnungsprotokoll sichtbar.

Vercel hostet die Web-App. Resend übernimmt die automatischen Auth-Mails; normale empfangende Postfächer wären ein separat zu wählender Dienst und sind für diesen Versand nicht erforderlich.

## Rechnungen und Verwaltung

### Automatische Portal-Mails

- Neue endgültige Rechnungen benachrichtigen den aktiven Rechnungsempfänger; neue Meldungen benachrichtigen ausschließlich die aktive Administratorin `julia.potlog@gmail.com`. Mitarbeiter erhalten keine Rechnungsmails.
- Keine Nachsendung vorhandener Rechnungen/Meldungen. Bezahlt/offen-Umschalten löst keine weitere Mail aus; Rechnungsdatensätze und Nummern bleiben unverändert. Vordatierte Rechnungen werden erst ab ihrem Ausstellungsdatum angekündigt.
- Supabase-Trigger schreiben transaktional in `email_notifications`. Der benannte Supabase-Cron `aufeld21-email-notifications` prüft minütlich und übergibt höchstens eine Mail je Lauf über `pg_net` an Resend. Meldungen werden priorisiert; Abrechnungsstapel benötigen entsprechend mehrere Minuten. Dafür muss kein Browser offen sein und kein zusätzlicher Vercel-Cron laufen.
- Einrichtung: Migrationen anwenden, einen separaten Resend-Schlüssel mit **Sending access nur für aufeld21.at** im Supabase-Dashboard unter Integrations → Vault als `aufeld21_notification_resend_key` speichern, danach serverseitig `update public.email_notification_settings set enabled=true where id;`. Zum Pausieren `enabled=false` setzen; wartende Ereignisse bleiben erhalten. Kein Schlüssel in SQL-Editor-Verlauf, Git, Logs oder Browser-Code!
- Absender: `AUFELD21 <noreply@aufeld21.at>`. Portal-Link: `https://www.aufeld21.at/portal`. Keine Anhänge, vertraulichen Meldungstexte oder Login-Tokens in Benachrichtigungen. Die Auth-SMTP-Konfiguration bleibt separat.
- Unter **Admin → E-Mails** stehen Versandstatus, letzte Prüfung und Fehler. „An Maildienst übergeben“ ist keine Zustellbestätigung; diese wird über den verlinkten Resend-Log geprüft. Auch eine Zustellbestätigung bedeutet nicht, dass der Empfänger die Mail gelesen hat. `failed`/`review` müssen manuell anhand der Resend-Logs geprüft werden; kein ungeprüfter Neuversand.
- Stabile Idempotenz-ID und eingefrorener Mailinhalt schützen Wiederholungen. Temporäre Fehler werden erneut versucht. Bei unklarer Zustellung nach 23 Stunden stoppt der Versand zur Prüfung, da Resend Idempotenz-IDs nur 24 Stunden vorhält. Eindeutig abgewiesene Limit-Versuche dürfen später erneut versucht werden.
- Intern maximal 70 neue Benachrichtigungen/UTC-Tag und 2.500/UTC-Monat. Das ist ein Puffer, keine separate Resend-Quote: Auth-Mails und andere Versandwege teilen weiterhin das Free-Kontingent. Bei Limits bleiben Nachrichten in der Warteschlange; es wird kein kostenpflichtiges Paket aktiviert.
- Sicherheitsgrenze: Outbox/Status sind per RLS nur für aktive Admins lesbar und für Browser nicht beschreibbar. Vault und `notification_private` bleiben privat. Auf gehostetem Supabase sind `net`-Objektprivilegien systemverwaltet; REVOKE kann wirkungslos sein. **`net`/`vault` niemals als Data-API-Schema freigeben und keine öffentliche RPC zum Lesen ihrer Inhalte hinzufügen.** Bei Einrichtung und Änderungen tatsächlichen API-Zugriff testen; nicht nur erfolgreiche Migrationen voraussetzen.
- Tests: `lib/notifications/database.test.ts` deckt neue Ereignisse, Rechte, Rollback, identische Retries, Limits, verlorene Antworten, Mitarbeiter, Deaktivierung und unveränderte Rechnungen ohne Produktionszugriff ab.

### Abrechnungsverhalten

- Am 25. werden Rechnungen für den Folgemonat erstellt; Fälligkeit ist der 10. des Leistungsmonats.
- Rechnungsnummern werden atomar in Postgres vergeben (`A21-YYYY-NNNN`). Eine Unique-Constraint verhindert Dubletten zusätzlich.
- Grundmieten werden bei Vertragsbeginn oder -ende im laufenden Monat nach Kalendertagen aliquotiert.
- 12 Meetingraum-Stunden sind je Kalendermonat inklusive; weitere Nutzung kostet 12 € netto je Stunde und wird in 30-Minuten-Schritten erfasst.
- Admins markieren den tatsächlichen Zahlungseingang manuell als bezahlt; offene, überfällige und bezahlte Rechnungen bleiben nachvollziehbar.
- Verträge und die gemeinsame Hausordnung liegen privat im Storage-Bucket `member-documents`. Dokumentdownloads prüfen die Storage-RLS. Rechnungs-PDFs werden über eine authentifizierte Serverroute aus eingefrorenen Empfängerdaten und geschützten Rechnungspositionen erzeugt, nicht als bereits archivierte PDF-Dateien ausgegeben.
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

## Sicherheitsupdate vom 06.09.2026

Vor Veröffentlichung des neuen Anwendungscodes auf bestehenden Installationen diese zusätzlichen Migrationen in Reihenfolge ausführen:

1. `20260906183145_invoice_reliability_and_portal_safety.sql`
2. `20260906183147_shared_space_documents.sql`

Die Rechnungsfunktion erstellt Entwurf, Positionen, Nummer und Empfängersnapshot innerhalb einer Datenbanktransaktion. Wiederholungen und parallele Aufrufe werden durch Sperre und Unique-Index abgesichert. Fehler werden nicht als erfolgreiche Überspringer gezählt. Neue Rechnungen verwenden das tatsächliche Monatsende, einschließlich des 31. und Schaltjahren.

Bestehende Rechnungs-/Positionsdatensätze bleiben unverändert. Bei der Migration wird der **aktuell herunterladbare** Empfängerstand eingefroren (PDF-Version 1). Das rekonstruiert keine früher versendeten Originaldateien, wenn Stammdaten bereits davor geändert wurden. Bereits versendete PDFs deshalb weiterhin aufbewahren. Neue Rechnungen erhalten PDF-Version 2 mit mehrseitigen, ungekürzten Positionen. Versionierte Generatoren nicht nachträglich ändern; bei späteren Änderungen eine neue Version anlegen.

Die Tabelle `invoice_usage_periods` verhindert erneute Verrechnung bereits zugeordneter Zusatzstunden. Noch nicht berechnete abgeschlossene Nutzungsmonate werden bei der nächsten **neuen** Monatsrechnung nachgeholt. Bei bis Dezember vorab ausgestellten Rechnungen geschieht dies entsprechend erst mit einer späteren neuen Rechnung. Bei Vertragsende/Deaktivierung ist eine Schlussabrechnung separat zu kontrollieren. Bestehende Vorausrechnungen werden niemals automatisch verändert. Vergangene/begonnene Buchungen sind für normale Mitglieder nicht mehr löschbar; Korrekturen durch die Verwaltung müssen nachvollziehbar separat behandelt werden.

`billing_runs` ist nur für Admins lesbar. `invoice_usage_periods` hat bewusst keine Browser-Policies: Zugriff ausschließlich über den Server-Service-Account (RLS standardmäßig gesperrt). Der Supabase-Advisor-Hinweis dazu ist beabsichtigt. Bestehende Hinweise zu [privilegierten Funktionen](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [btree_gist im public-Schema](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public) und [Passwortschutz](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) erfordern weiterhin eine bewusste Betriebsentscheidung, keine pauschale Freigabe.

Gemeinsame Dokumente werden über `space_documents` mit einem privaten `space/…`-Storagepfad freigegeben. Nur aktive Mitglieder können veröffentlichte Dokumente lesen; auch Mitarbeiter erhalten so die Hausordnung. Neue Vertragsentwürfe sind nicht automatisch für Mieter freigegeben. Die normale Mieterablage und Mieterakte zeigen nur Originale, ohne Entwürfe zu löschen.

Meldungen, Rechnungen und Unterlagen aktualisieren sich beim Zurückkehren ins Portal sowie minütlich im sichtbaren Tab. Das sind **In-App-Hinweise, keine Betriebssystem-Push-Nachrichten**. Die Lesebestätigung bleibt browserbezogen. Echte Push-Zustellung erfordert eine gesonderte Implementierung und Tests auf den tatsächlichen Geräten.

Tests: `npm test` prüft Monatsgrenzen, aliquote Miete, Rechnungsfilter, lokale Postgres-Transaktionen/Rollback, Zugriffsrechte und mehrseitige PDFs. Die Datenbanktests laufen ausschließlich in PGlite im Arbeitsspeicher und berühren keine Produktionsdaten. Mobile Browser-Emulation ersetzt keinen abschließenden iPhone-/Android-Test.
