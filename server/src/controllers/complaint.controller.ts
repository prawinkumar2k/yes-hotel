import { RequestHandler } from "express";
import { Complaint } from "../models/Complaint";

export const getComplaints: RequestHandler = async (req, res) => {
  try {
    const filters: any = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.department) filters.department = req.query.department;
    if (req.query.priority) filters.priority = req.query.priority;

    const complaints = await Complaint.find(filters)
      .populate("guestId", "fullName email phone")
      .sort({ createdAt: -1 });

    res.json(complaints);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch complaints" });
  }
};

export const createComplaint: RequestHandler = async (req, res) => {
  try {
    const { priority } = req.body;
    let slaHours = 24; // LOW
    if (priority === "MEDIUM") slaHours = 4;
    else if (priority === "HIGH") slaHours = 2;
    else if (priority === "URGENT") slaHours = 0.5;

    const slaBreachTime = new Date(Date.now() + slaHours * 60 * 60 * 1000);

    const complaint = new Complaint({
      ...req.body,
      slaBreachTime,
    });
    await complaint.save();
    res.status(201).json(complaint);
  } catch (error) {
    res.status(400).json({ message: "Failed to create complaint" });
  }
};

export const updateComplaintStatus: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionNotes } = req.body;
    const updateData: any = { status };
    if (resolutionNotes) updateData.resolutionNotes = resolutionNotes;
    if (status === "RESOLVED" || status === "CLOSED") {
      updateData.resolvedAt = new Date();
    }

    const complaint = await Complaint.findByIdAndUpdate(id, updateData, { new: true });
    if (!complaint) return res.status(404).json({ message: "Complaint not found" });

    res.json(complaint);
  } catch (error) {
    res.status(400).json({ message: "Failed to update complaint" });
  }
};
