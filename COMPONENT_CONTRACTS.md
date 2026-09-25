# Plum AI Claims Review — Component Contracts

## 1. Document Verification

**Module:** `lib/document-checker.ts`

### Input

```ts
{
  treatmentType: TreatmentType;
  filenames: string[];
  unreadableFiles: string[];
  patientNames: string[];
}