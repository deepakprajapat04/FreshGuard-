import { downloadExcelCsv } from '../components/DataTable';
import { getAwardedQuote, getRfqDropQty, type FruitsRfq } from './fruitsRfqFlow';

export const MASS_SHIPPING_HEADERS = [
  'RFQ ID',
  'Item',
  'Fruit',
  'Quantity',
  'Unit',
  'Awarded price / case',
  'Total value',
  'Buyer',
  'Destination',
  'Delivery date',
  'Cold chain',
  'Min shelf life',
  'Size spec',
  'Vendor',
  'Awarded at',
  'ASN number',
  'Container',
  'Ship date',
  'ETA',
] as const;

export type MassShippingRow = {
  rfqId: string;
  asnNumber: string;
  containerNumber: string;
  shipDate: string;
  eta: string;
};

function parseDelimited(text: string): string[][] {
  const sample = text.replace(/^\uFEFF/, '').slice(0, 4000);
  const comma = (sample.match(/,/g) ?? []).length;
  const tab = (sample.match(/\t/g) ?? []).length;
  const delim = tab > comma ? '\t' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  const src = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  row.push(cell.trim());
  if (row.some((c) => c.length > 0)) rows.push(row);
  return rows;
}

function normHeader(h: string) {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const HEADER_ALIASES: Record<string, keyof MassShippingRow | 'skip'> = {
  'rfq id': 'rfqId',
  rfqid: 'rfqId',
  rfq: 'rfqId',
  'asn number': 'asnNumber',
  asn: 'asnNumber',
  container: 'containerNumber',
  'container number': 'containerNumber',
  'ship date': 'shipDate',
  shipdate: 'shipDate',
  eta: 'eta',
};

export function downloadMassShippingExcel(rfqs: FruitsRfq[]) {
  const rows = rfqs.map((r) => {
    const quote = getAwardedQuote(r);
    return [
      r.id,
      r.item,
      r.fruitItem,
      String(getRfqDropQty(r)),
      r.unit,
      quote ? quote.pricePerCase.toFixed(2) : '',
      quote ? quote.totalPrice.toFixed(2) : '',
      r.buyer,
      r.destination,
      r.deliveryDate,
      r.specifications.tempRange,
      r.specifications.minShelfLife,
      r.specifications.sizeSpec,
      r.awardedVendor ?? '',
      r.awardedAt ?? '',
      '',
      '',
      '',
      '',
    ];
  });
  downloadExcelCsv('rfq-mass-shipping.xls', [...MASS_SHIPPING_HEADERS], rows);
}

export function parseMassShippingExcel(text: string): MassShippingRow[] {
  const table = parseDelimited(text);
  if (table.length < 2) return [];

  const header = table[0].map(normHeader);
  const idx: Partial<Record<keyof MassShippingRow, number>> = {};
  header.forEach((h, i) => {
    const key = HEADER_ALIASES[h];
    if (key && key !== 'skip') idx[key] = i;
  });
  if (idx.rfqId == null) return [];

  const out: MassShippingRow[] = [];
  for (const line of table.slice(1)) {
    const rfqId = line[idx.rfqId]?.trim();
    if (!rfqId) continue;
    out.push({
      rfqId,
      asnNumber: idx.asnNumber != null ? line[idx.asnNumber]?.trim() ?? '' : '',
      containerNumber: idx.containerNumber != null ? line[idx.containerNumber]?.trim() ?? '' : '',
      shipDate: idx.shipDate != null ? line[idx.shipDate]?.trim() ?? '' : '',
      eta: idx.eta != null ? line[idx.eta]?.trim() ?? '' : '',
    });
  }
  return out;
}

export function looksLikeSpreadsheet(file: File) {
  return /\.(csv|xls|xlsx|txt)$/i.test(file.name) || file.type.startsWith('text/');
}

/** Excel date serial or locale date → YYYY-MM-DD when possible. */
export function normalizeShipDate(raw: string): string {
  const s = raw.trim();
  if (!s) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return s;
}
