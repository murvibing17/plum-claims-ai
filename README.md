# Plum Claims AI

AI-powered employee health insurance claim review system that automates document verification, document extraction, policy evaluation, fraud detection, and explainable claim decisions.

## Live Demo

- **Live App:** https://plum-claims-ai-coral.vercel.app
- **GitHub:** https://github.com/murvibing17/plum-claims-ai

---
## Project Highlights

- **Policy-driven:** reads insurance rules from `policy_terms.json`
- **Document-first:** validates required documents before decisioning
- **Explainable:** every decision includes reasons, calculations, and processing trace
- **Resilient:** component failures produce controlled degraded states
- **Fraud-aware:** suspicious claims can be routed to `MANUAL_REVIEW`
- **Tested:** 12/12 evaluation scenarios passing
- **Deployed:** production application available on Vercel

## Overview

Plum Claims AI processes employee health insurance claims through a structured pipeline:

```text
Claim Intake
    ↓
Document Verification
    ↓
OCR / Document Extraction
    ↓
Policy Evaluation
    ↓
Fraud / Risk Checks
    ↓
Decision
    ↓
Explainable Decision Trace