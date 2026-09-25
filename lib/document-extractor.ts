import type {
  ClaimInput,
  TreatmentType,
} from "./claim-decision";

/* =========================================================
   TYPES
========================================================= */

export type ExtractedField<T = string> = {
  value?: T;
  confidence: number;
  source: string;
};

export type ExtractedDocument = {
  filename: string;
  documentType:
    | "PRESCRIPTION"
    | "HOSPITAL_BILL"
    | "LAB_REPORT"
    | "PHARMACY_BILL"
    | "UNKNOWN";

  fields: {
    patientName?: ExtractedField<string>;
    employeeId?: ExtractedField<string>;
    treatmentDate?: ExtractedField<string>;
    hospitalName?: ExtractedField<string>;
    diagnosis?: ExtractedField<string>;
    amount?: ExtractedField<number>;
    treatment?: ExtractedField<string>;
  };

  confidence: number;
  status: "EXTRACTED" | "PARTIAL" | "FAILED";
  messages: string[];
};

export type ExtractionInput = {
  filename: string;
  documentType?: string;
  text?: string;
};

export type ExtractionResult = {
  success: boolean;
  documents: ExtractedDocument[];
  claim: Partial<ClaimInput>;
  confidence: number;
  processingState: "NORMAL" | "DEGRADED";
  trace: string[];
  errors: string[];
};

/* =========================================================
   NORMALIZATION HELPERS
========================================================= */

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase();
}

function cleanText(value: string): string {
  return value
    .replace(/\r/g, "")
    .trim();
}

/* =========================================================
   DOCUMENT TYPE DETECTION
========================================================= */

export function detectDocumentType(
  filename: string
): ExtractedDocument["documentType"] {
  const name = normalize(filename);

  if (
    name.includes("prescription") ||
    name.includes("presc")
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
    name.includes("lab") ||
    name.includes("report") ||
    name.includes("diagnostic")
  ) {
    return "LAB_REPORT";
  }

  if (
    name.includes("hospital") ||
    name.includes("bill") ||
    name.includes("invoice")
  ) {
    return "HOSPITAL_BILL";
  }

  return "UNKNOWN";
}

/* =========================================================
   FIELD EXTRACTION
========================================================= */

/*
 * Patient name extraction
 *
 * OCR may produce formats such as:
 *
 * Patient Name: R. Karthik
 * Patient Name - R. Karthik
 * Patient Name | R. Karthik
 * Patient Name © R. Karthik
 * Patient: R. Karthik
 *
 * Some OCR output puts the next field on the same line:
 *
 * Patient Name © R. Karthik Consultation Type : General Medicine
 *
 * Therefore we explicitly stop before common following
 * field labels.
 */

