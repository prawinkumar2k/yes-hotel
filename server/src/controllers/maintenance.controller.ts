import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { MaintenanceTicket, MaintenanceStatus, MaintenancePriority } from "../models/MaintenanceTicket";
import { Room, RoomStatus } from "../models/Room";
import { createAuditLog } from "../services/audit.service";
import { transitionRoomStatus } from "../services/room-state.service";
import { assertTicketTransition, syncRoomSellStatusWithTickets, MaintenanceRuleError } from "../services/maintenance.service";

const createTicketSchema = z.object({
  roomId: z.string().min(1),
  issueTitle: z.string().min(1),
  description: z.string().optional(),
  priority: z.nativeEnum(MaintenancePriority).optional(),
});

const updateTicketSchema = z.object({
  status: z.nativeEnum(MaintenanceStatus).optional(),
  priority: z.nativeEnum(MaintenancePriority).optional(),
  assignedTo: z.string().optional(),
  description: z.string().optional(),
  closeReason: z.string().trim().optional(),
});

export const getMaintenanceTickets = async (req: Request, res: Response) => {
  try {
    const { status, priority } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const tickets = await MaintenanceTicket.find(filter)
      .populate("room", "roomNumber floor")
      .populate("assignedTo", "firstName lastName")
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: tickets });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createMaintenanceTicket = async (req: Request, res: Response) => {
  try {
    const data = createTicketSchema.parse(req.body);

    // Capture the room's status BEFORE forcing it to MAINTENANCE, so
    // resolving the ticket later can restore what it actually was — rather
    // than always guessing AVAILABLE, which would be wrong for a ticket
    // filed against a currently-OCCUPIED room (see the model comment).
    const roomBefore = await Room.findById(data.roomId);
    if (!roomBefore) return res.status(404).json({ success: false, message: "Room not found" });

    const propertyId =
      roomBefore.propertyId ||
      (req as any).propertyId ||
      (req.user as any)?.propertyId ||
      new mongoose.Types.ObjectId();

    const ticket = await MaintenanceTicket.create({
      propertyId,
      room: data.roomId,
      issueTitle: data.issueTitle,
      description: data.description,
      priority: data.priority,
      status: MaintenanceStatus.OPEN,
    });

    // A CRITICAL ticket takes the room out of order (not sellable) until resolved;
    // lower priorities are logged without taking the room off sale.
    await syncRoomSellStatusWithTickets(data.roomId, { req });

    await createAuditLog({
      req,
      action: "maintenance.ticket_created",
      resourceType: "MaintenanceTicket",
      resourceId: ticket._id.toString(),
      metadata: { issueTitle: ticket.issueTitle, priority: ticket.priority, roomId: data.roomId },
    });

    return res.status(201).json({ success: true, data: ticket });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message });
    if (error instanceof MaintenanceRuleError) return res.status(error.status).json({ success: false, message: error.message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMaintenanceTicket = async (req: Request, res: Response) => {
  try {
    const data = updateTicketSchema.parse(req.body);

    const existing = await MaintenanceTicket.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Ticket not found" });
    if (data.status) assertTicketTransition(existing.status, data.status);
    if (data.status === MaintenanceStatus.ASSIGNED && !(data.assignedTo || existing.assignedTo)) {
      throw new MaintenanceRuleError("Choose who the ticket is assigned to");
    }
    if (data.assignedTo && !mongoose.Types.ObjectId.isValid(data.assignedTo)) throw new MaintenanceRuleError("Invalid assignee");
    if (data.status === MaintenanceStatus.CLOSED && existing.status === MaintenanceStatus.OPEN && !(data.closeReason && data.closeReason.length >= 3)) {
      throw new MaintenanceRuleError("A reason is required to close a ticket that was never worked on");
    }

    const userRole = (req as any).user?.role || "";
    const userId = (req as any).user?._id;
    const { PermissionService } = await import("../services/PermissionService");
    const isCompleting = data.status === MaintenanceStatus.RESOLVED || data.status === MaintenanceStatus.CLOSED;
    const isCriticalOrHigh = existing.priority === MaintenancePriority.CRITICAL || existing.priority === MaintenancePriority.HIGH;
    // CRITICAL needs MANAGER or higher; HIGH can be approved by SUPERVISOR or higher.
    const approveCap = existing.priority === MaintenancePriority.CRITICAL ? "CAP.APPROVE_CRITICAL" : "CAP.APPROVE_HIGH";
    const canApproveCompletion = await PermissionService.can((req as any).user, approveCap);

    if (isCompleting && isCriticalOrHigh && !canApproveCompletion) {
      return res.status(403).json({
        success: false,
        message: existing.priority === MaintenancePriority.CRITICAL
          ? "Completing a CRITICAL ticket requires MANAGER (or higher) approval."
          : "Completing a HIGH-priority ticket requires SUPERVISOR (or higher) approval.",
      });
    }

    const approvalData: any = {};
    if (isCompleting && isCriticalOrHigh && canApproveCompletion) {
      approvalData.approvedBy = userId;
      approvalData.approvedAt = new Date();
    }

    const { closeReason, ...fields } = data;
    const ticket = await MaintenanceTicket.findByIdAndUpdate(
      req.params.id,
      {
        ...fields,
        ...(closeReason ? { description: [existing.description, `Closed: ${closeReason}`].filter(Boolean).join("\n") } : {}),
        ...approvalData,
        ...(data.status === MaintenanceStatus.RESOLVED && { resolvedAt: new Date() }),
      },
      { returnDocument: "after" }
    ).populate("room", "roomNumber").populate("approvedBy", "firstName lastName role");

    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });

    const roomId = ticket.room ? String((ticket.room as any)._id ?? ticket.room) : undefined;
    // Legacy tickets (before this rule) forced the room into MAINTENANCE; resolving restores it.
    if (roomId && ticket.roomStatusBeforeTicket && (data.status === MaintenanceStatus.RESOLVED || data.status === MaintenanceStatus.CLOSED)) {
      const room = await Room.findById(roomId).select("status").lean();
      if (room?.status === RoomStatus.MAINTENANCE) {
        await transitionRoomStatus(roomId, ticket.roomStatusBeforeTicket, {
          req,
          action: "room.maintenance_resolved",
          metadata: { maintenanceTicketId: ticket._id.toString() },
        }).catch(() => undefined);
      }
    }
    // Status or priority changes can open or release the out-of-order hold.
    if (roomId && (data.status || data.priority)) await syncRoomSellStatusWithTickets(roomId, { req });

    await createAuditLog({
      req,
      action: "maintenance.ticket_updated",
      resourceType: "MaintenanceTicket",
      resourceId: ticket._id.toString(),
      metadata: { before: { status: existing.status, priority: existing.priority }, status: ticket.status, priority: ticket.priority, room: (ticket.room as any)?.roomNumber, approvedBy: userId, closeReason },
    });

    return res.status(200).json({ success: true, data: ticket });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message });
    if (error instanceof MaintenanceRuleError) return res.status(error.status).json({ success: false, message: error.message });
    return res.status(500).json({ success: false, message: error.message });
  }
};
