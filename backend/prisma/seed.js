// Seeds the fvclaims schema with the baseline data the FreshGuard UI expects.
// Run with: npx prisma db seed   (or: node prisma/seed.js)
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const vendors = [
  { id: 'USR-001', organizationName: 'Sarah M.', role: 'BUYER' },
  { id: 'USR-002', organizationName: 'Global Farms Suppliers', role: 'VENDOR' },
  { id: 'USR-003', organizationName: 'AgriGro Wholesale', role: 'VENDOR' },
  { id: 'USR-004', organizationName: 'FreshPack Co.', role: 'VENDOR' },
  { id: 'USR-005', organizationName: 'Valley Green Produce', role: 'VENDOR' },
  { id: 'USR-006', organizationName: 'Sunrise Dairy Co.', role: 'VENDOR' },
  { id: 'USR-007', organizationName: 'PureLand Creamery', role: 'VENDOR' },
  { id: 'USR-008', organizationName: 'Midwest Dairy Group', role: 'VENDOR' },
  { id: 'USR-009', organizationName: 'Valley Meats Inc.', role: 'VENDOR' },
  { id: 'USR-010', organizationName: 'Ocean Catch Logistics', role: 'VENDOR' },
  { id: 'USR-011', organizationName: 'Plains Beef & Co.', role: 'VENDOR' },
  { id: 'USR-012', organizationName: 'Northwest Organic Growers', role: 'VENDOR' },
  { id: 'USR-013', organizationName: 'Emerald Valley Produce', role: 'VENDOR' },
];

const requirements = [
  { id: 'REQ-2026-001', itemName: 'Fresh Produce', targetVolume: 5000 },
  { id: 'REQ-2026-002', itemName: 'Fresh Produce', targetVolume: 8000 },
  { id: 'REQ-2026-003', itemName: 'Dairy', targetVolume: 3500 },
];

// [vendorId, casePricing, aiQualificationScore (freshness), postHarvestAgeHours]
const bidsForReq1 = [
  ['USR-002', 24.5, 98, 12],
  ['USR-003', 22.8, 88, 36],
  ['USR-004', 25.0, 95, 18],
  ['USR-005', 22.5, 91, 24],
  ['USR-006', 18.0, 89, 30],
  ['USR-007', 19.5, 94, 28],
  ['USR-008', 17.0, 85, 42],
  ['USR-011', 26.2, 96, 14],
  ['USR-012', 23.8, 93, 19],
  ['USR-013', 21.5, 90, 26],
  ['USR-009', 25.5, 92, 15],
  ['USR-010', 24.0, 97, 10],
];

async function main() {
  for (const v of vendors) {
    await prisma.vendor.upsert({ where: { id: v.id }, update: v, create: v });
  }
  console.log(`Seeded ${vendors.length} vendors/buyers.`);

  for (const r of requirements) {
    await prisma.purchaseRequirement.upsert({ where: { id: r.id }, update: r, create: r });
  }
  console.log(`Seeded ${requirements.length} purchase requirements.`);

  for (const [vendorId, casePricing, score, ageHours] of bidsForReq1) {
    await prisma.vendorBid.upsert({
      where: { requirementId_vendorId: { requirementId: 'REQ-2026-001', vendorId } },
      update: {},
      create: {
        requirementId: 'REQ-2026-001',
        vendorId,
        casePricing,
        aiQualificationScore: score,
        maxVolumeAvailable: 6000,
        postHarvestAgeHours: ageHours,
      },
    });
  }
  console.log(`Seeded ${bidsForReq1.length} vendor bids for REQ-2026-001.`);

  // A baseline SLA + PO so QC endpoints have a valid FK target out of the box
  await prisma.slaAgreement.upsert({
    where: { id: 'SLA-2026-BASE' },
    update: {},
    create: {
      id: 'SLA-2026-BASE',
      requirementId: 'REQ-2026-001',
      volumeCommitmentValue: 5000,
      contractStartDate: new Date(),
      contractEndDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.purchaseOrder.upsert({
    where: { id: 'PO-2026-A101' },
    update: {},
    create: {
      id: 'PO-2026-A101',
      slaId: 'SLA-2026-BASE',
      vendorId: 'USR-002',
      cargoDescription: 'Organic Hass Avocados (Class A) — baseline release batch',
      totalAmount: 24500.0,
      allocationPercentage: 100,
      allocatedQuantity: 1000,
      containerId: 'CNT-GLOBA-1100',
      iotBeaconId: 'IOT-BCN-20500',
      adjustedEta: '28 Hours',
      fulfillmentStatus: 'delivering',
    },
  });
  console.log('Seeded baseline SLA-2026-BASE and PO-2026-A101.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
