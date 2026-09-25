import { describe, expect, it } from "vitest";

import {
  detectDocumentType,
  extractDocument,
  extractClaimDocuments,
  normalizeTreatmentType,
} from "../lib/document-extractor";

describe("document-extractor", () => {
  it("detects document types from filenames", () => {
    expect(detectDocumentType("prescription.jpg")).toBe("PRESCRIPTION");
    expect(detectDocumentType("hospital_bill.jpg")).toBe("HOSPITAL_BILL");
    expect(detectDocumentType("lab_report.jpg")).toBe("LAB_REPORT");
    expect(detectDocumentType("pharmacy_bill.jpg")).toBe("PHARMACY_BILL");
    expect(detectDocumentType("random.jpg")).toBe("UNKNOWN");
  });

  it("extracts structured fields from document text", () => {
    const result = extractDocument({
      filename: "hospital_bill.jpg",
      text: `
        Patient: Rajesh Kumar
        Employee ID: EMP001
        Date: 2024-06-15
        Hospital: Apollo Hospitals
        Diagnosis: General consultation
        Amount: Rs 1500
      `,
    });

    expect(result.documentType).toBe("HOSPITAL_BILL");
    expect(result.status).toBe("EXTRACTED");

    expect(result.fields.patientName?.value).toBe("Rajesh Kumar");
    expect(result.fields.employeeId?.value).toBe("EMP001");
    expect(result.fields.treatmentDate?.value).toBe("2024-06-15");
    expect(result.fields.hospitalName?.value).toBe("Apollo Hospitals");
    expect(result.fields.diagnosis?.value).toBe("General consultation");
    expect(result.fields.amount?.value).toBe(1500);
  });

  it("handles documents with no readable text", () => {
    const result = extractDocument({
      filename: "prescription.jpg",
      text: "",
    });

    expect(result.status).toBe("PARTIAL");
    expect(result.confidence).toBe(0.35);
    expect(result.messages[0]).toContain("No readable text");
  });

  it("normalizes treatment types", () => {
    expect(normalizeTreatmentType("consultation")).toBe("CONSULTATION");
    expect(normalizeTreatmentType("MRI scan")).toBe("DIAGNOSTIC");
    expect(normalizeTreatmentType("pharmacy medicine")).toBe("PHARMACY");
    expect(normalizeTreatmentType("root canal")).toBe("DENTAL");
    expect(normalizeTreatmentType("glasses")).toBe("VISION");
    expect(normalizeTreatmentType("Ayurveda")).toBe(
      "ALTERNATIVE_MEDICINE"
    );
    expect(normalizeTreatmentType("something unknown")).toBeUndefined();
  });

  it("builds a structured claim from multiple documents", () => {
    const result = extractClaimDocuments([
      {
        filename: "prescription.jpg",
        text: `
          Patient: Rajesh Kumar
          Employee ID: EMP001
          Date: 2024-06-15
          Diagnosis: General consultation
        `,
      },
      {
        filename: "hospital_bill.jpg",
        text: `
          Patient: Rajesh Kumar
          Employee ID: EMP001
          Date: 2024-06-15
          Hospital: Apollo Hospitals
          Amount: Rs 1500
        `,
      },
    ]);

    expect(result.success).toBe(true);
    expect(result.processingState).toBe("NORMAL");

    expect(result.claim.employeeId).toBe("EMP001");
    expect(result.claim.treatmentDate).toBe("2024-06-15");
    expect(result.claim.hospitalName).toBe("Apollo Hospitals");
    expect(result.claim.amount).toBe(1500);

    expect(result.documents).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.trace.length).toBeGreaterThan(0);
  });
});