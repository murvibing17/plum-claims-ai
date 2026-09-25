import {
  runOCRBatch,
  type OCRResult,
} from "./ocr";

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
    return {
      success: true,
      processingState: "DEGRADED",
      confidence: 0.4,
      documents: [],
      combinedText: "",
      trace: [
        ...trace,
        "No supported image documents were supplied for OCR.",
      ],
    };
  }

  trace.push(
    `Preparing ${imageFiles.length} image document(s) for OCR.`
  );

  const buffers = await Promise.all(
    imageFiles.map(async (file) =>
      Buffer.from(await file.arrayBuffer())
    )
  );

  trace.push(
    "Using one shared Tesseract worker for all documents."
  );

  const ocrResults =
    await runOCRBatch(buffers);

  const documents: ClaimOCRDocument[] =
    imageFiles.map((file, index) => {
      const ocr =
        ocrResults[index] ?? {
          text: "",
          confidence: 0.2,
          processingState: "DEGRADED" as const,
          trace: [
            "OCR result was not returned for this document.",
          ],
        };

      return {
        fileName: file.name,
        fileType: file.type,
        ocr,
      };
    });

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
    `${successfulDocuments.length} document(s) produced readable text.`
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