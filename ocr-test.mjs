import { createWorker } from "tesseract.js";

const worker = await createWorker("eng");

const { data } = await worker.recognize(
  "https://tesseract.projectnaptha.com/img/eng_bw.png"
);

console.log("\n===== OCR RESULT =====\n");
console.log(data.text);

await worker.terminate();