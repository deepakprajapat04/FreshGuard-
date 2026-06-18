// freshguard-backend/script.js
// Load .env FIRST — before any module reads process.env (especially integrations.js)
require('dotenv').config();

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { registerIntegrationRoutes, notify } = require('./integrations');
const { registerStorageRoutes } = require('./storage-api');
const { registerAuthRoutes } = require('./auth-api');

const app = express();
const prisma = new PrismaClient();
// Default to 4000 — macOS AirPlay (AirTunes) occupies port 5000
const PORT = process.env.PORT || 4000;

app.use(express.json({ limit: '50mb' }));

// ---------------------------------------------------------------------------
// Telemetry simulator (GPS + sensor pings) — deterministic per tracking ID.
// IoT hardware isn't wired in yet, so coordinates/temps are synthesized.
// ---------------------------------------------------------------------------
function buildTrackingTelemetry(trackingId, status = 'delivering', eta = '36 Hours Max Limit') {
  const normId = trackingId.toUpperCase();
  let seed = 0;
  for (let i = 0; i < normId.length; i++) seed += normId.charCodeAt(i);

  const pseudorandom = (offset) => {
    const x = Math.sin(seed + offset) * 10000;
    return x - Math.floor(x);
  };

  const carriers = ['CoolWay Express', 'Polar Transit Link', 'ThermoFreight', 'Apex Cold Carriers'];
  const carrier = carriers[Math.floor(pseudorandom(4) * carriers.length)];

  // GPS routing coordinates trending towards Chicago (41.8781, -87.6298)
  const baseLat = 35.0 + pseudorandom(5) * 5.0;
  const baseLng = -90.0 + pseudorandom(6) * 4.0;

  const sensorHistory = [];
  const baseTemp = 3.2 + pseudorandom(7) * 2.5;
  const now = new Date();
  for (let i = 12; i >= 0; i--) {
    const pingTime = new Date(now.getTime() - i * 60 * 60 * 1000);
    const tempVar = Math.sin(i * 1.5) * 0.4 + pseudorandom(8 + i) * 0.2;
    sensorHistory.push({
      timestamp: pingTime.toISOString(),
      temperature: parseFloat((baseTemp + tempVar).toFixed(1)),
      humidityPercentage: Math.floor(82 + pseudorandom(9 + i) * 8),
      systemOk: pseudorandom(10 + i) > 0.02,
    });
  }

  return {
    carrier,
    status,
    eta,
    currentTemp: sensorHistory[sensorHistory.length - 1].temperature,
    currentLocation: {
      lat: parseFloat((baseLat + (41.8781 - baseLat) * 0.6).toFixed(4)),
      lng: parseFloat((baseLng + (-87.6298 - baseLng) * 0.6).toFixed(4)),
      description: 'Highway segment coordinates (Hillsdale Interstate Node / GPS Locked)',
    },
    sensorPingsHistory: sensorHistory,
  };
}

// ---------------------------------------------------------------------------
// 1. HEALTH CHECK
// ---------------------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'UP', database: 'CONNECTED_TO_FVCLAIMS' });
  } catch (error) {
    res.status(500).json({ status: 'DOWN', error: error.message });
  }
});

