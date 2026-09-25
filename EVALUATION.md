# Plum AI Claims Review — Evaluation Report

## 1. Evaluation Overview

The claim-review system was evaluated against 12 representative scenarios covering:

- Document validation failures.
- OCR/readability failures.
- Patient mismatch.
- Standard approvals.
- Waiting periods.
- Partial dental coverage.
- Pre-authorization.
- Per-claim limits.
- Fraud-pattern detection.
- Network discounts.
- Component failure.
- Excluded treatments.

The automated evaluation suite contains 12 cases.

## 2. Evaluation Results

| Case | Scenario | Expected Result | Result |
|---|---|---|---|
| TC001 | Wrong document | Stop processing | PASS |
| TC002 | Unreadable document | Stop and request re-upload | PASS |
| TC003 | Different patients | Stop processing | PASS |
| TC004 | Clean consultation | APPROVED | PASS |
| TC005 | Diabetes waiting period | REJECTED | PASS |
| TC006 | Dental partial coverage | PARTIAL | PASS |
| TC007 | MRI without pre-auth | REJECTED | PASS |
| TC008 | Per-claim limit exceeded | REJECTED | PASS |
| TC009 | Fraud pattern | MANUAL_REVIEW | PASS |
| TC010 | Network discount | APPROVED | PASS |
| TC011 | Component failure | APPROVED / DEGRADED | PASS |
| TC012 | Excluded obesity treatment | REJECTED | PASS |

**Overall evaluation result: 12/12 PASS**

## 3. Case Details

### TC001 — Wrong Document

**Scenario**

A consultation claim is submitted with two prescription documents instead of the required prescription and hospital bill.

**Expected behavior**

The system should stop before policy evaluation and identify the incorrect document set.

**Result**

PASS.

The document verification layer detects the duplicate/wrong document combination and prevents the claim from proceeding.

---

### TC002 — Unreadable Document

**Scenario**

A pharmacy claim contains a valid prescription and an unreadable pharmacy bill.

**Expected behavior**

The system should stop processing and identify the unreadable document.

**Result**

PASS.

The verification workflow identifies the unreadable document and requests a readable re-upload.

---

### TC003 — Different Patients

**Scenario**

The prescription belongs to Rajesh Kumar while the hospital bill belongs to another patient.

**Expected behavior**

The system should stop processing because the documents do not belong to the same patient.

**Result**

PASS.

The verification layer detects the patient mismatch.

---

### TC004 — Clean Consultation

**Scenario**

A valid consultation claim for ₹1,500 is submitted.

**Expected behavior**

The claim should be approved after the applicable 10% copay.

**Expected approved amount**

₹1,350.

**Result**

PASS.

---

### TC005 — Waiting Period

**Scenario**

EMP005 joined on 2024-09-01 and submits diabetes treatment dated 2024-10-15.

**Expected behavior**

The claim should be rejected because the applicable diabetes waiting period has not elapsed.

**Result**

PASS.

---

### TC006 — Dental Partial Approval

**Scenario**

The dental claim contains:

- Root Canal — ₹8,000.
- Whitening — ₹4,000.

Root Canal is covered while Whitening is excluded.

**Expected behavior**

The covered portion should be approved while the excluded portion should not be payable.

**Expected approved amount**

₹8,000.

**Result**

PASS.

---

### TC007 — MRI Without Pre-Authorization

**Scenario**

A diagnostic MRI claim of ₹15,000 is submitted without required pre-authorization.

**Expected behavior**

The claim should be rejected for missing pre-authorization.

**Result**

PASS.

---

### TC008 — Per-Claim Limit

**Scenario**

A consultation claim of ₹7,500 is submitted against a ₹5,000 per-claim limit.

**Expected behavior**

The claim should be rejected because it exceeds the applicable per-claim limit.

**Result**

PASS.

---

### TC009 — Fraud Pattern

**Scenario**

EMP008 already has three same-day claims before the current claim.

**Expected behavior**

The claim should be routed to manual review based on the configured fraud signals.

It should not be automatically rejected as fraudulent.

**Result**

PASS.

---

### TC010 — Network Discount

**Scenario**

A ₹4,500 consultation is submitted from Apollo Hospitals.

**Expected calculation**

```text
Claim amount        ₹4,500
20% network discount ₹900
Eligible amount     ₹3,600
10% copay            ₹360
Approved amount     ₹3,240