"use client";

import { useState } from "react";

import {
  requiredDocuments,
  verifyDocuments,
  verifyClaimIdentity,
  type TreatmentType,
} from "../lib/document-checker";

import {
  extractClaimDocuments,
} from "../lib/document-extractor";

import {
  evaluateClaim,
  type ClaimInput,
  type DecisionResult,
} from "../lib/claim-decision";

type ExpectedResult = {
  decision?: DecisionResult["decision"];
  approvedAmount?: number;
  documentBlocked?: boolean;
};

type DemoCase = {
  id: string;
  title: string;
  employeeId: string;
  treatmentType: TreatmentType;
  amount: number;
  treatmentDate: string;
  diagnosis: string;
  hospitalName: string;
  hasPreAuth: boolean;
  files: string[];
  patientNames?: string[];
  unreadableFiles?: string[];
  sameDayClaimsBefore?: number;
  monthlyClaimsBefore?: number;
  ytdClaimsAmount?: number;
  simulateComponentFailure?: boolean;
  dentalItems?: {
    description: string;
    amount: number;
  }[];
  expected: ExpectedResult;
};

const demoCases: DemoCase[] = [
  {
    id: "TC001",
    title: "Wrong Document Uploaded",
    employeeId: "EMP001",
    treatmentType: "CONSULTATION",
    amount: 1500,
    treatmentDate: "2024-06-15",
    diagnosis: "General consultation",
    hospitalName: "",
    hasPreAuth: false,
    files: ["prescription_1.jpg", "prescription_2.jpg"],
    patientNames: ["Rajesh Kumar", "Rajesh Kumar"],
    expected: {
      documentBlocked: true,
    },
  },

  {
    id: "TC002",
    title: "Unreadable Document",
    employeeId: "EMP004",
    treatmentType: "PHARMACY",
    amount: 800,
    treatmentDate: "2024-07-15",
    diagnosis: "Medication purchase",
    hospitalName: "",
    hasPreAuth: false,
    files: ["prescription.jpg", "pharmacy_bill_blurry.jpg"],
    unreadableFiles: ["pharmacy_bill_blurry.jpg"],
    patientNames: ["Sneha Reddy", "Sneha Reddy"],
    expected: {
      documentBlocked: true,
    },
  },

  {
    id: "TC003",
    title: "Documents Different Patients",
    employeeId: "EMP001",
    treatmentType: "CONSULTATION",
    amount: 1500,
    treatmentDate: "2024-06-15",
    diagnosis: "General consultation",
    hospitalName: "",
    hasPreAuth: false,
    files: ["prescription.jpg", "hospital_bill.jpg"],
    patientNames: ["Rajesh Kumar", "Arjun Mehta"],
    expected: {
      documentBlocked: true,
    },
  },

  {
    id: "TC004",
    title: "Clean Consultation - Full Approval",
    employeeId: "EMP001",
    treatmentType: "CONSULTATION",
    amount: 1500,
    treatmentDate: "2024-06-15",
    diagnosis: "General consultation",
    hospitalName: "",
    hasPreAuth: false,
    files: ["prescription.jpg", "hospital_bill.jpg"],
    patientNames: ["Rajesh Kumar", "Rajesh Kumar"],
    ytdClaimsAmount: 5000,
    expected: {
      decision: "APPROVED",
      approvedAmount: 1350,
    },
  },

  {
    id: "TC005",
    title: "Waiting Period - Diabetes",
    employeeId: "EMP005",
    treatmentType: "CONSULTATION",
    amount: 3000,
    treatmentDate: "2024-10-15",
    diagnosis: "Diabetes treatment",
    hospitalName: "",
    hasPreAuth: false,
    files: ["prescription.jpg", "hospital_bill.jpg"],
    patientNames: ["Vikram Joshi", "Vikram Joshi"],
    expected: {
      decision: "REJECTED",
      approvedAmount: 0,
    },
  },

  {
    id: "TC006",
    title: "Dental Partial Approval",
    employeeId: "EMP002",
    treatmentType: "DENTAL",
    amount: 12000,
    treatmentDate: "2024-06-20",
    diagnosis: "Dental treatment",
    hospitalName: "",
    hasPreAuth: false,
    files: ["hospital_bill.jpg"],
    patientNames: ["Priya Singh"],
    dentalItems: [
      {
        description: "Root Canal Treatment",
        amount: 8000,
      },
      {
        description: "Teeth Whitening",
        amount: 4000,
      },
    ],
    expected: {
      decision: "PARTIAL",
      approvedAmount: 8000,
    },
  },

  {
    id: "TC007",
    title: "MRI Without Pre-Authorization",
    employeeId: "EMP003",
    treatmentType: "DIAGNOSTIC",
    amount: 15000,
    treatmentDate: "2024-07-10",
    diagnosis: "MRI scan",
    hospitalName: "",
    hasPreAuth: false,
    files: [
      "prescription.jpg",
      "lab_report.jpg",
      "hospital_bill.jpg",
    ],
    patientNames: [
      "Amit Verma",
      "Amit Verma",
      "Amit Verma",
    ],
    expected: {
      decision: "REJECTED",
      approvedAmount: 0,
    },
  },

  {
    id: "TC008",
    title: "Per-Claim Limit Exceeded",
    employeeId: "EMP002",
    treatmentType: "CONSULTATION",
    amount: 7500,
    treatmentDate: "2024-07-20",
    diagnosis: "General consultation",
    hospitalName: "",
    hasPreAuth: false,
    files: ["prescription.jpg", "hospital_bill.jpg"],
    patientNames: ["Priya Singh", "Priya Singh"],
    expected: {
      decision: "REJECTED",
      approvedAmount: 0,
    },
  },

  {
    id: "TC009",
    title: "Fraud Signal - Multiple Same-Day Claims",
    employeeId: "EMP008",
    treatmentType: "CONSULTATION",
    amount: 4800,
    treatmentDate: "2024-08-10",
    diagnosis: "General consultation",
    hospitalName: "",
    hasPreAuth: false,
    files: ["prescription.jpg", "hospital_bill.jpg"],
    patientNames: ["Ravi Menon", "Ravi Menon"],
    sameDayClaimsBefore: 3,
    monthlyClaimsBefore: 5,
    expected: {
      decision: "MANUAL_REVIEW",
      approvedAmount: 0,
    },
  },

  {
    id: "TC010",
    title: "Network Hospital Discount",
    employeeId: "EMP001",
    treatmentType: "CONSULTATION",
    amount: 4500,
    treatmentDate: "2024-08-15",
    diagnosis: "General consultation",
    hospitalName: "Apollo Hospitals",
    hasPreAuth: false,
    files: ["prescription.jpg", "hospital_bill.jpg"],
    patientNames: ["Rajesh Kumar", "Rajesh Kumar"],
    expected: {
      decision: "APPROVED",
      approvedAmount: 3240,
    },
  },

  {
    id: "TC011",
    title: "Component Failure - Graceful Degradation",
    employeeId: "EMP006",
    treatmentType: "ALTERNATIVE_MEDICINE",
    amount: 4000,
    treatmentDate: "2024-08-20",
    diagnosis: "Alternative medicine treatment",
    hospitalName: "",
    hasPreAuth: false,
    files: ["prescription.jpg", "hospital_bill.jpg"],
    patientNames: ["Kavita Nair", "Kavita Nair"],
    simulateComponentFailure: true,
    expected: {
      decision: "APPROVED",
      approvedAmount: 4000,
    },
  },

  {
    id: "TC012",
    title: "Excluded Treatment - Obesity",
    employeeId: "EMP007",
    treatmentType: "CONSULTATION",
    amount: 8000,
    treatmentDate: "2024-08-25",
    diagnosis:
      "Bariatric surgery for obesity / weight loss program",
    hospitalName: "",
    hasPreAuth: false,
    files: ["prescription.jpg", "hospital_bill.jpg"],
    patientNames: ["Suresh Patil", "Suresh Patil"],
    expected: {
      decision: "REJECTED",
      approvedAmount: 0,
    },
  },
];