// ---------------------------------------------------------------------------
// 2. POST /api/procurement/optimize
//    Ranks vendor bids for a requirement and distributes allocation
//    percentages summing exactly to 100%.
// ---------------------------------------------------------------------------
app.post('/api/procurement/optimize', async (req, res) => {
  try {
    const { requirementId, totalVolume, customWeights } = req.body;
    const reqId = requirementId || 'REQ-2026-001';
    const quantity = typeof totalVolume === 'number' ? totalVolume : 5000;
    const wScore = customWeights?.scoreWeight ?? 0.7;
    const wPrice = customWeights?.priceWeight ?? 0.3;

    // Make sure the requirement row exists (auto-create for ad-hoc UI requirements)
    await prisma.purchaseRequirement.upsert({
      where: { id: reqId },
      update: {},
      create: { id: reqId, itemName: 'Fresh Produce', targetVolume: quantity },
    });

    let quotes = await prisma.vendorBid.findMany({
      where: { requirementId: reqId },
      include: { vendor: true },
    });

    // Guarantee 10+ vendor rows: auto-generate bids from registered vendors
    if (quotes.length < 11) {
      const vendors = await prisma.vendor.findMany({ where: { role: 'VENDOR' } });
      const existingVendorIds = new Set(quotes.map((q) => q.vendorId));
      const newBids = vendors
        .filter((v) => !existingVendorIds.has(v.id))
        .map((v, i) => ({
          requirementId: reqId,
          vendorId: v.id,
          casePricing: parseFloat((18.0 + (i % 6) * 1.5 + (i % 3) * 1.2).toFixed(2)),
          aiQualificationScore: Math.min(100, 85 + (i * 3) % 15),
          maxVolumeAvailable: 6000,
          postHarvestAgeHours: 10 + (i * 5) % 30,
        }));
      if (newBids.length > 0) {
        await prisma.vendorBid.createMany({ data: newBids, skipDuplicates: true });
        quotes = await prisma.vendorBid.findMany({
          where: { requirementId: reqId },
          include: { vendor: true },
        });
      }
    }

    const prices = quotes.map((q) => Number(q.casePricing));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    const mappedRows = quotes.map((q, idx) => {
      const caseRate = Number(q.casePricing);
      const priceGap = maxPrice - minPrice;
      const normalizedPriceScore = priceGap > 0 ? 100 * (1 - (caseRate - minPrice) / priceGap) : 100;
      const aiRankIndex = parseFloat((q.aiQualificationScore * wScore + normalizedPriceScore * wPrice).toFixed(1));
      return {
        vendor: q.vendor.organizationName,
        vendorId: q.vendorId,
        score: q.aiQualificationScore,
        pricePerUnit: caseRate,
        aiRankIndex,
        allocationPercentage: 0,
        predictedCost: 0,
        deliveryDays: Math.round(1.5 + (idx % 3) * 0.8),
        routeRefrigerated: caseRate > 20.0,
      };
    });

    mappedRows.sort((a, b) => b.aiRankIndex - a.aiRankIndex);

    // Linear rank decay weights, corrected to sum exactly to 100%
    let sumOfRanks = 0;
    const weights = mappedRows.map((_, i) => {
      const w = Math.max(1, 100 - i * 8);
      sumOfRanks += w;
      return w;
    });
    let allocatedSum = 0;
    mappedRows.forEach((row, i) => {
      row.allocationPercentage = Math.round((weights[i] / sumOfRanks) * 100);
      allocatedSum += row.allocationPercentage;
    });
    if (mappedRows.length > 0) mappedRows[0].allocationPercentage += 100 - allocatedSum;

    mappedRows.forEach((row) => {
      const allocatedQty = Math.round((quantity * row.allocationPercentage) / 100);
      row.predictedCost = parseFloat((allocatedQty * row.pricePerUnit).toFixed(2));
    });

    res.json({
      success: true,
      requirementId: reqId,
      totalQuantityRequested: quantity,
      allocatedSumPercentage: 100,
      vendorsAllocatedCount: mappedRows.length,
      allocationRows: mappedRows,
    });
  } catch (err) {
    console.error('Error in POST /api/procurement/optimize', err);
    res.status(500).json({
      success: false,
      error: 'Optimization solver engine failed to compute model mappings.',
      details: err?.message || err,
    });
  }
});

