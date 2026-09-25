import { runOCR, type OCRResult } from "./ocr";

export interface ClaimOCRDocument {
  fileName: string;
  fileType: string;
  ocr: OCRResult;
}

export interface ClaimOCRResult {
  success: boolean;
  processingState: "NORMAL" | "DEGRADED";
  confidence: number;
  documents: ClaimOCRDocument[];
  combinedText: string;
  trace: string[];
}

/**
 * Runs OCR against uploaded image documents.
 *
 * This is intentionally separate from the policy engine.
 * Document verification remains responsible for deciding whether
 * a claim can proceed. OCR only extracts text from readable images.
 */
export async function extractClaimOCR(
  files: File[]
): Promise<ClaimOCRResult> {
  const trace: string[] = [
    "OCR extraction started.",
  ];

  const imageFiles = files.filter((file) =>
    [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ].includes(file.type)
  );

  if (imageFiles.length === 0) {
    trace.push(
      "No supported image documents were supplied for OCR."
    );

    return {
      success: true,
      processingState: "DEGRADED",
      confidence: 0.4,
      documents: [],
      combinedText: "",
      trace,
    };
  }

  const documents: ClaimOCRDocument[] = [];

  for (const file of imageFiles) {
    try {
      trace.push(
        `Running OCR for ${file.name}.`
      );

      const buffer = Buffer.from(
        await file.arrayBuffer()
      );

      const ocr = await runOCR(buffer);

      documents.push({
        fileName: file.name,
        fileType: file.type,
        ocr,
      });

      trace.push(
        ...ocr.trace.map(
          (item) =>
            `${file.name}: ${item}`
        )
      );
    } catch (error) {
      trace.push(
        `OCR failed for ${file.name}.`
      );

      trace.push(
        error instanceof Error
          ? error.message
          : "Unknown OCR error."
      );

      documents.push({
        fileName: file.name,
        fileType: file.type,
        ocr: {
          text: "",
          confidence: 0.2,
          processingState: "DEGRADED",
          trace: [
            "OCR component failed for this document.",
          ],
        },
      });
    }
  }

  const successfulDocuments =
    documents.filter(
      (document) =>
        document.ocr.text.length > 0
    );

  const combinedText =
    successfulDocuments
      .map(
        (document) =>
          `--- ${document.fileName} ---\n${document.ocr.text}`
      )
      .join("\n\n");

  const confidence =
    documents.length === 0
      ? 0.4
      : documents.reduce(
          (sum, document) =>
            sum + document.ocr.confidence,
          0
        ) / documents.length;

  const processingState =
    documents.some(
      (document) =>
        document.ocr.processingState ===
        "DEGRADED"
    )
      ? "DEGRADED"
      : "NORMAL";

  trace.push(
    `OCR processed ${documents.length} image document(s).`
  );

  trace.push(
    `Combined OCR confidence: ${(confidence * 100).toFixed(1)}%.`
  );

  trace.push(
    `OCR processing state: ${processingState}.`
  );

  return {
    success: true,
    processingState,
    confidence,
    documents,
    combinedText,
    trace,
  };
}