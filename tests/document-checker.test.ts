import { describe, expect, it } from "vitest";

import {
  requiredDocuments,
  verifyDocuments,
} from "../lib/document-checker";

describe("document-checker", () => {
  it("returns the correct required documents for consultation", () => {
    expect(
      requiredDocuments("CONSULTATION")
    ).toEqual([
      "PRESCRIPTION",
      "HOSPITAL_BILL",
    ]);
  });

  it("returns the correct required documents for diagnostic claims", () => {
    expect(
      requiredDocuments("DIAGNOSTIC")
    ).toEqual([
      "PRESCRIPTION",
      "LAB_REPORT",
      "HOSPITAL_BILL",
    ]);
  });

  it("accepts valid consultation documents", () => {
    const result = verifyDocuments({
      treatmentType: "CONSULTATION",
      filenames: [
        "prescription.jpg",
        "hospital_bill.jpg",
      ],
      unreadableFiles: [],
      patientNames: [
        "Rajesh Kumar",
        "Rajesh Kumar",
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.detected).toHaveLength(2);
  });

  it("blocks duplicate/wrong documents", () => {
    const result = verifyDocuments({
      treatmentType: "CONSULTATION",
      filenames: [
        "prescription_1.jpg",
        "prescription_2.jpg",
      ],
      unreadableFiles: [],
      patientNames: [
        "Rajesh Kumar",
        "Rajesh Kumar",
      ],
    });

    expect(result.ok).toBe(false);

    expect(result.message).toContain(
      "PRESCRIPTION"
    );
  });

  it("blocks an unreadable document", () => {
    const result = verifyDocuments({
      treatmentType: "PHARMACY",
      filenames: [
        "prescription.jpg",
        "pharmacy_bill_blurry.jpg",
      ],
      unreadableFiles: [
        "pharmacy_bill_blurry.jpg",
      ],
      patientNames: [
        "Sneha Reddy",
        "Sneha Reddy",
      ],
    });

    expect(result.ok).toBe(false);

    expect(result.message.toLowerCase()).toContain(
      "unreadable"
    );
  });

  it("blocks documents belonging to different patients", () => {
    const result = verifyDocuments({
      treatmentType: "CONSULTATION",
      filenames: [
        "prescription.jpg",
        "hospital_bill.jpg",
      ],
      unreadableFiles: [],
      patientNames: [
        "Rajesh Kumar",
        "Arjun Mehta",
      ],
    });

    expect(result.ok).toBe(false);

    expect(result.message.toLowerCase()).toContain(
      "patient"
    );
  });
});