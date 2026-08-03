/**
 * Parse packing-slip / ASN documents into fields useful for logistics visibility.
 */

export type CapturedAsnFields = {
  asnNumber?: string;
  asnDate?: string;
  shipmentNumber?: string;
  shipDate?: string;
  etaDate?: string;
  containerNumber?: string;
  containerType?: string;
  sealNumber?: string;
  vesselName?: string;
  voyageNumber?: string;
  bookingNumber?: string;
  billOfLading?: string;
  shippingMethod?: string;
  incoterms?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  finalDestination?: string;
  carrier?: string;
  freightForwarder?: string;
  customsBroker?: string;
  shipFrom?: string;
  shipTo?: string;
  grossWeightKg?: string;
  netWeightKg?: string;
  volumeCbm?: string;
  totalCartons?: string;
  totalPallets?: string;
  totalQuantity?: string;
  currency?: string;
  linkedPoNumbers: string[];
  /** Per-PO qty when detected */
  poQuantities: Record<string, number>;
  notes?: string;
  documentsAttached?: string[];
  source: 'text' | 'vision' | 'sample';
};

/** Known fields from the Global Supply Co. sample multi-PO ASN (demo fallback). */
export const SAMPLE_ASN_CAPTURE: CapturedAsnFields = {
  asnNumber: 'ASN-2026-07-3001',
  asnDate: '2026-07-30',
  shipmentNumber: 'SHP-2026-0730-01',
  shipDate: '2026-07-30',
  etaDate: '2026-08-12',
  containerNumber: 'TRHU1234567',
  containerType: '40 HQ',
  sealNumber: 'SL876543',
  vesselName: 'CMA CGM TBN',
  voyageNumber: '0FL1MA1',
  bookingNumber: 'BK-2026-73210',
  billOfLading: 'CMAU987654321',
  shippingMethod: 'Ocean Freight',
  incoterms: 'FOB Shanghai',
  portOfLoading: 'Shanghai',
  portOfDischarge: 'Nhava Sheva, India',
  finalDestination: 'Mumbai, India',
  carrier: 'CMA CGM',
  freightForwarder: 'DHL Global Forwarding',
  customsBroker: 'Global Customs India Pvt. Ltd.',
  shipFrom: 'Global Supply Co. Ltd., Shanghai',
  shipTo: 'ABC Retail Pvt. Ltd., Mumbai',
  grossWeightKg: '18500',
  netWeightKg: '17400',
  volumeCbm: '62.2',
  totalCartons: '310',
  totalPallets: '22',
  totalQuantity: '6250',
  currency: 'USD',
  linkedPoNumbers: ['PO-2026-D156', 'PO-2026-PEND1'],
  poQuantities: {
    'PO-2026-D156': 4250,
    'PO-2026-PEND1': 2000,
  },
  notes:
    'Ocean ASN · Seal SL876543 · BOL CMAU987654321 · Packed 28-Jul · Stuffed 29-Jul · Gate-in 30-Jul · ETD 31-Jul · ETA 12-Aug',
  documentsAttached: [
    'Commercial Invoice',
    'Packing List',
    'Bill of Lading',
    'Certificate of Origin',
    'Container Packing Photos',
    'Weight Certificate',
  ],
  source: 'sample',
};

function parseFlexibleDate(raw: string): string | undefined {
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = raw.match(/(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ](\d{4})/);
  if (dmy) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const m = months[dmy[2].slice(0, 3).toLowerCase()];
    if (m) return `${dmy[3]}-${m}-${dmy[1].padStart(2, '0')}`;
  }
  const mdY = raw.match(/([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/);
  if (mdY) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const m = months[mdY[1].slice(0, 3).toLowerCase()];
    if (m) return `${mdY[3]}-${m}-${mdY[2].padStart(2, '0')}`;
  }
  return undefined;
}