function extractPatientName(
  text: string
): ExtractedField<string> | undefined {
  const patientNamePattern =
    /(?:patient\s*name|patient)\s*(?:[:\-|©]\s*)+([A-Za-z][A-Za-z .'-]{1,})(?=\s+(?:consultation\s+type|patient\s+id|patient\s*id|doctor|age\s*\/?\s*gender|registration\s*(?:no|number)?|date|follow\s*up|bill\s*(?:no|number)?|patient\s*id|policy\s*(?:no|number)?|insurance\s*(?:co|company)|department|$))/i;

  const match = text.match(
    patientNamePattern
  );

  if (!match) {
    /*
     * Fallback for a patient-name field that appears
     * on its own line and does not have another known
     * field immediately after it.
     */
    const fallback =
      text.match(
        /(?:patient\s*name|patient)\s*(?:[:\-|©]\s*)+([A-Za-z][A-Za-z .'-]{1,})/i
      );

    if (!fallback) {
      return undefined;
    }

    const value = fallback[1]
      .trim()
      .replace(/\s+/g, " ");

    if (!value) {
      return undefined;
    }

    return {
      value,
      confidence: 0.90,
      source: "text",
    };
  }

  const value = match[1]
    .trim()
    .replace(/\s+/g, " ");

  if (!value) {
    return undefined;
  }

  return {
    value,
    confidence: 0.96,
    source: "text",
  };
}

/*
 * Employee ID extraction
 */

function extractEmployeeId(
  text: string
): ExtractedField<string> | undefined {
  const match = text.match(
    /\bEMP\d{3}\b/i
  );

  if (!match) {
    return undefined;
  }

  return {
    value: match[0].toUpperCase(),
    confidence: 0.98,
    source: "text",
  };
}

/*
 * Date extraction
 */

function extractDate(
  text: string
): ExtractedField<string> | undefined {
  const isoMatch = text.match(
    /\b(20\d{2})-(\d{2})-(\d{2})\b/
  );

  if (isoMatch) {
    return {
      value: isoMatch[0],
      confidence: 0.98,
      source: "text",
    };
  }

  const slashMatch = text.match(
    /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b/
  );

  if (slashMatch) {
    const day = slashMatch[1].padStart(2, "0");
    const month = slashMatch[2].padStart(2, "0");
    const year = slashMatch[3];

    return {
      value: `${year}-${month}-${day}`,
      confidence: 0.88,
      source: "text",
    };
  }

  return undefined;
}

/*
 * Amount extraction
 */

function extractAmount(
  text: string
): ExtractedField<number> | undefined {
  const labelledAmount = text.match(
    /(?:total|amount|bill\s*amount|grand\s*total|payable)\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i
  );

  if (labelledAmount) {
    const value = Number(
      labelledAmount[1].replace(/,/g, "")
    );

    if (Number.isFinite(value)) {
      return {
        value,
        confidence: 0.94,
        source: "text",
      };
    }
  }

  return undefined;
}

/*
 * Hospital / provider name
 */

function extractHospitalName(
  text: string
): ExtractedField<string> | undefined {
  const match = text.match(
    /(?:hospital|provider|clinic)\s*[:\-]\s*([^\n]+)/i
  );

  if (!match) {
    return undefined;
  }

  return {
    value: match[1].trim(),
    confidence: 0.90,
    source: "text",
  };
}

/*
 * Diagnosis
 */

function extractDiagnosis(
  text: string
): ExtractedField<string> | undefined {
  const match = text.match(
    /(?:diagnosis|condition|clinical\s*diagnosis)\s*[:\-]\s*([^\n]+)/i
  );

  if (!match) {
    return undefined;
  }

  return {
    value: match[1].trim(),
    confidence: 0.88,
    source: "text",
  };
}

/*
 * Treatment / procedure / test / service
 */

function extractTreatment(
  text: string
): ExtractedField<string> | undefined {
  const match = text.match(
    /(?:treatment|procedure|test|service)\s*[:\-]\s*([^\n]+)/i
  );

  if (!match) {
    return undefined;
  }

  return {
    value: match[1].trim(),
    confidence: 0.88,
    source: "text",
  };
}

/* =========================================================
   SINGLE DOCUMENT EXTRACTION
========================================================= */

export function extractDocument(
  input: ExtractionInput
): ExtractedDocument {
  const documentType =
    (input.documentType as ExtractedDocument["documentType"]) ||
    detectDocumentType(input.filename);

  const text =
    cleanText(input.text ?? "");

  const fields: ExtractedDocument["fields"] = {};
  const messages: string[] = [];

  if (!text) {
    messages.push(
      "No readable text was supplied for this document."
    );

    return {
      filename: input.filename,
      documentType,
      fields,
      confidence: 0.35,
      status: "PARTIAL",
      messages,
    };
  }

  /* -------------------------------------------------------
     Extract individual fields
  ------------------------------------------------------- */

  const patientName =
    extractPatientName(text);

  if (patientName) {
    fields.patientName =
      patientName;
  }

  const employeeId =
    extractEmployeeId(text);

  if (employeeId) {
    fields.employeeId =
      employeeId;
  }

  const treatmentDate =
    extractDate(text);

  if (treatmentDate) {
    fields.treatmentDate =
      treatmentDate;
  }

  const amount =
    extractAmount(text);

  if (amount) {
    fields.amount =
      amount;
  }

  const hospitalName =
    extractHospitalName(text);

  if (hospitalName) {
    fields.hospitalName =
      hospitalName;
  }

  const diagnosis =
    extractDiagnosis(text);

  if (diagnosis) {
    fields.diagnosis =
      diagnosis;
  }

  const treatment =
    extractTreatment(text);

  if (treatment) {
    fields.treatment =
      treatment;
  }

  /* -------------------------------------------------------
     Determine extraction status
  ------------------------------------------------------- */

  const fieldCount =
    Object.keys(fields).length;

  if (fieldCount === 0) {
    messages.push(
      "Document text was readable, but no supported structured fields were detected."
    );

    return {
      filename: input.filename,
      documentType,
      fields,
      confidence: 0.40,
      status: "FAILED",
      messages,
    };
  }

  /*
   * Patient identity is particularly important.
   * If we have it, explicitly record that in the trace.
   */
  if (fields.patientName?.value) {
    messages.push(
      `Patient name extracted: "${fields.patientName.value}".`
    );
  }

  if (fieldCount < 2) {
    messages.push(
      "Only a subset of expected fields could be extracted."
    );

    return {
      filename: input.filename,
      documentType,
      fields,
      confidence: fields.patientName
        ? 0.78
        : 0.65,
      status: "PARTIAL",
      messages,
    };
  }

  messages.push(
    `${fieldCount} structured fields extracted successfully.`
  );

  return {
    filename: input.filename,
    documentType,
    fields,
    confidence: 0.90,
    status: "EXTRACTED",
    messages,
  };
}

/* =========================================================
   CLAIM FIELD MERGING
========================================================= */

function mergeField<T>(
  current: ExtractedField<T> | undefined,
  incoming: ExtractedField<T> | undefined
): ExtractedField<T> | undefined {
  if (!current) {
    return incoming;
  }

  if (!incoming) {
    return current;
  }

  return incoming.confidence >
    current.confidence
    ? incoming
    : current;
}

/* =========================================================
   BUILD STRUCTURED CLAIM
========================================================= */

function buildStructuredClaim(
  documents: ExtractedDocument[]
): Partial<ClaimInput> {
  let employeeId:
    | ExtractedField<string>
    | undefined;

  let treatmentDate:
    | ExtractedField<string>
    | undefined;

  let hospitalName:
    | ExtractedField<string>
    | undefined;

  let diagnosis:
    | ExtractedField<string>
    | undefined;

  let amount:
    | ExtractedField<number>
    | undefined;

  let treatment:
    | ExtractedField<string>
    | undefined;

  for (const document of documents) {
    employeeId =
      mergeField(
        employeeId,
        document.fields.employeeId
      );

    treatmentDate =
      mergeField(
        treatmentDate,
        document.fields.treatmentDate
      );

    hospitalName =
      mergeField(
        hospitalName,
        document.fields.hospitalName
      );

    diagnosis =
      mergeField(
        diagnosis,
        document.fields.diagnosis
      );

    amount =
      mergeField(
        amount,
        document.fields.amount
      );

    treatment =
      mergeField(
        treatment,
        document.fields.treatment
      );
  }

  const claim: Partial<ClaimInput> = {};

  if (employeeId?.value) {
    claim.employeeId =
      employeeId.value;
  }

  if (treatmentDate?.value) {
    claim.treatmentDate =
      treatmentDate.value;
  }

  if (hospitalName?.value) {
    claim.hospitalName =
      hospitalName.value;
  }

  if (diagnosis?.value) {
    claim.diagnosis =
      diagnosis.value;
  }

  if (amount?.value !== undefined) {
    claim.amount =
      amount.value;
  }

  /*
   * Treatment is intentionally not assigned here because
   * ClaimInput expects a controlled TreatmentType.
   *
   * The raw extracted treatment remains available through
   * each document's fields.treatment.
   */

  return claim;
}

/* =========================================================
   EXTRACTION CONFIDENCE
========================================================= */

function calculateOverallConfidence(
  documents: ExtractedDocument[]
): number {
  if (documents.length === 0) {
    return 0;
  }

  const total =
    documents.reduce(
      (sum, document) =>
        sum + document.confidence,
      0
    );

  return Number(
    (
      total /
      documents.length
    ).toFixed(2)
  );
}

/* =========================================================
   MAIN EXTRACTION PIPELINE
========================================================= */

export function extractClaimDocuments(
  inputs: ExtractionInput[]
): ExtractionResult {
  const trace: string[] = [];
  const errors: string[] = [];

  trace.push(
    `Starting extraction for ${inputs.length} document(s).`
  );

  const documents =
    inputs.map((input) => {
      const result =
        extractDocument(input);

      trace.push(
        `${result.filename}: ${result.status} with ${Math.round(
          result.confidence * 100
        )}% confidence.`
      );

      if (
        result.messages.length > 0
      ) {
        for (
          const message of result.messages
        ) {
          trace.push(
            `${result.filename}: ${message}`
          );
        }
      }

      if (
        result.status === "FAILED"
      ) {
        errors.push(
          `${result.filename}: extraction failed.`
        );
      }

      return result;
    });

  const claim =
    buildStructuredClaim(
      documents
    );

  const confidence =
    calculateOverallConfidence(
      documents
    );

  let processingState:
    | "NORMAL"
    | "DEGRADED" = "NORMAL";

  if (
    documents.some(
      (document) =>
        document.status !==
        "EXTRACTED"
    )
  ) {
    processingState =
      "DEGRADED";

    trace.push(
      "One or more documents were only partially extracted."
    );
  }

  if (
    errors.length > 0
  ) {
    trace.push(
      "Extraction completed with errors."
    );
  } else {
    trace.push(
      "Extraction completed successfully."
    );
  }

  return {
    success:
      errors.length === 0,
    documents,
    claim,
    confidence,
    processingState,
    trace,
    errors,
  };
}

/* =========================================================
   TREATMENT TYPE HELPER
========================================================= */

export function normalizeTreatmentType(
  value: string
): TreatmentType | undefined {
  const text =
    normalize(value);

  if (
    text.includes("consult")
  ) {
    return "CONSULTATION";
  }

  if (
    text.includes("diagnostic") ||
    text.includes("diagnosis") ||
    text.includes("mri") ||
    text.includes("ct") ||
    text.includes("pet") ||
    text.includes("lab")
  ) {
    return "DIAGNOSTIC";
  }

  if (
    text.includes("pharmacy") ||
    text.includes("medicine") ||
    text.includes("drug")
  ) {
    return "PHARMACY";
  }

  if (
    text.includes("dental") ||
    text.includes("tooth") ||
    text.includes("root canal") ||
    text.includes("filling") ||
    text.includes("extraction")
  ) {
    return "DENTAL";
  }

  if (
    text.includes("vision") ||
    text.includes("eye") ||
    text.includes("glasses") ||
    text.includes("contact lens") ||
    text.includes("cataract")
  ) {
    return "VISION";
  }

  if (
    text.includes("alternative") ||
    text.includes("ayurveda") ||
    text.includes("homeopathy") ||
    text.includes("unani")
  ) {
    return "ALTERNATIVE_MEDICINE";
  }

  return undefined;
}