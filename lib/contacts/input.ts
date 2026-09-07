export const contactOffers = ['Büro', 'Flex-Tisch', 'Fix-Tisch', 'Postservice', 'Business-Standort', 'Besichtigung / Sonstiges'] as const;
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function contactInput(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('Bitte alle Pflichtfelder ausfüllen.');
  const data = value as Record<string, unknown>;
  const string = (key: string, min: number, max: number) => {
    const v = typeof data[key] === 'string' ? (data[key] as string).trim() : '';
    if (v.length < min || v.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)) throw new Error('Bitte Eingaben und Textlängen prüfen.');
    return v;
  };
  const id = string('id', 36, 36), name = string('name', 2, 120), email = string('email', 3, 254).toLowerCase();
  const phone = string('phone', 0, 50), offer = string('offer', 1, 60), message = string('message', 10, 2000);
  if (!uuidPattern.test(id) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !contactOffers.includes(offer as typeof contactOffers[number])) throw new Error('Bitte eine gültige E-Mail-Adresse und ein Angebot wählen.');
  return { id, name, email, phone, offer, message };
}

// Enforce the actual streamed body size, not just a client-supplied header.
export async function smallJson(request: Request, maximum = 16000): Promise<unknown> {
  if (!request.headers.get('content-type')?.startsWith('application/json') || !request.body) throw new Error('Ungültige Anfrage.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new Error('Die Anfrage ist zu groß.'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally { reader.releaseLock(); }
}
