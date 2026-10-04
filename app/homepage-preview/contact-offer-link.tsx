"use client";

import Link from 'next/link';
import type { ReactNode } from 'react';
import { contactHref, contactSelectionEvent, type ContactSelectionKey } from '@/lib/contacts/selection';

export function ContactOfferLink({ offer, children, className }: { offer: ContactSelectionKey; children: ReactNode; className?: string }) {
  return <Link href={contactHref(offer)} className={className} onClick={event => {
    if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
      // Reapply the choice even when this link already matches the current URL.
      window.dispatchEvent(new CustomEvent(contactSelectionEvent, { detail: offer }));
    }
  }}>{children}</Link>;
}
