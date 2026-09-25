import { describe, expect, it } from "vitest";

import {
  evaluateClaim,
  type ClaimInput,
} from "../lib/claim-decision";

function baseClaim(
  overrides: Partial<ClaimInput> = {}
): ClaimInput {
  return {
    employeeId: "EMP001",
    treatmentType: "CONSULTATION",
    amount: 1500,
    treatmentDate: "2024-06-15",
    diagnosis: "General consultation",
    hospitalName: "",
    hasPreAuth: false,
    sameDayClaimsBefore: 0,
    monthlyClaimsBefore: 0,
    ytdClaimsAmount: 0,
    ...overrides,
  };
}

describe("claim-decision", () => {
  it("approves a clean consultation claim", () => {
    const result = evaluateClaim(
      baseClaim()
    );

    expect(result.decision).toBe(
      "APPROVED"
    );

    expect(
      result.approvedAmount
    ).toBe(1350);
  });

  it("rejects a claim during the diabetes waiting period", () => {
    const result = evaluateClaim(
      baseClaim({
        employeeId: "EMP005",
        amount: 3000,
        treatmentDate: "2024-10-15",
        diagnosis: "Diabetes treatment",
      })
    );

    expect(result.decision).toBe(
      "REJECTED"
    );

    expect(
      result.approvedAmount
    ).toBe(0);

    expect(
      result.reason
    ).toContain("WAITING_PERIOD");
  });

  it("partially approves a dental claim with an excluded item", () => {
    const result = evaluateClaim(
      baseClaim({
        employeeId: "EMP002",
        treatmentType: "DENTAL",
        amount: 12000,
        treatmentDate: "2024-06-20",
        diagnosis: "Dental treatment",
        dentalItems: [
          {
            description: "Root Canal",
            amount: 8000,
          },
          {
            description: "Whitening",
            amount: 4000,
          },
        ],
      })
    );

    expect(result.decision).toBe(
      "PARTIAL"
    );

    expect(
      result.approvedAmount
    ).toBe(8000);
  });

  it("rejects an MRI claim without pre-authorization", () => {
    const result = evaluateClaim(
      baseClaim({
        employeeId: "EMP003",
        treatmentType: "DIAGNOSTIC",
        amount: 15000,
        treatmentDate: "2024-07-10",
        diagnosis: "MRI scan",
        hasPreAuth: false,
      })
    );

    expect(result.decision).toBe(
      "REJECTED"
    );

    expect(
      result.approvedAmount
    ).toBe(0);

    expect(
      result.reason
    ).toContain("PRE_AUTH_MISSING");
  });

  it("rejects a claim above the per-claim limit", () => {
    const result = evaluateClaim(
      baseClaim({
        amount: 7500,
      })
    );

    expect(result.decision).toBe(
      "REJECTED"
    );

    expect(
      result.approvedAmount
    ).toBe(0);

    expect(
      result.reason
    ).toContain("PER_CLAIM_EXCEEDED");
  });

  it("routes fraud-pattern claims to manual review", () => {
    const result = evaluateClaim(
      baseClaim({
        employeeId: "EMP008",
        amount: 1500,
        sameDayClaimsBefore: 3,
        monthlyClaimsBefore: 3,
      })
    );

    expect(result.decision).toBe(
      "MANUAL_REVIEW"
    );

    expect(
      result.approvedAmount
    ).toBe(0);

    expect(
      result.reason
    ).toContain("Manual review");
  });

  it("applies network discount before copay", () => {
    const result = evaluateClaim(
      baseClaim({
        amount: 4500,
        hospitalName: "Apollo Hospitals",
      })
    );

    expect(result.decision).toBe(
      "APPROVED"
    );

    expect(
      result.approvedAmount
    ).toBe(3240);
  });

  it("continues in degraded mode when a component fails", () => {
    const result = evaluateClaim(
      baseClaim({
        treatmentType:
          "ALTERNATIVE_MEDICINE",
        amount: 4000,
        treatmentDate: "2024-06-15",
        diagnosis:
          "Alternative medicine treatment",
        simulateComponentFailure: true,
      })
    );

    expect(result.decision).toBe(
      "APPROVED"
    );

    expect(
      result.approvedAmount
    ).toBe(4000);

    expect(
      result.processingState
    ).toBe("DEGRADED");

    expect(
      result.confidence
    ).toBeLessThan(0.8);
  });

  it("rejects an excluded obesity treatment", () => {
    const result = evaluateClaim(
      baseClaim({
        amount: 8000,
        treatmentDate: "2024-06-15",
        diagnosis:
          "Obesity treatment and weight loss program",
      })
    );

    expect(result.decision).toBe(
      "REJECTED"
    );

    expect(
      result.approvedAmount
    ).toBe(0);

    expect(
      result.reason
    ).toContain("EXCLUDED_CONDITION");
  });

  it("produces an explainable decision trace", () => {
    const result = evaluateClaim(
      baseClaim()
    );

    expect(
      result.trace.length
    ).toBeGreaterThan(0);

    expect(
      result.trace.some((item) =>
        item.includes("Member verified")
      )
    ).toBe(true);

    expect(
      result.trace.some((item) =>
        item.includes("Final approved amount")
      )
    ).toBe(true);
  });
});