import { Request, Response } from "express";
import { z } from "zod";
import { MaintenanceTicket, MaintenanceStatus, MaintenancePriority } from "../models/MaintenanceTicket";
import { Room, RoomStatus } from "../models/Room";
import { createAuditLog } from "../services/audit.service";
import { transitionRoomStatus } from "../services/room-state.service";

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

    const ticket = await MaintenanceTicket.create({
      room: data.roomId,
      issueTitle: data.issueTitle,
      description: data.description,
      priority: data.priority,
      status: MaintenanceStatus.OPEN,
      roomStatusBeforeTicket: roomBefore.status,
    });

    await transitionRoomStatus(data.roomId, RoomStatus.MAINTENANCE, {
      req,
      action: "room.maintenance_opened",
      metadata: { maintenanceTicketId: ticket._id.toString() },
    }).catch(() => undefined); // e.g. room already MAINTENANCE/OUT_OF_SERVICE — ticket is still recorded

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
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMaintenanceTicket = async (req: Request, res: Response) => {
  try {
    const data = updateTicketSchema.parse(req.body);

    const ticket = await MaintenanceTicket.findByIdAndUpdate(
      req.params.id,
      { ...data, ...(data.status === MaintenanceStatus.RESOLVED && { resolvedAt: new Date() }) },
      { new: true }
    ).populate("room", "roomNumber");

    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });

    // If resolved, restore the room to whatever it actually was before this
    // ticket forced it into MAINTENANCE — NOT unconditionally AVAILABLE.
    // Falls back to AVAILABLE only for legacy tickets predating this field.
    if (data.status === MaintenanceStatus.RESOLVED && ticket.room) {
      const restoreTo = ticket.roomStatusBeforeTicket ?? RoomStatus.AVAILABLE;
      await transitionRoomStatus((ticket.room as any)._id.toString(), restoreTo, {
        req,
        action: "room.maintenance_resolved",
        metadata: { maintenanceTicketId: ticket._id.toString() },
      }).catch(() => undefined); // room may have moved on to a different state since (e.g. OUT_OF_SERVICE)
    }

    await createAuditLog({
      req,
      action: "maintenance.ticket_updated",
      resourceType: "MaintenanceTicket",
      resourceId: ticket._id.toString(),
      metadata: { status: ticket.status, priority: ticket.priority, room: (ticket.room as any)?.roomNumber },
    });

    return res.status(200).json({ success: true, data: ticket });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0].message });
    return res.status(500).json({ success: false, message: error.message });
  }
};
