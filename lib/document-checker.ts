import policy from "../policy_terms.json";

export type TreatmentType =
  | "CONSULTATION"
  | "DIAGNOSTIC"
  | "PHARMACY"
  | "DENTAL"
  | "VISION"
  | "ALTERNATIVE_MEDICINE";

export type DocumentType =
  | "PRESCRIPTION"
  | "HOSPITAL_BILL"
  | "LAB_REPORT"
  | "PHARMACY_BILL"
  | "DENTAL_REPORT"
  | "UNKNOWN";

export type DetectedDocument = {
  filename: string;
  type: DocumentType;
};

export type DocumentVerificationResult = {
  ok: boolean;
  message: string;
  detected: DetectedDocument[];
  missing: string[];
  unexpected: string[];
  duplicates: string[];
  trace: string[];
};

type PolicyMember = {
  member_id: string;
  name: string;
  relationship: string;
  primary_member_id?: string;
};

const policyData = policy as {
  document_requirements: Record<
    string,
    {
      required: string[];
    }
  >;
  members?: PolicyMember[];
};

const policyMembers: PolicyMember[] =
  policyData.members ?? [];

/*
 * =========================================================
 * REQUIRED DOCUMENTS
 * =========================================================
 */

export function requiredDocuments(
  treatmentType: TreatmentType
): string[] {
  const requirement =
    policyData.document_requirements[treatmentType];

  if (!requirement) {
    return [];
  }

  return requirement.required ?? [];
}

/*
 * =========================================================
 * DOCUMENT TYPE DETECTION
 * =========================================================
 */

function identifyDocument(
  filename: string
): DocumentType {
  const name = filename.toLowerCase();

  /*
   * Specific document names must be checked before
   * generic bill/invoice words.
   */

  if (
    name.includes("prescription") ||
    name.includes("presc") ||
    name.includes("rx")
  ) {
    return "PRESCRIPTION";
  }

  if (
    name.includes("pharmacy") ||
    name.includes("medicine") ||
    name.includes("drug")
  ) {
    return "PHARMACY_BILL";
  }

  if (
    name.includes("lab_report") ||
    name.includes("lab-report") ||
    name.includes("labreport") ||
    name.includes("diagnostic")
  ) {
    return "LAB_REPORT";
  }

  if (
    name.includes("dental_report") ||
    name.includes("dental-report") ||
    name.includes("dentalreport")
  ) {
    return "DENTAL_REPORT";
  }

  if (
    name.includes("hospital_bill") ||
    name.includes("hospital-bill") ||
    name.includes("hospitalbill") ||
    name.includes("hospital_invoice") ||
    name.includes("hospital-invoice") ||
    name.includes("clinic_bill") ||
    name.includes("clinic-bill") ||
    name.includes("invoice") ||
    name.includes("bill") ||
    name.includes("hospital")
  ) {
    return "HOSPITAL_BILL";
  }

  return "UNKNOWN";
}

/*
 * =========================================================
 * DOCUMENT DISPLAY NAME
 * =========================================================
 */

function prettyDocumentName(
  documentType: string
): string {
  switch (documentType) {
    case "PRESCRIPTION":
      return "PRESCRIPTION";

    case "HOSPITAL_BILL":
      return "HOSPITAL_BILL";

    case "LAB_REPORT":
      return "LAB_REPORT";

    case "PHARMACY_BILL":
      return "PHARMACY_BILL";

    case "DENTAL_REPORT":
      return "DENTAL_REPORT";

    default:
      return documentType;
  }
}

/*
 * =========================================================
 * PERSON / ID NORMALIZATION
 * =========================================================
 */

