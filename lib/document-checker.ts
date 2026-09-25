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

const policyData = policy as {
  document_requirements: Record<
    string,
    {
      required: string[];
    }
  >;
};

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

function identifyDocument(filename: string): DocumentType {
  const name = filename.toLowerCase();

  /*
   * The order matters.
   * We check specific document names before generic
   * hospital/invoice words.
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

function prettyDocumentName(documentType: string): string {
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

  const required = requiredDocuments(treatmentType);

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
   * Detect document types from filenames.
   */
  const detected: DetectedDocument[] = filenames.map(
    (filename) => ({
      filename,
      type: identifyDocument(filename),
    })
  );

  for (const document of detected) {
    trace.push(
      `Detected ${document.type} from file "${document.filename}".`
    );
  }

  /*
   * UNKNOWN documents are treated as unexpected.
   */
  const unexpected = detected
    .filter(
      (document) =>
        document.type === "UNKNOWN" ||
        !required.includes(document.type)
    )
    .map((document) => document.type);

  /*
   * Find missing required document types.
   */
  const detectedTypes = detected.map(
    (document) => document.type
  );

  const missing = required.filter(
    (requiredType) =>
      !detectedTypes.includes(requiredType as DocumentType)
  );

  /*
   * Find duplicate document types.
   */
  const counts: Record<string, number> = {};

  for (const document of detected) {
    counts[document.type] =
      (counts[document.type] ?? 0) + 1;
  }

  const duplicates = Object.entries(counts)
    .filter(
      ([type, count]) =>
        count > 1 &&
        type !== "UNKNOWN"
    )
    .map(([type]) => type);

  /*
   * UNREADABLE DOCUMENT CHECK
   */
  const unreadable = filenames.filter((filename) =>
    unreadableFiles.includes(filename)
  );

  if (unreadable.length > 0) {
    for (const filename of unreadable) {
      const detectedDocument = detected.find(
        (document) =>
          document.filename === filename
      );

      const type =
        detectedDocument?.type ?? "UNKNOWN";

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
   * WRONG / MISSING DOCUMENT CHECK
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
   * PATIENT MATCH CHECK
   */
  const validPatientNames = patientNames
    .map((name) => name.trim())
    .filter(Boolean);

  const uniquePatientNames = Array.from(
    new Set(validPatientNames)
  );

  if (uniquePatientNames.length > 1) {
    trace.push(
      `Patient mismatch detected across documents: ${uniquePatientNames.join(
        " vs "
      )}.`
    );

    return {
      ok: false,
      message:
        `The uploaded documents belong to different patients. ` +
        `Detected patient names: ${uniquePatientNames.join(
          ", "
        )}. ` +
        `Please upload documents belonging to the same patient.`,
      detected,
      missing,
      unexpected,
      duplicates,
      trace,
    };
  }

  if (uniquePatientNames.length === 1) {
    trace.push(
      `All documents reference patient "${uniquePatientNames[0]}".`
    );
  }

  /*
   * Everything passed.
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