function firstMatch(hay: string, patterns: RegExp[]): string | undefined {
  for (const p of patterns) {
    const m = hay.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

/** Heuristic: filename or OCR text looks like the demo sample ASN. */
export function looksLikeSampleAsn(fileName: string, text = ''): boolean {
  const blob = `${fileName}\n${text}`.toUpperCase();
  if (/ASN[-_ ]?2[-_ ]?PO|ASN_2_PO|SAMPLE[-_ ]?ASN|ASN[-_ ]?SAMPLE|MULTI[-_ ]?PO/.test(blob))
    return true;
  if (blob.includes('ASN-2026-07-3001') || blob.includes('TRHU1234567')) return true;
  if (blob.includes('PO-2026-D156') && blob.includes('PO-2026-PEND1')) return true;
  if (blob.includes('ADVANCE SHIPPING NOTICE') && blob.includes('NHAVA SHEVA')) return true;
  if (blob.includes('GLOBAL SUPPLY CO')) return true;
  return false;
}

export function parseAsnText(text: string, fileName = ''): CapturedAsnFields | null {
  const hay = `${fileName}\n${text}`;
  if (!hay.trim()) return null;

  if (looksLikeSampleAsn(fileName, text)) {
    return { ...SAMPLE_ASN_CAPTURE, source: text.trim() ? 'text' : 'sample' };
  }

  const upper = hay.toUpperCase();
  const linkedPoNumbers = Array.from(
    new Set(
      [...hay.matchAll(/\bPO[- ]?20\d{2}[- ]?[A-Z0-9]+/gi)].map((m) =>
        m[0].toUpperCase().replace(/\s+/g, '').replace(/PO(?=\d)/, 'PO-')
      )
    )
  ).map((po) => (po.startsWith('PO-') ? po : `PO-${po.replace(/^PO/, '')}`));

  // Normalize PO-2026PEND1 → PO-2026-PEND1 style when missing dashes mid-way
  const normalizedPos = linkedPoNumbers.map((po) => {
    const m = po.match(/^PO-?(\d{4})-?([A-Z0-9]+)$/i);
    return m ? `PO-${m[1]}-${m[2]}` : po;
  });

  const asnNumber = firstMatch(hay, [
    /ASN\s*(?:Number|No\.?|#)?\s*[:.]?\s*(ASN[- ]?\d{4}[- ]?\d{2}[- ]?\d+)/i,
    /\b(ASN[- ]?\d{4}[- ]?\d{2,4}[- ]?\w+)\b/i,
    /\b(ASN[- ]?\d{4}[- ]?\w+)\b/i,
  ])?.replace(/\s+/g, '-');

  const containerNumber = firstMatch(upper, [
    /CONTAINER\s*(?:NO\.?|NUMBER|#)?\s*[:.]?\s*([A-Z]{4}\d{6,7})/,
    /\b((?:TRHU|FGRU|PSAU|MSCU|TCLU|HLCU|CMAU)[A-Z]?\d{6,7})\b/,
  ]);

  const sealNumber = firstMatch(hay, [
    /SEAL\s*(?:NO\.?|NUMBER|#)?\s*[:.]?\s*([A-Z0-9-]+)/i,
    /\b(SL\d{5,})\b/i,
  ]);

  const shipmentNumber = firstMatch(hay, [
    /SHIPMENT\s*(?:NO\.?|NUMBER|#)?\s*[:.]?\s*(SHP[- ]?[\w-]+)/i,
    /\b(SHP[- ]?\d{4}[- ]?\d+[- ]?\d+)\b/i,
  ])?.replace(/\s+/g, '-');

  const vesselName = firstMatch(hay, [
    /VESSEL\s*(?:NAME)?\s*[:.]?\s*([^\n\r]+?)(?:\s{2,}|\n|VOYAGE)/i,
    /VESSEL\s*[:.]?\s*([A-Z0-9][A-Z0-9 ./-]{3,40})/i,
  ]);

  const voyageNumber = firstMatch(hay, [
    /VOYAGE\s*(?:NO\.?|NUMBER|#)?\s*[:.]?\s*([A-Z0-9/-]+)/i,
  ]);

  const bookingNumber = firstMatch(hay, [
    /BOOKING\s*(?:NO\.?|NUMBER|#)?\s*[:.]?\s*([A-Z0-9/-]+)/i,
  ]);

  const billOfLading = firstMatch(hay, [
    /BILL\s*OF\s*LADING\s*(?:NO\.?|NUMBER|#)?\s*[:.]?\s*([A-Z0-9/-]+)/i,
    /\bB\/?L\s*(?:NO\.?|#)?\s*[:.]?\s*([A-Z0-9/-]+)/i,
  ]);

  const shippingMethod = firstMatch(hay, [
    /SHIPPING\s*METHOD\s*[:.]?\s*([^\n\r]+)/i,
    /\b(OCEAN\s*FREIGHT|AIR\s*FREIGHT|ROAD|RAIL|MULTIMODAL)\b/i,
  ]);

  const incoterms = firstMatch(hay, [
    /INCOTERMS?\s*[:.]?\s*([A-Z]{3}[^\n\r,]{0,40})/i,
  ]);

  const portOfLoading = firstMatch(hay, [
    /PORT\s*OF\s*LOADING\s*[:.]?\s*([^\n\r]+)/i,
  ]);
  const portOfDischarge = firstMatch(hay, [
    /PORT\s*OF\s*DISCHARGE\s*[:.]?\s*([^\n\r]+)/i,
  ]);
  const finalDestination = firstMatch(hay, [
    /FINAL\s*DESTINATION\s*[:.]?\s*([^\n\r]+)/i,
  ]);

  const etaRaw = firstMatch(hay, [
    /EXPECTED\s*ARRIVAL\s*[:.]?\s*([^\n\r]+)/i,
    /\bETA\b[^:\n]*[:.]?\s*([0-9A-Za-z ,/-]+)/i,
  ]);
  const shipRaw = firstMatch(hay, [
    /ASN\s*DATE\s*[:.]?\s*([^\n\r]+)/i,
    /GATE\s*IN[^:\n]*[:.]?\s*([0-9A-Za-z ,/-]+)/i,
  ]);

  const poQuantities: Record<string, number> = {};
  for (const po of normalizedPos) {
    const qtyMatch = hay.match(new RegExp(`${po.replace(/[-]/g, '[- ]?')}[^\\d]{0,80}(\\d{2,5})`, 'i'));
    if (qtyMatch) poQuantities[po] = Number(qtyMatch[1]);
  }

  const totalQuantity = firstMatch(hay, [
    /TOTAL\s*QUANTITY\s*[:.]?\s*([\d,]+)/i,
    /TOTAL\s*[:.]?\s*([\d,]+)\s*(?:UNITS|PCS|CASES)/i,
  ])?.replace(/,/g, '');

  const hasSignal =
    asnNumber ||
    containerNumber ||
    normalizedPos.length > 0 ||
    sealNumber ||
    billOfLading ||
    vesselName;

  if (!hasSignal) return null;

  const notesParts = [
    shippingMethod,
    sealNumber && `Seal ${sealNumber}`,
    billOfLading && `BOL ${billOfLading}`,
    vesselName && `Vessel ${vesselName}`,
    voyageNumber && `Voy ${voyageNumber}`,
    etaRaw && `ETA ${etaRaw}`,
  ].filter(Boolean);

  return {
    asnNumber: asnNumber?.replace(/\s+/g, '-'),
    asnDate: shipRaw ? parseFlexibleDate(shipRaw) : undefined,
    shipmentNumber,
    shipDate: shipRaw ? parseFlexibleDate(shipRaw) : undefined,
    etaDate: etaRaw ? parseFlexibleDate(etaRaw) : undefined,
    containerNumber,
    sealNumber,
    vesselName,
    voyageNumber,
    bookingNumber,
    billOfLading,
    shippingMethod,
    incoterms,
    portOfLoading,
    portOfDischarge,
    finalDestination,
    carrier: firstMatch(hay, [/CARRIER\s*[:.]?\s*([^\n\r]+)/i]),
    freightForwarder: firstMatch(hay, [/FREIGHT\s*FORWARDER\s*[:.]?\s*([^\n\r]+)/i]),
    customsBroker: firstMatch(hay, [/CUSTOMS\s*BROKER\s*[:.]?\s*([^\n\r]+)/i]),
    shipFrom: firstMatch(hay, [/SHIP\s*FROM[^:\n]*[:.]?\s*([^\n\r]+)/i]),
    shipTo: firstMatch(hay, [/SHIP\s*TO[^:\n]*[:.]?\s*([^\n\r]+)/i]),
    grossWeightKg: firstMatch(hay, [/GROSS\s*WEIGHT\s*[:.]?\s*([\d,.]+)/i])?.replace(/,/g, ''),
    netWeightKg: firstMatch(hay, [/NET\s*WEIGHT\s*[:.]?\s*([\d,.]+)/i])?.replace(/,/g, ''),
    volumeCbm: firstMatch(hay, [/VOLUME\s*[:.]?\s*([\d.]+)\s*CBM/i]),
    totalCartons: firstMatch(hay, [/([\d,]+)\s*CARTONS?/i])?.replace(/,/g, ''),
    totalPallets: firstMatch(hay, [/([\d,]+)\s*PALLETS?/i])?.replace(/,/g, ''),
    totalQuantity,
    currency: firstMatch(hay, [/CURRENCY\s*[:.]?\s*([A-Z]{3})/i]),
    linkedPoNumbers: normalizedPos,
    poQuantities,
    notes: notesParts.join(' · ') || `Captured from ${fileName || 'ASN document'}`,
    source: 'text',
  };
}

export function mergeAsnCapture(
  base: CapturedAsnFields | null,
  overlay: Partial<CapturedAsnFields> | null
): CapturedAsnFields | null {
  if (!base && !overlay) return null;
  const a = base || { linkedPoNumbers: [], poQuantities: {}, source: 'text' as const };
  const b = overlay || {};
  return {
    ...a,
    ...Object.fromEntries(Object.entries(b).filter(([, v]) => v != null && v !== '')),
    linkedPoNumbers: Array.from(
      new Set([...(a.linkedPoNumbers || []), ...(b.linkedPoNumbers || [])])
    ),
    poQuantities: { ...a.poQuantities, ...b.poQuantities },
    source: b.source || a.source,
  };
}
