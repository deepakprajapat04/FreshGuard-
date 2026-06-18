// freshguard-backend/storage-api.js
// Permanent-storage REST APIs for everything the UI creates:
// requirements, vendor bids/quotations, contracts, purchase orders,
// negotiation chat threads, and claims.

async function upsertVendorByName(prisma, vendorName, role = 'VENDOR') {
  const existing = await prisma.vendor.findUnique({ where: { organizationName: vendorName } });
  if (existing) return existing;
  const count = await prisma.vendor.count();
  return prisma.vendor.create({
    data: {
      id: `USR-${String(count + 1).padStart(3, '0')}`,
      organizationName: vendorName,
      role,
    },
  });
}

async function ensureRequirement(prisma, requirementId, fallback = {}) {
  return prisma.purchaseRequirement.upsert({
    where: { id: requirementId },
    update: {},
    create: {
      id: requirementId,
      itemName: fallback.itemName || 'Unspecified Item',
      category: fallback.category || null,
      targetVolume: fallback.quantity || 1000,
      volumeUnit: fallback.unit || 'Cases',
    },
  });
}

function registerStorageRoutes(app, prisma) {
  // -------------------------------------------------------------------------
  // REQUIREMENTS (sourcing requisitions)
  // -------------------------------------------------------------------------
  app.get('/api/requirements', async (req, res) => {
    try {
      const rows = await prisma.purchaseRequirement.findMany({
        include: { vendorBids: { include: { vendor: true } } },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, requirements: rows });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/requirements', async (req, res) => {
    try {
      const { id, itemName, category, quantity, unit, status, details } = req.body || {};
      if (!itemName) return res.status(400).json({ success: false, error: 'Missing itemName.' });

      // Generate a sequential REQ id when the client doesn't supply one
      let reqId = id;
      if (!reqId) {
        const count = await prisma.purchaseRequirement.count();
        reqId = `REQ-2026-${String(count + 1).padStart(3, '0')}`;
      }

      const row = await prisma.purchaseRequirement.upsert({
        where: { id: reqId },
        update: {
          itemName,
          category: category || null,
          targetVolume: quantity || 1000,
          volumeUnit: unit || 'Cases',
          operationalStatus: status || 'OPEN',
          detailsPayload: details || undefined,
        },
        create: {
          id: reqId,
          itemName,
          category: category || null,
          targetVolume: quantity || 1000,
          volumeUnit: unit || 'Cases',
          operationalStatus: status || 'OPEN',
          detailsPayload: details || undefined,
        },
      });
      res.status(201).json({ success: true, requirement: row });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Update lifecycle status (open -> review -> awarded)
  app.patch('/api/requirements/:id', async (req, res) => {
    try {
      const { status, details } = req.body || {};
      const row = await prisma.purchaseRequirement.update({
        where: { id: req.params.id },
        data: {
          ...(status ? { operationalStatus: status } : {}),
          ...(details ? { detailsPayload: details } : {}),
        },
      });
      res.json({ success: true, requirement: row });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // VENDOR BIDS / QUOTATIONS
  // -------------------------------------------------------------------------
  app.get('/api/bids/:requirementId', async (req, res) => {
    try {
      const rows = await prisma.vendorBid.findMany({
        where: { requirementId: req.params.requirementId },
        include: { vendor: true },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, bids: rows });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/bids', async (req, res) => {
    try {
      const { requirementId, vendorName, casePricing, qualityScore, quantityAvailable, details } = req.body || {};
      if (!requirementId || !vendorName || !casePricing) {
        return res.status(400).json({ success: false, error: 'Missing requirementId, vendorName or casePricing.' });
      }

      await ensureRequirement(prisma, requirementId, details || {});
      const vendor = await upsertVendorByName(prisma, vendorName);

      const bid = await prisma.vendorBid.upsert({
        where: { requirementId_vendorId: { requirementId, vendorId: vendor.id } },
        update: {
          casePricing: Number(casePricing),
          aiQualificationScore: Number(qualityScore) || 90,
          maxVolumeAvailable: Number(quantityAvailable) || 1000,
          quoteDetails: details || undefined,
        },
        create: {
          requirementId,
          vendorId: vendor.id,
          casePricing: Number(casePricing),
          aiQualificationScore: Number(qualityScore) || 90,
          maxVolumeAvailable: Number(quantityAvailable) || 1000,
          quoteDetails: details || undefined,
        },
      });
      res.status(201).json({ success: true, bid });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // CONTRACTS (SLA agreements / awarded deals)
  // -------------------------------------------------------------------------
  app.get('/api/contracts', async (req, res) => {
    try {
      const rows = await prisma.slaAgreement.findMany({
        include: { requirement: true, purchaseOrders: { include: { vendor: true } } },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, contracts: rows });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/contracts', async (req, res) => {
    try {
      const { id, requirementId, totalValue, months, details } = req.body || {};
      if (!id) return res.status(400).json({ success: false, error: 'Missing contract id.' });

      if (requirementId) await ensureRequirement(prisma, requirementId, details || {});

      const monthsNum = Number(months) || 3;
      const contract = await prisma.slaAgreement.upsert({
        where: { id },
        update: { operationalStatus: 'ACTIVE' },
        create: {
          id,
          requirementId: requirementId || null,
          volumeCommitmentValue: Number(totalValue) || 0,
          contractStartDate: new Date(),
          contractEndDate: new Date(Date.now() + monthsNum * 30 * 24 * 60 * 60 * 1000),
          totalContractMonths: monthsNum,
        },
      });
      res.status(201).json({ success: true, contract });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // PURCHASE ORDERS
  // -------------------------------------------------------------------------
  app.get('/api/orders', async (req, res) => {
    try {
      const rows = await prisma.purchaseOrder.findMany({
        include: { vendor: true, sla: true },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, orders: rows });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/orders', async (req, res) => {
    try {
      const { po, slaId, requirementId, vendorName, item, amount, quantity, status } = req.body || {};
      if (!po || !slaId) return res.status(400).json({ success: false, error: 'Missing po or slaId.' });

      // The SLA must exist (it is the FK parent); create a shell if needed
      await prisma.slaAgreement.upsert({
        where: { id: slaId },
        update: {},
        create: {
          id: slaId,
          requirementId: requirementId || null,
          volumeCommitmentValue: Number(amount) || 0,
          contractStartDate: new Date(),
          contractEndDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      });

      const vendor = vendorName ? await upsertVendorByName(prisma, vendorName) : null;

      const order = await prisma.purchaseOrder.upsert({
        where: { id: po },
        update: { fulfillmentStatus: status || 'packing' },
        create: {
          id: po,
          slaId,
          vendorId: vendor?.id || null,
          cargoDescription: item || 'Purchase order cargo',
          totalAmount: Number(amount) || 0,
          allocatedQuantity: Number(quantity) || 0,
          fulfillmentStatus: status || 'packing',
        },
      });
      res.status(201).json({ success: true, order });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // NEGOTIATION CHAT THREADS
  // -------------------------------------------------------------------------
  app.get('/api/negotiations/:requirementId', async (req, res) => {
    try {
      const rows = await prisma.negotiationMessage.findMany({
        where: { requirementId: req.params.requirementId },
        orderBy: { createdAt: 'asc' },
      });
      res.json({ success: true, messages: rows });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/negotiations', async (req, res) => {
    try {
      const { requirementId, sender, avatar, text, isSelf, senderRole } = req.body || {};
      if (!requirementId || !text) {
        return res.status(400).json({ success: false, error: 'Missing requirementId or text.' });
      }
      const message = await prisma.negotiationMessage.create({
        data: {
          requirementId,
          sender: sender || 'Anonymous',
          avatar: avatar || null,
          text,
          isSelf: Boolean(isSelf),
          senderRole: senderRole || 'BUYER',
        },
      });
      res.status(201).json({ success: true, message });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // CLAIMS / DISPUTES
  // -------------------------------------------------------------------------
  app.get('/api/claims', async (req, res) => {
    try {
      const rows = await prisma.vendorClaimsDispute.findMany({
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, claims: rows });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/claims', async (req, res) => {
    try {
      const { po, vendor, issue, amount, damagedQuantity, comments, evidence, details } = req.body || {};
      if (!po || !amount) return res.status(400).json({ success: false, error: 'Missing po or amount.' });

      const claim = await prisma.vendorClaimsDispute.create({
        data: {
          purchaseOrderRef: po,
          damagedSkuName: issue || 'Quality Breach',
          calculatedLossAmount: Number(amount),
          evidenceValidationCode: evidence || `MANUAL-${Date.now().toString(36).toUpperCase()}`,
          buyerComments: comments || null,
          claimPayload: { vendor, damagedQuantity, ...(details || {}) },
        },
      });
      res.status(201).json({ success: true, claim });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // QC INSPECTIONS (read)
  // -------------------------------------------------------------------------
  app.get('/api/inspections', async (req, res) => {
    try {
      const rows = await prisma.aiQcInspection.findMany({
        include: { batchSplitRoutings: true, vendorClaimsDisputes: true },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, inspections: rows });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
}

module.exports = { registerStorageRoutes };
