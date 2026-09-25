import { extractClaimOCR } from "@/lib/claim-ocr";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  request: Request
) {
  try {
    const formData =
      await request.formData();

    const files =
      formData.getAll("files");

    const uploadedFiles =
      files.filter(
        (file): file is File =>
          file instanceof File
      );

    if (
      uploadedFiles.length === 0
    ) {
      return Response.json(
        {
          success: false,
          error:
            "No claim documents were provided.",
          processingState: "DEGRADED",
        },
        {
          status: 400,
        }
      );
    }

    const result =
      await extractClaimOCR(
        uploadedFiles
      );

    return Response.json(result);
  } catch (error) {
    console.error(
      "Claim OCR API error:",
      error
    );

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown OCR processing error.",
        processingState:
          "DEGRADED",
      },
      {
        status: 500,
      }
    );
  }
}