function normalizePersonName(
  value: string
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeEmployeeId(
  value: string
): string {
  return value
    .trim()
    .toUpperCase();
}

/*
 * =========================================================
 * IDENTITY VERIFICATION
 * =========================================================
 *
 * This is the important security check.
 *
 * Flow:
 *
 * Claim Employee ID
 *        ↓
 * Policy member roster
 *        ↓
 * Employee + covered dependents
 *        ↓
 * OCR patient name
 *        ↓
 * Identity match
 *
 * Example:
 *
 * Claim: EMP001
 * Policy: EMP001 = Rajesh Kumar
 * OCR: Patient = Rajesh Kumar
 *
 *       → PASS
 *
 *
 * Example:
 *
 * Claim: EMP001
 * Policy: EMP001 = Rajesh Kumar
 * OCR: Patient = Arjun Mehta
 *
 *       → BLOCK
 *
 * Employee IDs printed on medical documents are optional.
 * Patient name is required for identity verification.
 */

export type IdentityVerificationResult = {
  ok: boolean;
  message: string;
  trace: string[];
};

export function verifyClaimIdentity(input: {
  employeeId: string;
  patientNames: string[];
  employeeIds: string[];
}): IdentityVerificationResult {
  const trace: string[] = [];

  /*
   * -------------------------------------------------------
   * 1. CLAIM EMPLOYEE ID
   * -------------------------------------------------------
   */

  const claimEmployeeId =
    normalizeEmployeeId(input.employeeId);

  if (!claimEmployeeId) {
    trace.push(
      "No employee ID was supplied for the claim."
    );

    return {
      ok: false,
      message:
        "Employee ID is required before claim processing can continue.",
      trace,
    };
  }

  trace.push(
    `Claim employee ID received: ${claimEmployeeId}.`
  );

  /*
   * -------------------------------------------------------
   * 2. VERIFY EMPLOYEE AGAINST POLICY ROSTER
   * -------------------------------------------------------
   */

  const employee = policyMembers.find(
    (member) =>
      normalizeEmployeeId(member.member_id) ===
      claimEmployeeId
  );

  if (!employee) {
    trace.push(
      `Employee ID ${claimEmployeeId} was not found in the policy member roster.`
    );

    return {
      ok: false,
      message:
        `Employee ID ${claimEmployeeId} is not present in the policy roster. ` +
        `Please verify the employee ID and claim details.`,
      trace,
    };
  }

  trace.push(
    `Claim employee ${claimEmployeeId} maps to policy member "${employee.name}".`
  );

  /*
   * -------------------------------------------------------
   * 3. FIND EMPLOYEE + COVERED DEPENDENTS
   * -------------------------------------------------------
   *
   * The employee is eligible.
   *
   * A dependent is eligible when:
   *
   * dependent.primary_member_id === claimEmployeeId
   */

  const eligibleMembers =
    policyMembers.filter(
      (member) =>
        normalizeEmployeeId(member.member_id) ===
          claimEmployeeId ||
        normalizeEmployeeId(
          member.primary_member_id ?? ""
        ) === claimEmployeeId
    );

  trace.push(
    `Found ${eligibleMembers.length} eligible policy member(s) for employee ${claimEmployeeId}.`
  );

  /*
   * -------------------------------------------------------
   * 4. CHECK EMPLOYEE IDS FOUND BY OCR
   * -------------------------------------------------------
   *
   * Medical documents do not necessarily contain the
   * employee ID.
   *
   * Therefore:
   *
   * No OCR employee ID → allowed.
   *
   * OCR employee ID found → it MUST match the claim.
   */

  const extractedEmployeeIds =
    Array.from(
      new Set(
        input.employeeIds
          .map(normalizeEmployeeId)
          .filter(Boolean)
      )
    );

  if (extractedEmployeeIds.length > 0) {
    trace.push(
      `OCR found employee ID(s) in the uploaded documents: ${extractedEmployeeIds.join(
        ", "
      )}.`
    );

    const wrongEmployeeIds =
      extractedEmployeeIds.filter(
        (id) => id !== claimEmployeeId
      );

    if (wrongEmployeeIds.length > 0) {
      trace.push(
        `Employee ID mismatch detected. Claim ID: ${claimEmployeeId}; ` +
          `document ID(s): ${extractedEmployeeIds.join(", ")}.`
      );

      return {
        ok: false,
        message:
          `Employee ID mismatch. The claim is for ${claimEmployeeId}, ` +
          `but the uploaded document(s) contain ${wrongEmployeeIds.join(
            ", "
          )}. Please upload documents belonging to the claimed employee.`,
        trace,
      };
    }

    trace.push(
      `All employee IDs found in the documents match claim employee ${claimEmployeeId}.`
    );
  } else {
    trace.push(
      "No employee ID was found in the uploaded documents. " +
        "This is allowed because medical documents do not necessarily contain the employee ID."
    );
  }

  /*
   * -------------------------------------------------------
   * 5. EXTRACT PATIENT NAMES
   * -------------------------------------------------------
   *
   * Patient name IS required.
   *
   * This is the key connection between the medical
   * document and the policy member roster.
   */

  const extractedPatientNames =
    Array.from(
      new Set(
        input.patientNames
          .map(normalizePersonName)
          .filter(Boolean)
      )
    );

  if (extractedPatientNames.length === 0) {
    trace.push(
      "No patient name could be extracted from the uploaded documents."
    );

    return {
      ok: false,
      message:
        "The uploaded documents do not contain a readable patient name. " +
        "Please upload a clearer document containing the patient's name.",
      trace,
    };
  }

  /*
   * -------------------------------------------------------
   * 6. ALL DOCUMENTS MUST IDENTIFY THE SAME PATIENT
   * -------------------------------------------------------
   */

  if (extractedPatientNames.length > 1) {
    trace.push(
      `Patient mismatch detected across documents: ${extractedPatientNames.join(
        " vs "
      )}.`
    );

    return {
      ok: false,
      message:
        `The uploaded documents belong to different patients. ` +
        `Detected patient names: ${extractedPatientNames.join(
          ", "
        )}. Please upload documents belonging to the same patient.`,
      trace,
    };
  }

  const patientName =
    extractedPatientNames[0];

  trace.push(
    `All uploaded documents identify patient "${patientName}".`
  );

  /*
   * -------------------------------------------------------
   * 7. MATCH PATIENT AGAINST EMPLOYEE / DEPENDENTS
   * -------------------------------------------------------
   */

  const matchingMember =
    eligibleMembers.find(
      (member) =>
        normalizePersonName(member.name) ===
        patientName
    );

  /*
   * Patient does not belong to the claimed employee's
   * policy membership.
   */

  if (!matchingMember) {
    trace.push(
      `Patient "${patientName}" does not match employee ${claimEmployeeId} or any eligible dependent.`
    );

    const eligibleNames =
      eligibleMembers
        .map((member) => member.name)
        .join(", ");

    trace.push(
      `Eligible patient names for ${claimEmployeeId}: ${eligibleNames}.`
    );

    return {
      ok: false,
      message:
        `Patient identity mismatch. The claim is for ${claimEmployeeId} ` +
        `(${employee.name}), but the uploaded document identifies the patient ` +
        `as "${patientName}". The patient is not the employee or a covered ` +
        `dependent under this employee.`,
      trace,
    };
  }

  /*
   * -------------------------------------------------------
   * 8. IDENTITY VERIFIED
   * -------------------------------------------------------
   */

  trace.push(
    `Patient "${matchingMember.name}" matches policy member ${matchingMember.member_id}.`
  );

  if (
    normalizeEmployeeId(
      matchingMember.member_id
    ) === claimEmployeeId
  ) {
    trace.push(
      "Patient is the primary employee."
    );
  } else {
    trace.push(
      `Patient is a covered dependent of employee ${claimEmployeeId}.`
    );
  }

  trace.push(
    "Patient identity and policy membership verification passed."
  );

  return {
    ok: true,
    message:
      `Patient "${matchingMember.name}" is verified against employee ${claimEmployeeId}.`,
    trace,
  };
}

/*
 * =========================================================
 * DOCUMENT VERIFICATION
 * =========================================================
 */

export function verifyDocuments(input: {
  treatmentType: TreatmentType;
  filenames: string[];
  unreadableFiles?: string[];
  patientNames?: string[];
}): DocumentVerificationResult {
  const {
    treatmentType,
    filenames,
    unreadableFiles = [],
    patientNames = [],
  } = input;

  const trace: string[] = [];

  /*
   * -------------------------------------------------------
   * 1. GET REQUIRED DOCUMENTS FROM POLICY
   * -------------------------------------------------------
   */

  const required =
    requiredDocuments(treatmentType);

  trace.push(
    `Treatment type identified as ${treatmentType}.`
  );

  trace.push(
    `Required documents from policy: ${
      required.length > 0
        ? required.join(", ")
        : "None"
    }.`
  );

  /*
   * -------------------------------------------------------
   * 2. DETECT DOCUMENT TYPES
   * -------------------------------------------------------
   */

  const detected: DetectedDocument[] =
    filenames.map((filename) => ({
      filename,
      type: identifyDocument(filename),
    }));

  for (const document of detected) {
    trace.push(
      `Detected ${document.type} from file "${document.filename}".`
    );
  }

  /*
   * -------------------------------------------------------
   * 3. UNEXPECTED DOCUMENTS
   * -------------------------------------------------------
   *
   * UNKNOWN documents are also unexpected.
   */

  const unexpected = detected
    .filter(
      (document) =>
        document.type === "UNKNOWN" ||
        !required.includes(document.type)
    )
    .map(
      (document) => document.type
    );

  /*
   * -------------------------------------------------------
   * 4. MISSING REQUIRED DOCUMENTS
   * -------------------------------------------------------
   */

  const detectedTypes =
    detected.map(
      (document) => document.type
    );

  const missing = required.filter(
    (requiredType) =>
      !detectedTypes.includes(
        requiredType as DocumentType
      )
  );

  /*
   * -------------------------------------------------------
   * 5. DUPLICATE DOCUMENTS
   * -------------------------------------------------------
   */

  const counts: Record<string, number> =
    {};

  for (const document of detected) {
    counts[document.type] =
      (counts[document.type] ?? 0) + 1;
  }

  const duplicates =
    Object.entries(counts)
      .filter(
        ([type, count]) =>
          count > 1 &&
          type !== "UNKNOWN"
      )
      .map(([type]) => type);

  /*
   * -------------------------------------------------------
   * 6. UNREADABLE DOCUMENT CHECK
   * -------------------------------------------------------
   */

  const unreadable =
    filenames.filter((filename) =>
      unreadableFiles.includes(filename)
    );

  if (unreadable.length > 0) {
    for (const filename of unreadable) {
      const detectedDocument =
        detected.find(
          (document) =>
            document.filename === filename
        );

      const type =
        detectedDocument?.type ??
        "UNKNOWN";

      trace.push(
        `Document "${filename}" was flagged as unreadable.`
      );

      return {
        ok: false,
        message:
          `The ${prettyDocumentName(
            type
          )} document "${filename}" is unreadable. ` +
          `Please re-upload a clear copy of this document.`,
        detected,
        missing,
        unexpected,
        duplicates,
        trace,
      };
    }
  }

  /*
   * -------------------------------------------------------
   * 7. WRONG / MISSING / DUPLICATE DOCUMENT CHECK
   * -------------------------------------------------------
   */

  if (
    missing.length > 0 ||
    unexpected.length > 0 ||
    duplicates.length > 0
  ) {
    if (missing.length > 0) {
      trace.push(
        `Missing required document(s): ${missing.join(
          ", "
        )}.`
      );
    }

    if (unexpected.length > 0) {
      trace.push(
        `Unexpected document type(s): ${unexpected.join(
          ", "
        )}.`
      );
    }

    if (duplicates.length > 0) {
      trace.push(
        `Duplicate document type(s): ${duplicates.join(
          ", "
        )}.`
      );
    }

    const parts: string[] = [];

    if (missing.length > 0) {
      parts.push(
        `Missing required document(s): ${missing.join(
          ", "
        )}`
      );
    }

    if (unexpected.length > 0) {
      parts.push(
        `Wrong/unexpected document(s): ${unexpected.join(
          ", "
        )}`
      );
    }

    if (duplicates.length > 0) {
      parts.push(
        `Duplicate document(s): ${duplicates.join(
          ", "
        )}`
      );
    }

    return {
      ok: false,
      message:
        parts.join(". ") +
        ". Please upload the exact required document(s) before processing.",
      detected,
      missing,
      unexpected,
      duplicates,
      trace,
    };
  }

  /*
   * -------------------------------------------------------
   * 8. LEGACY DEMO PATIENT MATCH CHECK
   * -------------------------------------------------------
   *
   * Existing demo/test scenarios can still pass
   * patientNames directly.
   *
   * Real uploaded documents should use
   * verifyClaimIdentity() after OCR.
   */

  const validPatientNames =
    patientNames
      .map((name) => name.trim())
      .filter(Boolean);

  const normalizedDemoPatientNames =
    Array.from(
      new Set(
        validPatientNames.map(
          normalizePersonName
        )
      )
    );

  if (
    normalizedDemoPatientNames.length > 1
  ) {
    trace.push(
      `Patient mismatch detected across documents: ${validPatientNames.join(
        " vs "
      )}.`
    );

    return {
      ok: false,
      message:
        `The uploaded documents belong to different patients. ` +
        `Detected patient names: ${validPatientNames.join(
          ", "
        )}. Please upload documents belonging to the same patient.`,
      detected,
      missing,
      unexpected,
      duplicates,
      trace,
    };
  }

  if (
    normalizedDemoPatientNames.length === 1
  ) {
    trace.push(
      `All documents reference patient "${validPatientNames[0]}".`
    );
  }

  /*
   * -------------------------------------------------------
   * 9. DOCUMENT VERIFICATION PASSED
   * -------------------------------------------------------
   */

  trace.push(
    "Document verification completed successfully."
  );

  return {
    ok: true,
    message:
      "All required claim documents are present and passed document verification.",
    detected,
    missing: [],
    unexpected: [],
    duplicates: [],
    trace,
  };
}