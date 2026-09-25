import { runOCR } from "@/lib/ocr";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json(
        {
          success: false,
          error: "No document file was provided.",
        },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/jpg",
    ];

    if (!allowedTypes.includes(file.type)) {
      return Response.json(
        {
          success: false,
          error:
            "For the first OCR test, please upload a JPG, PNG, or WebP image.",
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await runOCR(buffer);

    return Response.json({
      success: true,
      fileName: file.name,
      fileType: file.type,
      ...result,
    });
  } catch (error) {
    console.error("OCR API error:", error);

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown OCR processing error.",
        processingState: "DEGRADED",
      },
      { status: 500 }
    );
  }
}