type TestRunResult = {
  id: string;
  title: string;
  passed: boolean;
  actualDecision: string;
  actualAmount: number;
  expectedText: string;
  actualText: string;
  reason: string;
};

const emptyForm = {
  employeeId: "EMP001",
  treatmentType: "CONSULTATION" as TreatmentType,
  amount: "1500",
  treatmentDate: "2024-06-15",
  diagnosis: "General consultation",
  hospitalName: "",
  hasPreAuth: false,
  sameDayClaimsBefore: "0",
  monthlyClaimsBefore: "0",
  ytdClaimsAmount: "0",
};

export default function Home() {
  const [selectedCase, setSelectedCase] =
    useState("TC004");

  const [form, setForm] = useState(emptyForm);

  const [uploadedFiles, setUploadedFiles] =
    useState<File[]>([]);

  const [documentResult, setDocumentResult] =
    useState<{
      ok: boolean;
      message: string;
      detected?: {
        filename: string;
        type: string;
      }[];
      trace?: string[];
    } | null>(null);

  const [decisionResult, setDecisionResult] =
    useState<DecisionResult | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [runningAllTests, setRunningAllTests] =
    useState(false);

  const [ocrResult, setOcrResult] =
    useState<{
      processingState: "NORMAL" | "DEGRADED";
      confidence: number;
      documents: {
        fileName: string;
        fileType: string;
        ocr: {
          text: string;
          confidence: number;
          processingState:
            | "NORMAL"
            | "DEGRADED";
          trace: string[];
        };
      }[];
      combinedText: string;
      trace: string[];
    } | null>(null);

  const [ocrLoading, setOcrLoading] =
    useState(false);

  const [ocrError, setOcrError] =
    useState("");

  const [testResults, setTestResults] =
    useState<TestRunResult[]>([]);

  const [simulateUnreadable, setSimulateUnreadable] =
    useState(false);

  const [simulatePatientMismatch, setSimulatePatientMismatch] =
    useState(false);

  const currentDemoCase =
    demoCases.find(
      (item) => item.id === selectedCase
    );

  function loadDemoCase(caseId: string) {
    const demo =
      demoCases.find(
        (item) => item.id === caseId
      );

    if (!demo) return;

    setSelectedCase(caseId);

    setForm({
      employeeId: demo.employeeId,
      treatmentType:
        demo.treatmentType,
      amount: String(demo.amount),
      treatmentDate:
        demo.treatmentDate,
      diagnosis: demo.diagnosis,
      hospitalName:
        demo.hospitalName,
      hasPreAuth:
        demo.hasPreAuth,
      sameDayClaimsBefore: String(
        demo.sameDayClaimsBefore ?? 0
      ),
      monthlyClaimsBefore: String(
        demo.monthlyClaimsBefore ?? 0
      ),
      ytdClaimsAmount: String(
        demo.ytdClaimsAmount ?? 0
      ),
    });

    setUploadedFiles([]);
    setDocumentResult(null);
    setOcrResult(null);
    setOcrError("");
    setDecisionResult(null);

    setSimulateUnreadable(
      Boolean(
        demo.unreadableFiles?.length
      )
    );

    setSimulatePatientMismatch(
      Boolean(
        demo.patientNames &&
          new Set(
            demo.patientNames
          ).size > 1
      )
    );
  }

  function buildClaimInput(
    demo: DemoCase
  ): ClaimInput {
    return {
      employeeId:
        demo.employeeId,

      treatmentType:
        demo.treatmentType,

      amount:
        demo.amount,

      treatmentDate:
        demo.treatmentDate,

      diagnosis:
        demo.diagnosis,

      hospitalName:
        demo.hospitalName,

      hasPreAuth:
        demo.hasPreAuth,

      sameDayClaimsBefore:
        demo.sameDayClaimsBefore ?? 0,

      monthlyClaimsBefore:
        demo.monthlyClaimsBefore ?? 0,

      ytdClaimsAmount:
        demo.ytdClaimsAmount ?? 0,

      simulateComponentFailure:
        demo.simulateComponentFailure ??
        false,

      dentalItems:
        demo.dentalItems,
    };
  }

  function runSingleDemoCase(
    demo: DemoCase
  ): TestRunResult {
    /*
     * STEP 1:
     * Verify documents.
     */
    const verification =
      verifyDocuments({
        treatmentType:
          demo.treatmentType,

        filenames:
          demo.files,

        unreadableFiles:
          demo.unreadableFiles ?? [],

        patientNames:
          demo.patientNames ?? [],
      });

    /*
     * TC001-TC003 should stop before
     * claim decision.
     */
    if (demo.expected.documentBlocked) {
      const passed =
        !verification.ok;

      return {
        id: demo.id,
        title: demo.title,
        passed,

        actualDecision:
          verification.ok
            ? "DECISION_CREATED"
            : "BLOCKED",

        actualAmount: 0,

        expectedText:
          "DOCUMENT_BLOCKED",

        actualText:
          verification.ok
            ? "DOCUMENTS_ACCEPTED"
            : "DOCUMENTS_BLOCKED",

        reason:
          verification.message,
      };
    }

    /*
     * If documents unexpectedly fail,
     * the test fails.
     */
    if (!verification.ok) {
      return {
        id: demo.id,
        title: demo.title,
        passed: false,

        actualDecision:
          "DOCUMENT_BLOCKED",

        actualAmount: 0,

        expectedText:
          `${demo.expected.decision ?? "UNKNOWN"} ₹${
            demo.expected.approvedAmount ?? 0
          }`,

        actualText:
          "DOCUMENT_BLOCKED",

        reason:
          verification.message,
      };
    }

    /*
     * STEP 2:
     * Run claim decision engine.
     */
    let result: DecisionResult;

    try {
      result =
        evaluateClaim(
          buildClaimInput(demo)
        );
    } catch (error) {
      return {
        id: demo.id,
        title: demo.title,
        passed: false,

        actualDecision:
          "ERROR",

        actualAmount: 0,

        expectedText:
          `${demo.expected.decision ?? "UNKNOWN"} ₹${
            demo.expected.approvedAmount ?? 0
          }`,

        actualText:
          "ERROR",

        reason:
          error instanceof Error
            ? error.message
            : "Unknown error",
      };
    }

    const expectedDecision =
      demo.expected.decision;

    const expectedAmount =
      demo.expected.approvedAmount ?? 0;

    const decisionMatches =
      result.decision ===
      expectedDecision;

    const amountMatches =
      Math.round(
        result.approvedAmount
      ) ===
      Math.round(
        expectedAmount
      );

    const passed =
      decisionMatches &&
      amountMatches;

    return {
      id: demo.id,
      title: demo.title,
      passed,

      actualDecision:
        result.decision,

      actualAmount:
        result.approvedAmount,

      expectedText:
        `${expectedDecision} ₹${expectedAmount}`,

      actualText:
        `${result.decision} ₹${result.approvedAmount}`,

      reason:
        result.reason,
    };
  }

  function runAllTests() {
    setRunningAllTests(true);
    setTestResults([]);
    setDecisionResult(null);
    setDocumentResult(null);
    setOcrResult(null);
    setOcrError("");

    setTimeout(() => {
      const results =
        demoCases.map(
          (demo) =>
            runSingleDemoCase(demo)
        );

      setTestResults(results);
      setRunningAllTests(false);
    }, 100);
  }

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    if (!event.target.files) {
      setUploadedFiles([]);
      return;
    }

    setUploadedFiles(
      Array.from(
        event.target.files
      )
    );

    setDocumentResult(null);
    setDecisionResult(null);
    setOcrResult(null);
    setOcrError("");
  }

  async function runClaimOCR(files: File[]) {
  if (files.length === 0) {
    return null;
  }

  setOcrLoading(true);
  setOcrError("");

  try {
    const formData = new FormData();

    for (const file of files) {
      formData.append("files", file);
    }

    /*
     * No client-side timeout.
     *
     * The browser will wait for the OCR API response.
     * This allows local Tesseract OCR to take as long
     * as it needs instead of artificially aborting after
     * a few seconds.
     */
    const response = await fetch("/api/claim-ocr", {
      method: "POST",
      body: formData,
    });

    let data: {
  success?: boolean;
  error?: string;
  processingState?: "NORMAL" | "DEGRADED";
  confidence?: number;
  documents: {
        fileName: string;
        fileType: string;
        ocr: {
          text: string;
          confidence: number;
          processingState:
            | "NORMAL"
            | "DEGRADED";
          trace: string[];
        };
      }[];
      combinedText?: string;
      trace?: string[];
    };

    try {
      data = await response.json();
    } catch {
      throw new Error(
        `OCR service returned an invalid response (HTTP ${response.status}).`
      );
    }

    if (!response.ok || !data.success) {
      throw new Error(
        data.error ??
          `OCR processing failed with status ${response.status}.`
      );
    }

    setOcrResult({
      processingState:
        data.processingState ?? "DEGRADED",

      confidence:
        data.confidence ?? 0,

      documents:
        data.documents ?? [],

      combinedText:
        data.combinedText ?? "",

      trace:
        data.trace ?? [],
    });

    return data;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to connect to the OCR service.";

    console.warn(
      "OCR degraded:",
      message
    );

    setOcrError(message);
    setOcrResult(null);

    /*
     * IMPORTANT:
     *
     * OCR failure must NOT silently continue
     * into policy decisioning because the system
     * cannot verify patient identity.
     */
    return null;
  } finally {
    setOcrLoading(false);
  }
}

  function extractDentalItemsFromOCR(
    documents: { fileName: string; ocr: { text: string } }[]
  ): { description: string; amount: number }[] {
    const items: { description: string; amount: number }[] = [];

    for (const document of documents) {
      const text = document.ocr.text || "";
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.replace(/[©|]/g, " ").trim())
        .filter(Boolean);

      for (const line of lines) {
        const amountMatch = line.match(
          /(?:₹|INR|Rs\.?\s*)?([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*$/i
        );

        if (!amountMatch) continue;

        const amount = Number(amountMatch[1].replace(/,/g, ""));
        if (!Number.isFinite(amount) || amount <= 0) continue;

        const description = line
          .slice(0, amountMatch.index ?? line.length)
          .replace(/(?:₹|INR|Rs\.?)[\s:]*/gi, " ")
          .replace(/[-:©|]+\s*$/g, "")
          .trim();

        const normalized = description.toLowerCase();

        const isDentalProcedure =
          /root\s*canal|extraction|filling|scaling|polishing|dental\s*x[- ]?ray|crown\s*placement|gum\s*treatment|whitening|veneers|braces|cosmetic\s*implants|bleaching/.test(
            normalized
          );

        if (!isDentalProcedure) continue;

        if (
          !items.some(
            (item) =>
              item.description.toLowerCase() === normalized &&
              item.amount === amount
          )
        ) {
          items.push({
            description,
            amount,
          });
        }
      }
    }

    return items;
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setDocumentResult(null);
    setDecisionResult(null);
    setOcrError("");

    try {
      const demo =
        currentDemoCase;

      const fileNames =
        uploadedFiles.length > 0
          ? uploadedFiles.map(
              (file) => file.name
            )
          : demo?.files ?? [];

      if (
        fileNames.length === 0
      ) {
        setDocumentResult({
          ok: false,
          message:
            "Please upload the required claim documents before processing.",
        });

        setLoading(false);
        return;
      }

      /*
       * =====================================================
       * STEP 1 — DOCUMENT VERIFICATION
       * =====================================================
       */

      let unreadableFiles: string[] =
        [];

      let extractedDentalItems: {
        description: string;
        amount: number;
      }[] | undefined;

      if (
        demo?.unreadableFiles
      ) {
        unreadableFiles =
          demo.unreadableFiles;
      } else if (
        simulateUnreadable
      ) {
        unreadableFiles = [
          fileNames[
            fileNames.length - 1
          ],
        ];
      }

      /*
       * Demo cases use simulated
       * patient names.
       *
       * Real uploads get identity
       * information from OCR below.
       */
      let patientNames: string[] =
        [];

      if (demo?.patientNames) {
        patientNames =
          demo.patientNames;
      } else if (
        simulatePatientMismatch
      ) {
        patientNames = [
          "Rajesh Kumar",
          "Arjun Mehta",
        ];
      }

      const verification =
        verifyDocuments({
          treatmentType:
            form.treatmentType,

          filenames:
            fileNames,

          unreadableFiles,

          patientNames,
        });

      setDocumentResult(
        verification
      );

      /*
       * Required document validation
       * remains the first hard gate.
       */
      if (!verification.ok) {
        setLoading(false);
        return;
      }

      /*
       * =====================================================
       * STEP 2 — REAL OCR + IDENTITY VERIFICATION
       * =====================================================
       *
       * Real uploaded documents:
       *
       * File
       *   ↓
       * OCR
       *   ↓
       * Structured extraction
       *   ↓
       * Patient name + employee ID
       *   ↓
       * Policy roster verification
       *   ↓
       * Policy decision
       */

      if (
        uploadedFiles.length > 0
      ) {
        const ocrData =
          await runClaimOCR(
            uploadedFiles
          );

        /*
         * OCR unavailable:
         *
         * We cannot safely verify identity.
         * Therefore STOP before policy decisioning.
         */
        if (!ocrData) {
          setDocumentResult({
            ok: false,

            message:
              "Identity verification could not be completed because OCR was unavailable. Please retry with readable documents or send the claim for manual review.",

            detected:
              verification.detected,

            trace: [
              ...verification.trace,

              "OCR was unavailable.",

              "Patient name and employee ID could not be verified from the uploaded documents.",

              "Claim processing stopped before policy decisioning.",
            ],
          });

          setLoading(false);
          return;
        }

        /*
         * ===================================================
         * STEP 3 — EXTRACT STRUCTURED IDENTITY DATA
         * ===================================================
         */

        if (form.treatmentType === "DENTAL") {
          extractedDentalItems =
            extractDentalItemsFromOCR(
              ocrData.documents
            );

          if (extractedDentalItems.length === 0) {
            setDocumentResult({
              ok: false,
              message:
                "Dental line items could not be extracted from the uploaded bill. Please upload a readable bill showing each treatment and amount.",
              detected: verification.detected,
              trace: [
                ...verification.trace,
                "Dental claim detected.",
                "No covered/excluded dental line items could be extracted from OCR.",
                "Claim processing stopped before policy decisioning.",
              ],
            });
            setLoading(false);
            return;
          }

          console.info(
            "Dental line items extracted:",
            extractedDentalItems
          );
        }

        const extraction =
          extractClaimDocuments(
            ocrData.documents.map(
              (document: {
                fileName: string;
                ocr: {
                  text: string;
                };
              }) => ({
                filename:
                  document.fileName,

                text:
                  document.ocr.text,
              })
            )
          );

        /*
         * Patient names extracted
         * from OCR documents.
         */
        const extractedPatientNames =
          extraction.documents
            .map(
              (document) =>
                document.fields
                  .patientName
                  ?.value
            )
            .filter(
              (
                name
              ): name is string =>
                Boolean(name)
            );

        /*
         * Employee IDs extracted
         * from OCR documents.
         */
        const extractedEmployeeIds =
          extraction.documents
            .map(
              (document) =>
                document.fields
                  .employeeId
                  ?.value
            )
            .filter(
              (
                id
              ): id is string =>
                Boolean(id)
            );

        /*
         * ===================================================
         * STEP 4 — VERIFY EMPLOYEE + PATIENT
         * ===================================================
         *
         * This is the critical security gate.
         *
         * Example:
         *
         * Claim form:
         * EMP001
         *
         * Uploaded bill:
         * Patient: Arjun Mehta
         *
         * Policy roster:
         * EMP001 -> Rajesh Kumar
         *
         * Result:
         * BLOCKED
         *
         * The claim never reaches evaluateClaim().
         */

        const identityVerification =
          verifyClaimIdentity({
            employeeId:
              form.employeeId,

            patientNames:
              extractedPatientNames,

            employeeIds:
              extractedEmployeeIds,
          });

        /*
         * Add identity information
         * to the document trace.
         */
        setDocumentResult({
          ok:
            verification.ok &&
            identityVerification.ok,

          message:
            identityVerification.ok
              ? `${verification.message} ${identityVerification.message}`
              : identityVerification.message,

          detected:
            verification.detected,

          trace: [
            ...verification.trace,

            ...identityVerification.trace,
          ],
        });

        /*
         * ===================================================
         * HARD STOP ON IDENTITY FAILURE
         * ===================================================
         *
         * EMP001 + someone else's bill
         * cannot proceed.
         */
        if (
          !identityVerification.ok
        ) {
          setLoading(false);
          return;
        }
      } else {
        /*
         * Demo cases have no real uploaded
         * documents, so keep deterministic
         * evaluation behavior.
         */
        setOcrResult(null);
      }

      /*
       * =====================================================
       * STEP 5 — POLICY DECISION
       * =====================================================
       *
       * Reached only after:
       *
       * 1. Required document verification
       * 2. OCR identity verification for real uploads
       * 3. Employee/patient roster validation
       */

      const claimInput: ClaimInput = {
        employeeId:
          form.employeeId,

        treatmentType:
          form.treatmentType,

        amount:
          Number(form.amount),

        treatmentDate:
          form.treatmentDate,

        diagnosis:
          form.diagnosis,

        hospitalName:
          form.hospitalName,

        hasPreAuth:
          form.hasPreAuth,

        sameDayClaimsBefore:
          Number(
            form.sameDayClaimsBefore
          ),

        monthlyClaimsBefore:
          Number(
            form.monthlyClaimsBefore
          ),

        ytdClaimsAmount:
          Number(
            form.ytdClaimsAmount
          ),

        simulateComponentFailure:
          demo?.simulateComponentFailure ??
          false,

        /*
         * Dental claims must always carry itemized treatment lines.
         * Demo/evaluation cases already contain trusted line items.
         * Real uploaded dental bills use OCR-extracted line items.
         */
        dentalItems:
          form.treatmentType === "DENTAL"
            ? (uploadedFiles.length === 0
                ? demo?.dentalItems
                : extractedDentalItems)
            : undefined,
      };

      const result =
        evaluateClaim(
          claimInput
        );

      setDecisionResult(
        result
      );
    } catch (error) {
      console.error(error);

      setDecisionResult({
        decision:
          "MANUAL_REVIEW",

        approvedAmount:
          0,

        reason:
          "The claim engine encountered an unexpected error. The claim has been moved to manual review.",

        confidence:
          0.3,

        processingState:
          "DEGRADED",

        trace: [
          "Unexpected processing error captured safely.",
          "System did not crash.",
          "Manual review recommended.",
        ],
      });
    } finally {
      setLoading(false);
    }
  }

  const requiredDocs =
    requiredDocuments(
      form.treatmentType
    );

  const passedTests =
    testResults.filter(
      (result) =>
        result.passed
    ).length;

  const failedTests =
    testResults.filter(
      (result) =>
        !result.passed
    ).length;

  return (
    <main className="min-h-screen bg-[#0b0f14] text-slate-100">
      <div className="relative mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-[#11161d] shadow-xl shadow-black/20">
          <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-lg font-black text-white">
                  P
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                    Plum AI
                  </p>

                  <p className="text-xs text-slate-400">
                    Intelligent claims operations
                  </p>
                </div>
              </div>

              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Health Insurance{" "}
                <span className="text-white">
                  Claim Review
                </span>
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                Verify documents, extract claim information, apply policy terms,
                and produce an explainable decision in one workflow.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/60" />

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                  System Ready
                </p>

                <p className="text-xs text-slate-400">
                  Policy + OCR + decision engine
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 px-6 py-4 sm:px-8">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              {[
                ["01", "Documents"],
                ["02", "Verification"],
                ["03", "OCR"],
                ["04", "Policy"],
                ["05", "Decision"],
              ].map(
                ([number, label], index) => (
                  <div
                    key={number}
                    className="flex items-center gap-2"
                  >
                    <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-violet-200">
                      {number} · {label}
                    </span>

                    {index < 4 && (
                      <span className="hidden text-slate-600 sm:inline">
                        →
                      </span>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [
              "POLICY",
              "JSON-driven rules",
              "No hardcoded policy logic",
            ],
            [
              "DOCUMENTS",
              "Verify before AI",
              "Early-stop validation",
            ],
            [
              "OCR",
              "Local Tesseract",
              "Confidence-aware extraction",
            ],
            [
              "DECISION",
              "Explainable output",
              "Amount + reason + trace",
            ],
          ].map(
            ([label, value, detail]) => (
              <div
                key={label}
                className="group rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-lg backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-violet-400/20"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                  {label}
                </p>

                <p className="mt-2 text-sm font-black text-white">
                  {value}
                </p>

                <p className="mt-1 text-[11px] text-slate-500">
                  {detail}
                </p>
              </div>
            )
          )}
        </section>

        <div className="mb-6 rounded-2xl border border-violet-400/10 bg-gradient-to-r from-violet-500/[0.08] via-fuchsia-500/[0.04] to-cyan-500/[0.06] px-4 py-3 text-xs text-slate-400 shadow-lg backdrop-blur-xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              <strong className="text-slate-200">
                Production flow:
              </strong>{" "}
              verify → extract → evaluate policy → explain decision
            </span>

            <span className="font-semibold text-violet-300">
              Built for auditable claim operations
            </span>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 shadow-2xl backdrop-blur-xl sm:p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
                  Step 01 · Claim Intake
                </p>

                <h2 className="mt-1 text-2xl font-black text-white">
                  Claim details
                </h2>
              </div>

              <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 sm:inline-flex">
                Live review
              </span>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Employee ID
                  </label>

                  <input
                    value={
                      form.employeeId
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        employeeId:
                          e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/10"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Treatment Type
                  </label>

                  <select
                    value={
                      form.treatmentType
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        treatmentType:
                          e.target
                            .value as TreatmentType,
                      })
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#111827] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400/60"
                  >
                    <option value="CONSULTATION">
                      Consultation
                    </option>

                    <option value="DIAGNOSTIC">
                      Diagnostic
                    </option>

                    <option value="PHARMACY">
                      Pharmacy
                    </option>

                    <option value="DENTAL">
                      Dental
                    </option>

                    <option value="VISION">
                      Vision
                    </option>

                    <option value="ALTERNATIVE_MEDICINE">
                      Alternative Medicine
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Claim Amount
                  </label>

                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm text-slate-500">
                      ₹
                    </span>

                    <input
                      type="number"
                      value={
                        form.amount
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          amount:
                            e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-white/10 bg-black/20 py-2.5 pl-8 pr-3 text-sm text-white outline-none focus:border-violet-400/60"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Treatment Date
                  </label>

                  <input
                    type="date"
                    value={
                      form.treatmentDate
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        treatmentDate:
                          e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400/60"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Diagnosis
                  </label>

                  <input
                    value={
                      form.diagnosis
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        diagnosis:
                          e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400/60"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Hospital / Provider
                  </label>

                  <input
                    value={
                      form.hospitalName
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        hospitalName:
                          e.target.value,
                      })
                    }
                    placeholder="e.g. Apollo Hospitals"
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400/60"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={
                    form.hasPreAuth
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      hasPreAuth:
                        e.target.checked,
                    })
                  }
                  className="h-4 w-4 accent-violet-500"
                />

                Pre-authorization available
              </label>

              <div className="rounded-2xl border border-dashed border-violet-400/30 bg-gradient-to-br from-violet-500/[0.08] to-cyan-500/[0.04] p-4">
                <div className="mb-3">
                  <p className="text-sm font-bold text-white">
                    Step 02 · Upload documents
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    PDF, JPG or PNG · Required documents are checked against policy.
                  </p>
                </div>

                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={
                    handleFileChange
                  }
                  className="w-full cursor-pointer rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-500 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-violet-400"
                />

                {uploadedFiles.length >
                  0 && (
                  <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.05] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-cyan-200">
                          Step 03 · Local OCR
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Tesseract extracts readable text after document verification.
                        </p>
                      </div>

                      <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-300">
                        {
                          uploadedFiles.length
                        }{" "}
                        file
                        {uploadedFiles.length ===
                        1
                          ? ""
                          : "s"}
                      </span>
                    </div>

                    {ocrLoading && (
                      <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/[0.04] p-3 text-sm text-cyan-300">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />

                        Extracting document text...
                      </div>
                    )}

                    {ocrError && (
                      <div className="mt-4 rounded-xl border border-orange-400/20 bg-orange-400/[0.06] p-3">
                        <p className="text-sm font-bold text-orange-300">
                          OCR degraded
                        </p>

                        <p className="mt-1 text-xs text-orange-200/70">
                          {ocrError}
                        </p>
                      </div>
                    )}

                    {ocrResult && (
                      <div className="mt-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500">
                              OCR Confidence
                            </p>

                            <p className="mt-1 text-xl font-black text-white">
                              {Math.round(
                                ocrResult.confidence *
                                  100
                              )}
                              %
                            </p>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500">
                              State
                            </p>

                            <p
                              className={`mt-1 text-sm font-black ${
                                ocrResult.processingState ===
                                "NORMAL"
                                  ? "text-emerald-300"
                                  : "text-orange-300"
                              }`}
                            >
                              {
                                ocrResult.processingState
                              }
                            </p>
                          </div>
                        </div>

                        <details className="rounded-xl border border-white/10 bg-black/20 p-3">
                          <summary className="cursor-pointer text-xs font-bold text-slate-300">
                            View extracted text
                          </summary>

                          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-black/30 p-3 text-[11px] leading-5 text-slate-400">
                            {ocrResult.combinedText ||
                              "No readable text was extracted from the uploaded documents."}
                          </pre>
                        </details>

                        <details className="rounded-xl border border-white/10 bg-black/20 p-3">
                          <summary className="cursor-pointer text-xs font-bold text-slate-300">
                            View OCR trace
                          </summary>

                          <ol className="mt-3 list-decimal space-y-1 pl-5 text-[11px] leading-5 text-slate-500">
                            {ocrResult.trace.map(
                              (
                                item,
                                index
                              ) => (
                                <li
                                  key={
                                    index
                                  }
                                >
                                  {item}
                                </li>
                              )
                            )}
                          </ol>
                        </details>
                      </div>
                    )}
                  </div>
                )}

                <p className="mt-3 text-[11px] text-slate-500">
                  Demo cases automatically provide simulated documents.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#0d1218] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-white">
                    Policy requirements
                  </p>

                  <span className="rounded-full bg-violet-400/10 px-2.5 py-1 text-[10px] font-bold text-violet-300">
                    LIVE POLICY
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {requiredDocs.map(
                    (doc) => (
                      <span
                        key={doc}
                        className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-[11px] font-semibold text-slate-400"
                      >
                        {doc}
                      </span>
                    )
                  )}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={
                      simulateUnreadable
                    }
                    onChange={(e) =>
                      setSimulateUnreadable(
                        e.target.checked
                      )
                    }
                    className="h-4 w-4 accent-violet-500"
                  />

                  Simulate unreadable document
                </label>

                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={
                      simulatePatientMismatch
                    }
                    onChange={(e) =>
                      setSimulatePatientMismatch(
                        e.target.checked
                      )
                    }
                    className="h-4 w-4 accent-violet-500"
                  />

                  Simulate patient mismatch
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 px-5 py-3.5 text-sm font-black text-white shadow-xl shadow-violet-950/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="relative z-10">
                  {loading
                    ? "Processing claim..."
                    : "Review Claim →"}
                </span>

                <span className="absolute inset-0 -translate-x-full bg-white/20 transition-transform duration-700 group-hover:translate-x-full" />
              </button>
            </form>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 shadow-2xl backdrop-blur-xl sm:p-6">
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
                Step 04 · Decision
              </p>

              <h2 className="mt-1 text-2xl font-black text-white">
                Claim review
              </h2>
            </div>

            {documentResult && (
              <div
                className={`mb-5 rounded-2xl border p-4 ${
                  documentResult.ok
                    ? "border-emerald-400/20 bg-emerald-400/[0.06]"
                    : "border-red-400/20 bg-red-400/[0.06]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                      documentResult.ok
                        ? "bg-emerald-400/10 text-emerald-300"
                        : "bg-red-400/10 text-red-300"
                    }`}
                  >
                    {documentResult.ok
                      ? "✓"
                      : "!"}
                  </span>

                  <div>
                    <p className="text-sm font-bold text-white">
                      Document Verification
                    </p>

                    <p className="mt-0.5 text-xs text-slate-400">
                      {
                        documentResult.message
                      }
                    </p>
                  </div>
                </div>

                {documentResult.detected &&
                  documentResult
                    .detected.length >
                    0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {documentResult.detected.map(
                        (doc) => (
                          <span
                            key={`${doc.filename}-${doc.type}`}
                            className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-[10px] text-slate-400"
                          >
                            {doc.type}
                          </span>
                        )
                      )}
                    </div>
                  )}

                {documentResult.trace &&
                  documentResult.trace.length >
                    0 && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-xs font-bold text-slate-400">
                        View verification trace
                      </summary>

                      <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] text-slate-500">
                        {documentResult.trace.map(
                          (
                            item,
                            index
                          ) => (
                            <li
                              key={
                                index
                              }
                            >
                              {item}
                            </li>
                          )
                        )}
                      </ul>
                    </details>
                  )}
              </div>
            )}

            {decisionResult ? (
              <div className="space-y-4">
                <div
                  className={`relative overflow-hidden rounded-3xl border p-6 ${
                    decisionResult.decision ===
                    "APPROVED"
                      ? "border-emerald-400/30 bg-emerald-400/[0.035]"
                      : decisionResult.decision ===
                          "PARTIAL"
                        ? "border-amber-400/30 bg-amber-400/[0.035]"
                        : decisionResult.decision ===
                            "MANUAL_REVIEW"
                          ? "border-orange-400/30 bg-orange-400/[0.035]"
                          : "border-red-400/30 bg-red-400/[0.035]"
                  }`}
                >
                  <div className="relative">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                        Final decision
                      </p>

                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-black ${
                          decisionResult.processingState ===
                          "NORMAL"
                            ? "bg-emerald-400/10 text-emerald-300"
                            : "bg-orange-400/10 text-orange-300"
                        }`}
                      >
                        {
                          decisionResult.processingState
                        }
                      </span>
                    </div>

                    <p
                      className={`mt-4 text-4xl font-black tracking-tight ${
                        decisionResult.decision ===
                        "APPROVED"
                          ? "text-emerald-300"
                          : decisionResult.decision ===
                              "PARTIAL"
                            ? "text-amber-300"
                            : decisionResult.decision ===
                                "MANUAL_REVIEW"
                              ? "text-orange-300"
                              : "text-red-300"
                      }`}
                    >
                      {decisionResult.decision.replace(
                        "_",
                        " "
                      )}
                    </p>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">
                          Approved amount
                        </p>

                        <p className="mt-1 text-2xl font-black text-white">
                          ₹
                          {decisionResult.approvedAmount.toLocaleString(
                            "en-IN"
                          )}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">
                          Confidence
                        </p>

                        <p className="mt-1 text-2xl font-black text-white">
                          {Math.round(
                            decisionResult.confidence *
                              100
                          )}
                          %
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#0d1218] p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Reason
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {
                      decisionResult.reason
                    }
                  </p>
                </div>

                <details className="rounded-xl border border-white/10 bg-[#0d1218] p-4">
                  <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-slate-400">
                    Explainable decision trace
                  </summary>

                  <ol className="mt-4 list-decimal space-y-2 pl-5 text-xs leading-5 text-slate-500">
                    {decisionResult.trace.map(
                      (
                        item,
                        index
                      ) => (
                        <li
                          key={index}
                        >
                          {item}
                        </li>
                      )
                    )}
                  </ol>
                </details>
              </div>
            ) : (
              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/10 px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-xl">
                  ✦
                </div>

                <p className="mt-5 text-lg font-bold text-white">
                  Ready for review
                </p>

                <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
                  Enter claim details and upload the required documents. The
                  decision engine will show its reasoning here.
                </p>
              </div>
            )}
          </section>
        </div>

        <details className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-[#11161d] shadow-lg shadow-black/10">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-sm font-bold text-white">
                Evaluation Suite
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Automated verification of the 12 assignment scenarios
              </p>
            </div>

            <div className="flex items-center gap-3">
              {testResults.length >
                0 && (
                <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">
                  {passedTests}/
                  {
                    testResults.length
                  }{" "}
                  passed
                </span>
              )}

              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  runAllTests();
                }}
                disabled={
                  runningAllTests
                }
                className="rounded-lg border border-white/10 bg-white/[0.08] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {runningAllTests
                  ? "Running evaluation..."
                  : "Run Evaluation Suite"}
              </button>
            </div>
          </summary>

          {testResults.length >
            0 && (
            <div className="border-t border-white/10 p-5">
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    Scenarios
                  </p>

                  <p className="mt-1 text-2xl font-black">
                    {
                      testResults.length
                    }
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-4">
                  <p className="text-xs uppercase tracking-wider text-emerald-400">
                    Passed
                  </p>

                  <p className="mt-1 text-2xl font-black text-emerald-300">
                    {
                      passedTests
                    }
                  </p>
                </div>

                <div className="rounded-xl border border-red-400/20 bg-red-400/[0.04] p-4">
                  <p className="text-xs uppercase tracking-wider text-red-400">
                    Failed
                  </p>

                  <p className="mt-1 text-2xl font-black text-red-300">
                    {
                      failedTests
                    }
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.04] text-slate-400">
                    <tr>
                      <th className="p-3">
                        Test
                      </th>

                      <th className="p-3">
                        Scenario
                      </th>

                      <th className="p-3">
                        Expected
                      </th>

                      <th className="p-3">
                        Actual
                      </th>

                      <th className="p-3">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {testResults.map(
                      (result) => (
                        <tr
                          key={
                            result.id
                          }
                          className="border-t border-white/5 text-slate-300"
                        >
                          <td className="p-3 font-bold text-white">
                            {
                              result.id
                            }
                          </td>

                          <td className="p-3">
                            {
                              result.title
                            }
                          </td>

                          <td className="p-3">
                            {
                              result.expectedText
                            }
                          </td>

                          <td className="p-3">
                            {
                              result.actualText
                            }
                          </td>

                          <td className="p-3">
                            {result.passed ? (
                              <span className="font-bold text-emerald-400">
                                ✓ PASS
                              </span>
                            ) : (
                              <span className="font-bold text-red-400">
                                ✗ FAIL
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </details>

        <footer className="mt-8 flex flex-col gap-2 border-t border-white/10 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Plum Claims AI · Policy-driven claim automation
          </span>

          <span>
            Local OCR · Explainable decisions · Graceful degradation
          </span>
        </footer>
      </div>
    </main>
  );
}