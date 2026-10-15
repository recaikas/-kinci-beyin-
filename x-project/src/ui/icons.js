// Original, consistent 24px UI symbols. SVG stays crisp at mobile and desktop sizes.
const paths = {
  bilgisayar:'<rect x="3" y="3" width="18" height="13" rx="2"/><path d="M8 21h8M12 16v5M6 7h5M6 10h8"/>',
  gelistir:'<rect x="2" y="6" width="20" height="13" rx="4"/><path d="M6 11v4M4 13h4M16 11h.01M19 14h.01"/>',
  personel:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v2"/>',
  ofis:'<path d="m2 11 10-8 10 8M5 9v12h14V9M10 21v-7h4v7"/><path d="M9 9h.01M15 9h.01"/>',
  arge:'<path d="M9 3h6M10 3v6l-6 10q-1 2 2 2h12q3 0 2-2L14 9V3M7 15h10"/><path d="M10 18h.01M14 17h.01"/>',
  pazar:'<path d="M3 3v18h18M6 16l5-5 4 2 6-8M17 5h4v4"/>',
  finans:'<rect x="2" y="5" width="20" height="15" rx="2"/><path d="M2 9h20M16 13h6v4h-6zM6 5V2h12v3"/>',
  gunluk:'<path d="M4 3h13a3 3 0 0 1 3 3v15H6a3 3 0 0 1-3-3V4a1 1 0 0 1 1-1ZM6 17h14M7 7h9M7 11h6"/>',
  kaydet:'<path d="M4 3h13l4 4v14H3V3zM7 3v6h9V3M7 21v-8h10v8"/>',
  tanitim:'<path d="m3 10 15-6v15L3 14zM7 15l2 6h4l-2-5M21 8v7"/>',
};
export function menuIcon(name,color='#a9be8a') {
  const path=paths[name]||paths.bilgisayar;
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`)}`;
}
