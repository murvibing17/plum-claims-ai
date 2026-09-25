import path from "node:path";
import { createWorker } from "tesseract.js";

export interface OCRResult {
  text: string;
  confidence: number;
  processingState: "NORMAL" | "DEGRADED";
  trace: string[];
}

type OCRInput = string | Buffer;

function makeDegradedResult(
  message: string
): OCRResult {
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

function getWorkerPath() {
  return path.join(
    process.cwd(),
    "node_modules",
    "tesseract.js",
    "src",
    "worker-script",
    "node",
    "index.js"
  );
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

  try {
    /*
     * IMPORTANT:
     *
     * Do not load the worker by require().
     * Tesseract expects this file to run inside
     * its own worker thread.
     */
    worker = await createWorker(
      "eng",
      1,
      {
        workerPath: getWorkerPath(),
        logger: () => {
          // Keep server logs quiet.
          // OCR progress is represented in our own trace.
        },
      }
    );

    const results: OCRResult[] = [];

    for (
      let index = 0;
      index < inputs.length;
      index += 1
    ) {
      const input = inputs[index];

      const trace = [
        "Starting OCR recognition.",
        `Processing document ${index + 1} of ${inputs.length}.`,
      ];

      try {
        const result =
          await worker.recognize(input);

        const text =
          result.data.text?.trim() ?? "";

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

        const rawConfidence =
          typeof result.data.confidence ===
          "number"
            ? result.data.confidence
            : 70;

        const confidence =
          Math.max(
            0,
            Math.min(
              1,
              rawConfidence / 100
            )
          );

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
          makeDegradedResult(
            `Document ${index + 1}: ${message}`
          )
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
        // Ignore worker cleanup errors.
      }
    }
  }
}

export async function runOCR(
  input: OCRInput
): Promise<OCRResult> {
  const results =
    await runOCRBatch([input]);

  return (
    results[0] ??
    makeDegradedResult(
      "No OCR result was produced."
    )
  );
}