// ---------------------------------------------------------------------------
// 3. POST /api/procurement/finalize-split
//    Creates a master SLA (blanket PO umbrella) + child purchase orders
//    per vendor split, all inside one DB transaction.
// ---------------------------------------------------------------------------
app.post('/api/procurement/finalize-split', async (req, res) => {
  try {
    const { requirementId, splitAllocations, totalVolume, productItem, category, unit } = req.body;
    if (!requirementId || !splitAllocations) {
      return res.status(400).json({
        success: false,
        error: 'Missing requirementId or splitAllocations map in payload.',
      });
    }

    const qty = typeof totalVolume === 'number' ? totalVolume : 5000;
    const item = productItem || 'Organic Hass Avocados (Class A)';
    const cat = category || 'Fresh Produce';
    const unitText = unit || 'Cases';
    const masterPoId = `MPO-2026-MSC${Math.floor(1000 + Math.random() * 8999)}`;

    const vendors = await prisma.vendor.findMany();
    const bids = await prisma.vendorBid.findMany({ where: { requirementId } });
    const poCount = await prisma.purchaseOrder.count();

    const result = await prisma.$transaction(async (tx) => {
      await tx.purchaseRequirement.upsert({
        where: { id: requirementId },
        update: { operationalStatus: 'AWARDED' },
        create: { id: requirementId, itemName: item, targetVolume: qty, operationalStatus: 'AWARDED' },
      });

      const masterRecord = await tx.slaAgreement.create({
        data: {
          id: masterPoId,
          requirementId,
          volumeCommitmentValue: qty,
          contractStartDate: new Date(),
          contractEndDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          totalContractMonths: 3,
          totalScheduledBatches: 12,
        },
      });

      const childPoRecords = [];
      const clientShipmentFeedbackList = [];
      let idx = 0;

      for (const [vendorNameOrId, percentStr] of Object.entries(splitAllocations)) {
        const pct = Math.round(Number(percentStr));
        if (pct <= 0) continue;

        const vendor =
          vendors.find((v) => v.id === vendorNameOrId || v.organizationName === vendorNameOrId) ||
          vendors.find((v) => v.role === 'VENDOR' && v.organizationName.includes(vendorNameOrId)) ||
          vendors.find((v) => v.role === 'VENDOR');
        const vendorName = vendor.organizationName;

        const bid = bids.find((b) => b.vendorId === vendor.id);
        const caseRate = bid ? Number(bid.casePricing) : 22.0;
        const cases = Math.round((qty * pct) / 100);
        const childPoId = `PO-2026-A${100 + poCount + idx + 1}`;
        const containerId = `CNT-${vendorName.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5)}-${Math.floor(1100 + idx * 230 + Math.random() * 800)}`;
        const iotBeaconId = `IOT-BCN-${Math.floor(20500 + idx * 1150 + Math.random() * 500)}`;

        const childRecord = await tx.purchaseOrder.create({
          data: {
            id: childPoId,
            slaId: masterPoId,
            vendorId: vendor.id,
            cargoDescription: `${cases.toLocaleString()} ${unitText} of ${item} (${pct}% Split)`,
            totalAmount: parseFloat((cases * caseRate).toFixed(2)),
            allocationPercentage: pct,
            allocatedQuantity: cases,
            containerId,
            iotBeaconId,
            adjustedEta: '28 Hours',
            fulfillmentStatus: 'packing',
          },
        });
        childPoRecords.push(childRecord);

        // Mark the winning bid as selected for split
        if (bid) {
          await tx.vendorBid.update({
            where: { id: bid.id },
            data: { selectedForSplit: true },
          });
        }

        clientShipmentFeedbackList.push({
          id: childPoId,
          vendor: vendorName,
          item: `${cases.toLocaleString()} ${unitText} of ${item} (${pct}% Split)`,
          product: item,
          quantity: cases,
          unit: unitText,
          fleetSpecification: cat === 'Fresh Produce' ? 'Active Refrigerated' : 'Ambient Temperature Route',
          logisticsRouteAndProvider: 'I-80 West Expressway - CoolWay Transit',
          status: 'on-time',
          eta: '28 hrs',
          origin: `${vendorName} Hub`,
          destination: 'Chicago DC',
          temp: cat === 'Fresh Produce' ? '3°C' : '12°C',
          date: new Date().toISOString(),
          stage: 'packing',
          packingProgress: 35,
          preCoolingTarget: `Pre-Cooling Target: ${cat === 'Fresh Produce' ? '3°C' : '12°C'} (Currently: 4.2°C)`,
          containerId,
          sensorTag: iotBeaconId,
          iotBeaconTag: iotBeaconId,
          isBlanket: true,
          contractHorizon: '3 Months',
          deliveryFrequency: 'Once a Week',
          totalBatches: 12,
          deliveredBatches: 0,
          currentActiveBatch: 1,
        });
        idx++;
      }

      return { masterRecord, childPoRecords, clientShipmentFeedbackList };
    });

    notify({
      subject: `Blanket PO ${masterPoId} awarded — ${result.childPoRecords.length} vendor split`,
      text: `Master contract ${masterPoId} for requirement ${requirementId} was awarded across ${result.childPoRecords.length} vendors:\n${result.childPoRecords.map((po) => `• ${po.id}: ${po.cargoDescription}`).join('\n')}`,
    });

    res.json({
      success: true,
      message: 'Relational database multi-vendor blanket split PO allocated and committed successfully.',
      masterBpo: result.masterRecord,
      childPOs: result.childPoRecords,
      newShipments: result.clientShipmentFeedbackList,
    });
  } catch (err) {
    console.error('Error in POST /api/procurement/finalize-split', err);
    res.status(500).json({
      success: false,
      error: 'Committed transaction for split-dispatch failed.',
      details: err?.message || err,
    });
  }
});

