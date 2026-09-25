import path from "node:path";
import { createWorker } from "tesseract.js";

export interface OCRResult {
  text: string;
  confidence: number;
  processingState: "NORMAL" | "DEGRADED";
  trace: string[];
}

type OCRInput = string | Buffer;

function getWorkerPath() {
  return path.resolve(
    process.cwd(),
    "node_modules",
    "tesseract.js",
    "src",
    "worker-script",
    "node",
    "index.js"
  );
}

function makeDegradedResult(message: string): OCRResult {
  return {
    text: "",
    confidence: 0.2,
    processingState: "DEGRADED",
    trace: [
      "Tesseract OCR could not complete.",
      message,
    ],
  };
}

export async function runOCRBatch(
  inputs: OCRInput[]
): Promise<OCRResult[]> {
  if (inputs.length === 0) {
    return [];
  }

  let worker:
    | Awaited<ReturnType<typeof createWorker>>
    | null = null;

  const results: OCRResult[] = [];

  try {
    const workerPath = getWorkerPath();

    worker = await createWorker(
      "eng",
      1,
      {
        workerPath,
      }
    );

    for (let index = 0; index < inputs.length; index += 1) {
      const input = inputs[index];

      const trace: string[] = [
        "Starting OCR recognition.",
        `Processing document ${index + 1} of ${inputs.length}.`,
      ];

      try {
        const { data } = await worker.recognize(input);

        const text = data.text?.trim() ?? "";

        if (!text) {
          results.push({
            text: "",
            confidence: 0.25,
            processingState: "DEGRADED",
            trace: [
              ...trace,
              "OCR completed but no readable text was extracted.",
            ],
          });

          continue;
        }

        const confidence =
          typeof data.confidence === "number"
            ? Math.max(
                0,
                Math.min(1, data.confidence / 100)
              )
            : 0.7;

        results.push({
          text,
          confidence,
          processingState:
            confidence < 0.6
              ? "DEGRADED"
              : "NORMAL",
          trace: [
            ...trace,
            `OCR extracted ${text.length} characters.`,
            `OCR confidence: ${(confidence * 100).toFixed(1)}%.`,
          ],
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown OCR recognition error.";

        results.push(
          makeDegradedResult(message)
        );
      }
    }

    return results;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to initialize Tesseract OCR.";

    return inputs.map(() =>
      makeDegradedResult(message)
    );
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        // Ignore cleanup errors.
      }
    }
  }
}

export async function runOCR(
  input: OCRInput
): Promise<OCRResult> {
  const results = await runOCRBatch([input]);

  return (
    results[0] ??
    makeDegradedResult(
      "No OCR result was produced."
    )
  );
}