import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  getProperties, createProperty, updateProperty, togglePropertyActive,
  getChannelMappings, upsertChannelMapping, deleteChannelMapping, syncChannelMapping,
} from "../controllers/property.controller";

const router = Router();
router.use(protect);

// Properties
router.get("/", getProperties);
router.post("/", authorize("ADMIN"), createProperty);
router.patch("/:id", authorize("ADMIN", "MANAGER"), updateProperty);
router.patch("/:id/toggle-active", authorize("ADMIN"), togglePropertyActive);

// Channel Mappings
router.get("/channels", getChannelMappings);
router.post("/channels", authorize("ADMIN", "MANAGER"), upsertChannelMapping);
router.delete("/channels/:id", authorize("ADMIN"), deleteChannelMapping);
router.post("/channels/:id/sync", authorize("ADMIN", "MANAGER"), syncChannelMapping);

export default router;