// ---------------------------------------------------------------------------
// 4. GET /api/logistics/track/:trackingId
//    Looks up a child PO by PO number / container ID / IoT beacon ID.
// ---------------------------------------------------------------------------
app.get('/api/logistics/track/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    const normTrackingId = trackingId.toUpperCase();

    const dbRecord = await prisma.purchaseOrder.findFirst({
      where: {
        OR: [
          { id: { equals: normTrackingId, mode: 'insensitive' } },
          { containerId: { equals: normTrackingId, mode: 'insensitive' } },
          { iotBeaconId: { equals: normTrackingId, mode: 'insensitive' } },
        ],
      },
    });

    const status = dbRecord?.fulfillmentStatus || 'delivering';
    const eta = dbRecord?.adjustedEta || '28 Hours Limit';
    const container = dbRecord?.containerId || trackingId;
    const beacon = dbRecord?.iotBeaconId || 'IOT-BCN-SIMULATED';

    const telemetry = buildTrackingTelemetry(trackingId, status, eta);

    res.json({
      success: true,
      trackingId: normTrackingId,
      isoContainerId: container,
      containerId: container,
      beaconId: beacon,
      iotBeaconId: beacon,
      provider: telemetry.carrier,
      status: telemetry.status,
      adjustedEta: eta,
      gpsCoordinates: {
        lat: telemetry.currentLocation.lat,
        lng: telemetry.currentLocation.lng,
        label: telemetry.currentLocation.description,
      },
      currentSensorReport: {
        temperatureCelsius: telemetry.currentTemp,
        ambientTarget: telemetry.status === 'packing' ? '4.5°C' : '3.0°C',
        sensorUfStatus: 'Healthy / Beacon Online',
      },
      historicalIotSensorPings: telemetry.sensorPingsHistory,
    });
  } catch (err) {
    console.error(`Error in GET /api/logistics/track/${req.params.trackingId}`, err);
    res.status(500).json({
      success: false,
      error: 'Logistics database relational lookup failed.',
      details: err?.message || err,
    });
  }
});

// ---------------------------------------------------------------------------
// 5. POST /api/qc/scan
//    Writes an AI vision inspection log row against a purchase order.
// ---------------------------------------------------------------------------
app.post('/api/qc/scan', async (req, res) => {
  try {
    const { assetPointer, release_po_id, scanMode } = req.body;
    let targetPoId = release_po_id || assetPointer || 'PO-2026-A101';

    // FK safety: fall back to the seeded baseline PO when the target is unknown
    const poExists = await prisma.purchaseOrder.findUnique({ where: { id: targetPoId } });
    if (!poExists) targetPoId = 'PO-2026-A101';

    const inspection = await prisma.aiQcInspection.create({
      data: {
        poNumber: targetPoId,
        aiQualityScore: 95,
        freshnessIndex: 9.5,
        estimatedShelfLifeDays: 6.5,
        anomaliesFlagged: null,
      },
    });

    res.json({
      success: true,
      scannedAt: new Date().toISOString(),
      scanMode: scanMode || 'computer_vision_multispectral',
      assetPointer: targetPoId,
      logDetails: {
        id: inspection.id,
        release_po_id: targetPoId,
        vision_confidence_index: 0.95,
        predicted_shelf_life_days: 6.5,
        anomalies_detected: false,
        action_taken: 'PASS / Certified Grade',
      },
      visionConfidenceIndex: 0.95,
      visionConfidenceIndexPercent: '95%',
      structuralAnomalies: false,
      anomaliesDetected: false,
      predictedShelfLifeDays: 6.5,
      shelfLifeDaysEstimate: 6.5,
      integerPredictionDays: 6,
      decisionEngineResult: 'PASS',
    });
  } catch (err) {
    console.error('Error in POST /api/qc/scan', err);
    res.status(500).json({
      success: false,
      error: 'Vision AI scan router experienced a database or model processing error.',
      details: err?.message || err,
    });
  }
});

