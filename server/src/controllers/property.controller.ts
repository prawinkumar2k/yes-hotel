import { RequestHandler } from "express";
import { Property } from "../models/Property";
import { ChannelMapping } from "../models/ChannelMapping";

// ── PROPERTY CRUD ──────────────────────────────────────────────────────────

export const getProperties: RequestHandler = async (_req, res) => {
  try {
    const properties = await Property.find().sort({ isHeadOffice: -1, name: 1 });
    res.json({ success: true, data: properties });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const createProperty: RequestHandler = async (req, res) => {
  try {
    const property = new Property(req.body);
    await property.save();
    res.status(201).json({ success: true, data: property });
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message });
  }
};

export const updateProperty: RequestHandler = async (req, res) => {
  try {
    const property = await Property.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!property) return res.status(404).json({ success: false, message: "Property not found" });
    res.json({ success: true, data: property });
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message });
  }
};

export const togglePropertyActive: RequestHandler = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ success: false, message: "Property not found" });
    property.isActive = !property.isActive;
    await property.save();
    res.json({ success: true, data: property });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── CHANNEL MAPPINGS ────────────────────────────────────────────────────────

export const getChannelMappings: RequestHandler = async (req, res) => {
  try {
    const { propertyId } = req.query;
    const filter: any = {};
    if (propertyId) filter.propertyId = propertyId;

    const mappings = await ChannelMapping.find(filter)
      .populate("roomCategoryId", "name")
      .populate("propertyId", "name code")
      .sort({ channel: 1 });

    res.json({ success: true, data: mappings });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const upsertChannelMapping: RequestHandler = async (req, res) => {
  try {
    const { propertyId, roomCategoryId, channel } = req.body;
    const mapping = await ChannelMapping.findOneAndUpdate(
      { propertyId, roomCategoryId, channel },
      req.body,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ success: true, data: mapping });
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message });
  }
};

export const deleteChannelMapping: RequestHandler = async (req, res) => {
  try {
    await ChannelMapping.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Mapping deleted" });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/**
 * POST /api/channel/sync/:mappingId
 * Stub: In production this would call the OTA API to push rate/availability updates.
 * Currently simulates the sync and marks the mapping as SUCCESS.
 */
export const syncChannelMapping: RequestHandler = async (req, res) => {
  try {
    const mapping = await ChannelMapping.findById(req.params.id);
    if (!mapping) return res.status(404).json({ success: false, message: "Mapping not found" });

    // Stub: simulate a successful sync
    mapping.lastSyncedAt = new Date();
    mapping.lastSyncStatus = "SUCCESS";
    mapping.lastSyncError = undefined;
    await mapping.save();

    res.json({
      success: true,
      message: `Sync stub executed for channel ${mapping.channel}. In production, this would push rates/availability to the OTA API.`,
      data: mapping,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};
