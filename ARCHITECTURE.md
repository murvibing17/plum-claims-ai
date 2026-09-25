# Plum AI Claims Review — Architecture

## 1. System Overview

The system automates employee health-insurance claim review using a staged pipeline:

Documents
→ Verification
→ OCR / Extraction
→ Policy Evaluation
→ Decision
→ Explainable Trace

The system is designed to stop early when required documents are invalid, continue in degraded mode when non-critical components fail, and produce an explainable decision for every claim that reaches policy evaluation.

---

## 2. High-Level Architecture

```text
                         ┌──────────────────────┐
                         │      Claim Intake    │
                         │  Documents + Claim   │
                         │       Metadata       │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ Document Verification│
                         │                      │
                         │ • Required documents │
                         │ • Wrong documents    │
                         │ • Duplicates         │
                         │ • Readability        │
                         │ • Patient matching   │
                         └──────────┬───────────┘
                                    │
                         invalid ───┤─── valid
                           STOP     │
                                    ▼
                         ┌──────────────────────┐
                         │ OCR / Extraction     │
                         │                      │
                         │ • OCR text           │
                         │ • Document type      │
                         │ • Structured fields  │
                         │ • Confidence         │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ Policy Evaluation    │
                         │                      │
                         │ policy_terms.json    │
                         │ • Coverage           │
                         │ • Sublimits          │
                         │ • Copay              │
                         │ • Waiting periods    │
                         │ • Exclusions         │
                         │ • Pre-auth            │
                         │ • Fraud thresholds   │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ Decision Engine      │
                         │                      │
                         │ APPROVED             │
                         │ PARTIAL              │
                         │ REJECTED             │
                         │ MANUAL_REVIEW        │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ Explainable Output   │
                         │                      │
                         │ • Approved amount    │
                         │ • Reason             │
                         │ • Confidence         │
                         │ • Processing state   │
                         │ • Decision trace     │
                         └──────────────────────┘