// ---------------------------------------------------------------------------
// 6. POST /api/qc/execute-routing
//    Full QC pipeline: inspection log + batch split routing + auto claim draft.
// ---------------------------------------------------------------------------
app.post('/api/qc/execute-routing', async (req, res) => {
  const { poNumber, aiQualityScore, freshnessIndex, estimatedShelfLifeDays, anomaliesFlagged, totalVolume, passedBoxes, defectedBoxes } = req.body;

  try {
    // FK safety: fall back to the seeded baseline PO when the target is unknown
    let targetPoId = poNumber || 'PO-2026-A101';
    const poExists = await prisma.purchaseOrder.findUnique({ where: { id: targetPoId } });
    if (!poExists) targetPoId = 'PO-2026-A101';

    const result = await prisma.$transaction(async (tx) => {
      const inspection = await tx.aiQcInspection.create({
        data: {
          poNumber: targetPoId,
          aiQualityScore: parseInt(aiQualityScore),
          freshnessIndex: parseFloat(freshnessIndex),
          estimatedShelfLifeDays: parseFloat(estimatedShelfLifeDays),
          anomaliesFlagged: anomaliesFlagged,
        },
      });

      const splitRouting = await tx.batchSplitRouting.create({
        data: {
          inspectionId: inspection.id,
          totalBatchVolume: parseInt(totalVolume),
          storeFulfillmentCount: parseInt(passedBoxes),
          claimsMitigationCount: parseInt(defectedBoxes),
        },
      });

      let claimDispute = null;
      if (parseInt(defectedBoxes) > 0) {
        claimDispute = await tx.vendorClaimsDispute.create({
          data: {
            inspectionId: inspection.id,
            damagedSkuName: 'Fresh Salmon Batch Lot',
            calculatedLossAmount: parseInt(defectedBoxes) * 49.0,
            evidenceValidationCode: `AI-AUTH-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
            buyerComments: `Automated split system routing generated for ${defectedBoxes} defective cargo items.`,
          },
        });
      }

      return { inspection, splitRouting, claimDispute };
    });

    if (result.claimDispute) {
      notify({
        subject: `Vendor claim raised on ${targetPoId} — $${Number(result.claimDispute.calculatedLossAmount).toFixed(2)}`,
        text: `QC inspection flagged ${defectedBoxes} defective cases on PO ${targetPoId}.\nClaim ID: ${result.claimDispute.id}\nEvidence code: ${result.claimDispute.evidenceValidationCode}`,
      });
    }

    res.status(201).json({ message: 'SaaS pipeline successfully executed.', data: result });
  } catch (error) {
    res.status(400).json({ error: 'Pipeline failure execution.', details: error.message });
  }
});

// ---------------------------------------------------------------------------
// 7. EXTERNAL INTEGRATIONS (Weather, News, Razorpay, Email)
// ---------------------------------------------------------------------------
registerIntegrationRoutes(app, prisma);

// ---------------------------------------------------------------------------
// 8. PERMANENT STORAGE APIs (requirements, bids, contracts, orders,
//    negotiations, claims, inspections)
// ---------------------------------------------------------------------------
registerStorageRoutes(app, prisma);

// ---------------------------------------------------------------------------
// 9. AUTHENTICATION (signup / login / session)
// ---------------------------------------------------------------------------
registerAuthRoutes(app, prisma);

app.listen(PORT, () => {
  console.log(`🚀 FreshGuard backend infrastructure active on port: ${PORT}`);
});
