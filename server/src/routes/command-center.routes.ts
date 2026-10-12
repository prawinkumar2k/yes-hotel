import { Router } from "express";
import { requirePropertyAccess } from "../middleware/propertyAuth";
import { requirePermission } from "../middleware/permissionAuth";
import express from "express";
import { getCommandCenterData } from "../controllers/commandCenter.controller";
import { protect } from "../middleware/auth.middleware";

const router = express.Router();

router.use(protect);
router.use(requirePermission("DASHBOARD.COMMAND_CENTER", "VIEW"));

router.get("/", getCommandCenterData);

export default router;
