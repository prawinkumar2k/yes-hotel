import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  getProperties, createProperty, updateProperty, togglePropertyActive,
  getChannelMappings, upsertChannelMapping, deleteChannelMapping, syncChannelMapping,
} from "../controllers/property.controller";

const router = Router();
router.use(protect);

// Properties
router.get("/", getProperties);
router.post("/", requirePermission("MULTI_PROPERTY", "CREATE"), createProperty);
router.patch("/:id", requirePermission("MULTI_PROPERTY", "EDIT"), updateProperty);
router.patch("/:id/toggle-active", requirePermission("MULTI_PROPERTY", "EDIT"), togglePropertyActive);

// Channel Mappings
router.get("/channels", getChannelMappings);
router.post("/channels", requirePermission("MULTI_PROPERTY", "CREATE"), upsertChannelMapping);
router.delete("/channels/:id", requirePermission("MULTI_PROPERTY", "DELETE"), deleteChannelMapping);
router.post("/channels/:id/sync", requirePermission("MULTI_PROPERTY", "CREATE"), syncChannelMapping);

export default router;
