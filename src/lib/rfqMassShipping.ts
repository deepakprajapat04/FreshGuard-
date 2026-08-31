import { downloadExcelCsv } from '../components/DataTable';
import {
  fromContractNumber,
  getAwardedQuote,
  getRfqDropQty,
  toContractNumber,
  type FruitsRfq,
} from './fruitsRfqFlow';

/** Fillable shipping columns — mirrors PO shipment detail fields. */
export const MASS_SHIPPING_HEADERS = [
  'Contract number',
  'Item',
  'Fruit',
  'Quantity',
  'Unit',
  'Contract price / case',
  'Total value',
  'Buyer',
  'Delivery date',
  'Cold chain',
  'Min shelf life',
  'Size spec',
  'Vendor',
  'Assigned at',
  'ASN number',
  'Container',
  'Ship date',
  'ETA',
  'Original ETA',
  'Transport mode',
  'Carrier',
  'Vessel',
  'Voyage',
  'Origin',
  'Destination',
  'Incoterms',
  'Bill of lading',
  'Customs',
  'Temp range',
  'Quantity expected',
  'Quantity actual',
  'Amount',
] as const;

export type MassShippingRow = {
  rfqId: string;
  asnNumber: string;
  containerNumber: string;
  shipDate: string;
  eta: string;
  originalEta: string;
  transportMode: string;
  carrier: string;
  vessel: string;
  voyage: string;
  origin: string;
  destination: string;
  incoterms: string;
  billOfLading: string;
  customs: string;
  tempRange: string;
  qtyExpected: string;
  qtyActual: string;
  amount: string;
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
  'contract number': 'rfqId',
  contract: 'rfqId',
  'contract no': 'rfqId',
  'contract id': 'rfqId',
  cn: 'rfqId',
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
  'original eta': 'originalEta',
  'orig eta': 'originalEta',
  'transport mode': 'transportMode',
  transport: 'transportMode',
  mode: 'transportMode',
  carrier: 'carrier',
  vessel: 'vessel',
  'vessel name': 'vessel',
  voyage: 'voyage',
  'voyage number': 'voyage',
  origin: 'origin',
  destination: 'destination',
  incoterms: 'incoterms',
  incoterm: 'incoterms',
  'bill of lading': 'billOfLading',
  bol: 'billOfLading',
  bl: 'billOfLading',
  customs: 'customs',
  'customs status': 'customs',
  'temp range': 'tempRange',
  temperature: 'tempRange',
  'cold chain': 'tempRange',
  'quantity expected': 'qtyExpected',
  'qty expected': 'qtyExpected',
  'expected qty': 'qtyExpected',
  'quantity actual': 'qtyActual',
  'qty actual': 'qtyActual',
  'actual qty': 'qtyActual',
  amount: 'amount',
  value: 'amount',
};

function cell(
  line: string[],
  idx: Partial<Record<keyof MassShippingRow, number>>,
  key: keyof MassShippingRow
): string {
  return idx[key] != null ? line[idx[key]!]?.trim() ?? '' : '';
}

export function downloadMassShippingExcel(rfqs: FruitsRfq[]) {
  const rows = rfqs.map((r) => {
    const quote = getAwardedQuote(r);
    const expected = getRfqDropQty(r);
    const price = quote?.pricePerCase ?? r.unitPrice ?? 0;
    return [
      toContractNumber(r.id),
      r.item,
      r.fruitItem,
      String(expected),
      r.unit,
      quote ? quote.pricePerCase.toFixed(2) : '',
      quote ? quote.totalPrice.toFixed(2) : '',
      r.buyer,
      r.deliveryDate,
      r.specifications.tempRange,
      r.specifications.minShelfLife,
      r.specifications.sizeSpec,
      r.awardedVendor ?? '',
      r.awardedAt ?? '',
      '', // ASN
      '', // Container
      '', // Ship date
      '', // ETA
      '', // Original ETA
      'ocean',
      'Maersk Reefer',
      'MV Andes Fresh',
      'AF-118W',
      'Valparaíso, Chile',
      r.destination,
      'FOB Valparaíso',
      '', // BOL
      'Pending clearance',
      r.specifications.tempRange,
      String(expected),
      String(expected),
      (expected * price).toFixed(2),
    ];
  });
  downloadExcelCsv('contract-mass-shipping.xls', [...MASS_SHIPPING_HEADERS], rows);
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
    const rawId = line[idx.rfqId]?.trim();
    if (!rawId) continue;
    out.push({
      rfqId: fromContractNumber(rawId),
      asnNumber: cell(line, idx, 'asnNumber'),
      containerNumber: cell(line, idx, 'containerNumber'),
      shipDate: cell(line, idx, 'shipDate'),
      eta: cell(line, idx, 'eta'),
      originalEta: cell(line, idx, 'originalEta'),
      transportMode: cell(line, idx, 'transportMode'),
      carrier: cell(line, idx, 'carrier'),
      vessel: cell(line, idx, 'vessel'),
      voyage: cell(line, idx, 'voyage'),
      origin: cell(line, idx, 'origin'),
      destination: cell(line, idx, 'destination'),
      incoterms: cell(line, idx, 'incoterms'),
      billOfLading: cell(line, idx, 'billOfLading'),
      customs: cell(line, idx, 'customs'),
      tempRange: cell(line, idx, 'tempRange'),
      qtyExpected: cell(line, idx, 'qtyExpected'),
      qtyActual: cell(line, idx, 'qtyActual'),
      amount: cell(line, idx, 'amount'),
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
