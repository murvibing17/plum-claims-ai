import { createWorker } from "tesseract.js";

export interface OCRResult {
  text: string;
  confidence: number;
  processingState: "NORMAL" | "DEGRADED";
  trace: string[];
}

export async function runOCR(
  input: string | Buffer
): Promise<OCRResult> {
  const trace: string[] = [];

  let worker;

  try {
    trace.push("Starting local Tesseract OCR.");

    worker = await createWorker("eng", 1, {
      workerPath:
        "./node_modules/tesseract.js/src/worker-script/node/index.js",
    });

    trace.push("Tesseract English language model loaded.");

    const { data } = await worker.recognize(input);

    const text = data.text?.trim() ?? "";

    if (!text) {
      trace.push("OCR completed but no readable text was extracted.");

      return {
        text: "",
        confidence: 0.25,
        processingState: "DEGRADED",
        trace,
      };
    }

    const confidence =
      typeof data.confidence === "number"
        ? Math.max(0, Math.min(1, data.confidence / 100))
        : 0.7;

    trace.push(`OCR extracted ${text.length} characters.`);
    trace.push(
      `OCR confidence: ${(confidence * 100).toFixed(1)}%.`
    );

    return {
      text,
      confidence,
      processingState:
        confidence < 0.6 ? "DEGRADED" : "NORMAL",
      trace,
    };
  } catch (error) {
    trace.push("Tesseract OCR failed.");

    trace.push(
      error instanceof Error
        ? error.message
        : "Unknown OCR error."
    );

    return {
      text: "",
      confidence: 0.2,
      processingState: "DEGRADED",
      trace,
    };
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