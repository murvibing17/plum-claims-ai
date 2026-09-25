"use client";

import { useState } from "react";

export default function OCRTestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function runOCR() {
    if (!file) {
      setResult("Please select an image first.");
      return;
    }

    setLoading(true);
    setResult("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/ocr2", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: "800px",
        margin: "40px auto",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>OCR Test</h1>

      <p>
        Upload a JPG, PNG, or WebP image and test local Tesseract OCR.
      </p>

      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null);
          setResult("");
        }}
      />

      <div style={{ marginTop: "20px" }}>
        <button
          onClick={runOCR}
          disabled={!file || loading}
          style={{
            padding: "10px 20px",
            cursor: file && !loading ? "pointer" : "not-allowed",
          }}
        >
          {loading ? "Running OCR..." : "Run OCR"}
        </button>
      </div>

      {file && (
        <p style={{ marginTop: "20px" }}>
          Selected: <strong>{file.name}</strong>
        </p>
      )}

      {result && (
        <pre
          style={{
            marginTop: "20px",
            padding: "20px",
            background: "#f4f4f4",
            borderRadius: "8px",
            whiteSpace: "pre-wrap",
            overflowX: "auto",
          }}
        >
          {result}
        </pre>
      )}
    </main>
  );
}