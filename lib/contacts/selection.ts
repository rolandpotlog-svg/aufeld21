import type { contactOffers } from './input.ts';

export type ContactOffer = typeof contactOffers[number];
export const contactSelectionEvent = 'aufeld21:contact-offer';

const selections = {
  flex: { offer: 'Flex-Tisch', detail: null },
  fix: { offer: 'Fix-Tisch', detail: null },
  'office-17': { offer: 'Büro', detail: 'Büro · 17 m²' },
  'office-25': { offer: 'Büro', detail: 'Büro · 24,78 m²' },
  post: { offer: 'Postservice', detail: null },
  business: { offer: 'Business-Standort', detail: null },
  visit: { offer: 'Besichtigung / Sonstiges', detail: null },
} satisfies Record<string, { offer: ContactOffer; detail: string | null }>;

export type ContactSelectionKey = keyof typeof selections;
export type ContactSelection = { key: ContactSelectionKey | null; offer: ContactOffer; detail: string | null };

export function contactSelection(key: string | null): ContactSelection {
  if (key && Object.hasOwn(selections, key)) {
    const validKey = key as ContactSelectionKey;
    return { key: validKey, ...selections[validKey] };
  }
  return { key: null, offer: 'Besichtigung / Sonstiges', detail: null };
}

export function contactHref(key: ContactSelectionKey) {
  return `/?angebot=${encodeURIComponent(key)}#contact`;
}

export function contactMessagePrefix(selection: ContactSelection) {
  // Only attach an allowlisted office label, never arbitrary query text.
  const expected = contactSelection(selection.key);
  return selection.offer === 'Büro' && selection.detail && selection.detail === expected.detail
    ? `Anfrage: ${selection.detail}\n\n` : '';
}
