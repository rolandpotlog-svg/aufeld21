export function MarketingPrice({ net, unit, dark = false }: { net: number; unit: string; dark?: boolean }) {
  const gross = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(net * 1.2);
  return <div className="mt-5">
    <p className="text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">{net} €</p>
    <p className={`mt-2 text-sm leading-6 ${dark ? 'text-stone-300' : 'text-stone-600'}`}>netto / Monat · {unit}</p>
    <p className={`text-sm leading-6 ${dark ? 'text-stone-300' : 'text-stone-600'}`}>{gross} inkl. 20 % USt</p>
  </div>;
}
