import policy from "../policy_terms.json";

export type Decision =
  | "APPROVED"
  | "PARTIAL"
  | "REJECTED"
  | "MANUAL_REVIEW";

export type ProcessingState =
  | "NORMAL"
  | "DEGRADED";

export type TreatmentType =
  | "CONSULTATION"
  | "DIAGNOSTIC"
  | "PHARMACY"
  | "DENTAL"
  | "VISION"
  | "ALTERNATIVE_MEDICINE";

export type ClaimInput = {
  employeeId: string;
  treatmentType: TreatmentType;
  amount: number;
  treatmentDate: string;

  diagnosis?: string;
  hospitalName?: string;
  hasPreAuth?: boolean;

  sameDayClaimsBefore?: number;
  monthlyClaimsBefore?: number;
  ytdClaimsAmount?: number;

  simulateComponentFailure?: boolean;

  dentalItems?: {
    description: string;
    amount: number;
  }[];
};

export type DecisionResult = {
  decision: Decision;
  approvedAmount: number;
  reason: string;
  confidence: number;
  processingState: ProcessingState;
  trace: string[];
};

const policyData = policy as any;


/* =========================================================
   HELPERS
========================================================= */

function round2(value: number): number {
  return Math.round(
    (value + Number.EPSILON) * 100
  ) / 100;
}

function normalize(
  value: string | undefined
): string {
  return (value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeList(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === "string"
    )
    .map((item) => normalize(item))
    .filter(Boolean);
}


/* =========================================================
   MEMBER
========================================================= */

function findMember(
  employeeId: string
): any | undefined {
  const members =
    policyData.members ?? [];

  if (!Array.isArray(members)) {
    return undefined;
  }

  return members.find(
    (member: any) =>
      member.member_id === employeeId
  );
}


/* =========================================================
   CATEGORY POLICY
========================================================= */

function getCategoryPolicy(
  treatmentType: TreatmentType
): any {
  const categoryMap: Record<
    TreatmentType,
    string
  > = {
    CONSULTATION: "consultation",
    DIAGNOSTIC: "diagnostic",
    PHARMACY: "pharmacy",
    DENTAL: "dental",
    VISION: "vision",
    ALTERNATIVE_MEDICINE:
      "alternative_medicine",
  };

  const categoryName =
    categoryMap[treatmentType];

  return (
    policyData.opd_categories?.[
      categoryName
    ] ?? {}
  );
}


/* =========================================================
   POLICY VALUES
========================================================= */

function getCategorySublimit(
  treatmentType: TreatmentType
): number {
  const category =
    getCategoryPolicy(
      treatmentType
    );

  const value = Number(
    category.sub_limit
  );

  return Number.isFinite(value)
    ? value
    : 0;
}

function getCopay(
  treatmentType: TreatmentType
): number {
  const category =
    getCategoryPolicy(
      treatmentType
    );

  const value = Number(
    category.copay_percent
  );

  return Number.isFinite(value)
    ? value
    : 0;
}

function getNetworkDiscount(
  treatmentType: TreatmentType
): number {
  const category =
    getCategoryPolicy(
      treatmentType
    );

  const value = Number(
    category.network_discount_percent
  );

  return Number.isFinite(value)
    ? value
    : 0;
}

function getGlobalPerClaimLimit(): number {
  const value = Number(
    policyData.coverage
      ?.per_claim_limit
  );

  return Number.isFinite(value)
    ? value
    : 0;
}

function getMinimumClaimAmount(): number {
  const value = Number(
    policyData.submission_rules
      ?.minimum_claim_amount
  );

  return Number.isFinite(value)
    ? value
    : 0;
}

function getInitialWaitingDays(): number {
  const value = Number(
    policyData.waiting_periods
      ?.initial_waiting_period_days
  );

  return Number.isFinite(value)
    ? value
    : 0;
}


/* =========================================================
   WAITING PERIOD
========================================================= */

function getDiseaseWaitingDays(
  diagnosis: string
): number {
  const conditions =
    policyData.waiting_periods
      ?.specific_conditions ?? {};

  const text =
    normalize(diagnosis);

  const mappings: {
    keywords: string[];
    policyKey: string;
  }[] = [
    {
      keywords: [
        "diabetes",
      ],
      policyKey: "diabetes",
    },
    {
      keywords: [
        "hypertension",
        "high blood pressure",
      ],
      policyKey: "hypertension",
    },
    {
      keywords: [
        "thyroid",
      ],
      policyKey: "thyroid_disorders",
    },
    {
      keywords: [
        "joint replacement",
      ],
      policyKey: "joint_replacement",
    },
    {
      keywords: [
        "maternity",
      ],
      policyKey: "maternity",
    },
    {
      keywords: [
        "mental health",
      ],
      policyKey: "mental_health",
    },
    {
      keywords: [
        "obesity",
      ],
      policyKey: "obesity_treatment",
    },
    {
      keywords: [
        "hernia",
      ],
      policyKey: "hernia",
    },
    {
      keywords: [
        "cataract",
      ],
      policyKey: "cataract",
    },
  ];

  for (
    const mapping of mappings
  ) {
    const matched =
      mapping.keywords.some(
        (keyword) =>
          text.includes(keyword)
      );

    if (matched) {
      const value = Number(
        conditions[
          mapping.policyKey
        ]
      );

      return Number.isFinite(value)
        ? value
        : 0;
    }
  }

  return 0;
}


/* =========================================================
   DATE HELPERS
========================================================= */

function addDays(
  dateString: string,
  days: number
): string {
  const date = new Date(
    `${dateString}T00:00:00`
  );

  date.setDate(
    date.getDate() + days
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function isBefore(
  dateA: string,
  dateB: string
): boolean {
  return (
    new Date(
      `${dateA}T00:00:00`
    ).getTime() <
    new Date(
      `${dateB}T00:00:00`
    ).getTime()
  );
}


/* =========================================================
   NETWORK HOSPITAL
========================================================= */

function isNetworkHospital(
  hospitalName: string
): boolean {
  const hospitals =
    policyData.network_hospitals;

  if (!Array.isArray(hospitals)) {
    return false;
  }

  const hospital =
    normalize(hospitalName);

  if (!hospital) {
    return false;
  }

  return hospitals.some(
    (networkName: string) => {
      const normalizedNetwork =
        normalize(networkName);

      return (
        hospital.includes(
          normalizedNetwork
        ) ||
        normalizedNetwork.includes(
          hospital
        )
      );
    }
  );
}


/* =========================================================
   PRE-AUTH
========================================================= */

function requiresDiagnosticPreAuth(
  input: ClaimInput
): boolean {
  if (
    input.treatmentType !==
    "DIAGNOSTIC"
  ) {
    return false;
  }

  const category =
    getCategoryPolicy(
      "DIAGNOSTIC"
    );

  const diagnosis =
    normalize(input.diagnosis);

  const threshold = Number(
    category.pre_auth_threshold
  );

  const highValueTests =
    normalizeList(
      category
        .high_value_tests_requiring_pre_auth
    );

  const matchedTest =
    highValueTests.some(
      (test) =>
        diagnosis.includes(
          normalize(test)
        )
    );

  if (
    matchedTest &&
    Number.isFinite(threshold)
  ) {
    return (
      input.amount > threshold
    );
  }

  /*
   * If the policy says the category itself
   * requires pre-auth, honor that directly.
   */
  if (
    category.requires_pre_auth === true
  ) {
    return true;
  }

  /*
   * Also inspect the global policy
   * pre-authorization list.
   */
  const globalRules =
    normalizeList(
      policyData.pre_authorization
        ?.required_for
    );

  const globalMatch =
    globalRules.some(
      (rule) => {
        const normalizedRule =
          normalize(rule);

        if (
          normalizedRule.includes(
            "mri"
          ) &&
          diagnosis.includes("mri")
        ) {
          return (
            input.amount > threshold
          );
        }

        if (
          normalizedRule.includes(
            "ct"
          ) &&
          diagnosis.includes("ct")
        ) {
          return (
            input.amount > threshold
          );
        }

        if (
          normalizedRule.includes(
            "pet"
          ) &&
          diagnosis.includes("pet")
        ) {
          return true;
        }

        if (
          normalizedRule.includes(
            "major surgical"
          ) &&
          diagnosis.includes(
            "surgery"
          )
        ) {
          return true;
        }

        if (
          normalizedRule.includes(
            "planned hospitalization"
          ) &&
          diagnosis.includes(
            "hospitalization"
          )
        ) {
          return true;
        }

        return false;
      }
    );

  return globalMatch;
}


/* =========================================================
   EXCLUSIONS
========================================================= */

/*
 * IMPORTANT:
 *
 * Exclusions are policy PHRASES, not individual words.
 *
 * We must NOT do:
 *
 *   text.includes("treatment")
 *
 * because the policy contains:
 *
 *   "Substance abuse treatment"
 *
 * and that would incorrectly reject:
 *
 *   "Dental treatment"
 *   "Alternative medicine treatment"
 *
 * TC006 and TC011 depend on this distinction.
 */

function hasExcludedTreatment(
  diagnosis: string,
  treatmentType: TreatmentType
): string | null {
  const text =
    normalize(diagnosis);

  if (!text) {
    return null;
  }

  /*
   * Dental line-item exclusions are handled
   * by calculateDentalClaim().
   *
   * This prevents "Dental treatment" from
   * becoming a blanket rejection.
   */
  if (
    treatmentType === "DENTAL"
  ) {
    return null;
  }

  /*
   * Vision exclusions are policy-specific.
   */
  if (
    treatmentType === "VISION"
  ) {
    const visionExclusions =
      normalizeList(
        policyData.exclusions
          ?.vision_exclusions
      );

    const matched =
      visionExclusions.find(
        (exclusion) =>
          text.includes(
            exclusion
          )
      );

    if (matched) {
      return matched;
    }
  }

  /*
   * Global policy exclusions.
   */
  const exclusions =
    normalizeList(
      policyData.exclusions
        ?.conditions
    );

  for (
    const exclusion of exclusions
  ) {
    /*
     * First try the complete policy phrase.
     *
     * Example:
     *
     * "bariatric surgery for obesity"
     *
     * matches:
     *
     * "bariatric surgery"
     */
    if (
      text.includes(exclusion)
    ) {
      return exclusion;
    }

    /*
     * For multi-word exclusions,
     * require meaningful terms together.
     *
     * This handles:
     *
     * "Obesity and weight loss programs"
     *
     * against:
     *
     * "obesity / weight loss program"
     */
    const terms =
      exclusion
        .split(/\s+/)
        .filter(
          (term) =>
            term.length >= 4 &&
            ![
              "and",
              "the",
              "for",
              "with",
              "from",
            ].includes(term)
        );

    if (
      terms.length >= 2
    ) {
      const allPresent =
        terms.every(
          (term) => {
            const singular =
              term.endsWith("s")
                ? term.slice(
                    0,
                    -1
                  )
                : term;

            return (
              text.includes(term) ||
              text.includes(
                singular
              )
            );
          }
        );

      if (allPresent) {
        return exclusion;
      }
    }
  }

  return null;
}


/* =========================================================
   FRAUD
========================================================= */

function getSameDayClaimLimit(): number {
  const value = Number(
    policyData.fraud_thresholds
      ?.same_day_claims_limit
  );

  return Number.isFinite(value)
    ? value
    : 0;
}

function getMonthlyClaimLimit(): number {
  const value = Number(
    policyData.fraud_thresholds
      ?.monthly_claims_limit
  );

  return Number.isFinite(value)
    ? value
    : 0;
}

function getHighValueClaimThreshold(): number {
  const value = Number(
    policyData.fraud_thresholds
      ?.high_value_claim_threshold
  );

  return Number.isFinite(value)
    ? value
    : 0;
}

function getFraudManualReviewThreshold(): number {
  const value = Number(
    policyData.fraud_thresholds
      ?.fraud_score_manual_review_threshold
  );

  return Number.isFinite(value)
    ? value
    : 1;
}


/* =========================================================
   STANDARD CALCULATION
========================================================= */

function calculateNormalApproval(
  input: ClaimInput
): {
  approvedAmount: number;
  eligibleAmount: number;
  copayAmount: number;
} {
  const sublimit =
    getCategorySublimit(
      input.treatmentType
    );

  const copay =
    getCopay(
      input.treatmentType
    );

  const eligibleAmount =
    Math.min(
      input.amount,
      sublimit
    );

  const copayAmount =
    eligibleAmount *
    (copay / 100);

  const approvedAmount =
    eligibleAmount -
    copayAmount;

  return {
    approvedAmount:
      round2(
        approvedAmount
      ),

    eligibleAmount:
      round2(
        eligibleAmount
      ),

    copayAmount:
      round2(
        copayAmount
      ),
  };
}


/* =========================================================
   NETWORK CALCULATION
========================================================= */

function calculateNetworkApproval(
  input: ClaimInput
) {
  const discount =
    getNetworkDiscount(
      input.treatmentType
    );

  const copay =
    getCopay(
      input.treatmentType
    );

  /*
   * Policy order:
   *
   * 1. Network discount
   * 2. Copay
   */
  const discountAmount =
    input.amount *
    (discount / 100);

  const discountedAmount =
    input.amount -
    discountAmount;

  const copayAmount =
    discountedAmount *
    (copay / 100);

  const approvedAmount =
    discountedAmount -
    copayAmount;

  return {
    approvedAmount:
      round2(
        approvedAmount
      ),

    discountedAmount:
      round2(
        discountedAmount
      ),

    discountAmount:
      round2(
        discountAmount
      ),

    copayAmount:
      round2(
        copayAmount
      ),
  };
}


/* =========================================================
   DENTAL CALCULATION
========================================================= */

function calculateDentalClaim(
  input: ClaimInput,
  trace: string[]
): DecisionResult | null {
  if (
    input.treatmentType !==
    "DENTAL"
  ) {
    return null;
  }

  if (
    !input.dentalItems ||
    input.dentalItems.length === 0
  ) {
    return null;
  }

  const category =
    getCategoryPolicy(
      "DENTAL"
    );

  const dentalSublimit =
    getCategorySublimit(
      "DENTAL"
    );

  const coveredProcedures =
    normalizeList(
      category.covered_procedures
    );

  const excludedProcedures =
    normalizeList(
      category.excluded_procedures
    );

  let coveredTotal = 0;
  let excludedTotal = 0;

  for (
    const item of input.dentalItems
  ) {
    const description =
      normalize(
        item.description
      );

    const itemAmount =
      Number(item.amount);

    /*
     * First check excluded procedures.
     */
    const excluded =
      excludedProcedures.find(
        (procedure) => {
          return (
            description.includes(
              procedure
            ) ||
            procedure.includes(
              description
            )
          );
        }
      );

    if (excluded) {
      excludedTotal +=
        itemAmount;

      trace.push(
        `${item.description}: ₹${item.amount} excluded under dental policy.`
      );

      continue;
    }

    /*
     * Then check covered procedures.
     */
    const covered =
      coveredProcedures.find(
        (procedure) => {
          return (
            description.includes(
              procedure
            ) ||
            procedure.includes(
              description
            )
          );
        }
      );

    if (covered) {
      coveredTotal +=
        itemAmount;

      trace.push(
        `${item.description}: ₹${item.amount} covered under dental policy.`
      );
    } else {
      excludedTotal +=
        itemAmount;

      trace.push(
        `${item.description}: ₹${item.amount} could not be matched to a covered dental procedure.`
      );
    }
  }

  const approvedAmount =
    round2(
      Math.min(
        coveredTotal,
        dentalSublimit
      )
    );

  trace.push(
    `Dental covered subtotal: ₹${round2(
      coveredTotal
    )}.`
  );

  trace.push(
    `Dental excluded subtotal: ₹${round2(
      excludedTotal
    )}.`
  );

  trace.push(
    `Dental sublimit: ₹${dentalSublimit}.`
  );

  trace.push(
    `Final approved dental amount: ₹${approvedAmount}.`
  );

  /*
   * Nothing covered.
   */
  if (
    approvedAmount <= 0
  ) {
    return {
      decision:
        "REJECTED",

      approvedAmount: 0,

      reason:
        "No submitted dental treatment is covered under the policy.",

      confidence: 0.98,

      processingState:
        "NORMAL",

      trace,
    };
  }

  /*
   * Any excluded item or sublimit reduction
   * makes the claim PARTIAL.
   */
  if (
    excludedTotal > 0 ||
    approvedAmount <
      input.amount
  ) {
    return {
      decision:
        "PARTIAL",

      approvedAmount,

      reason:
        `Dental claim partially approved. Covered amount: ₹${approvedAmount}. Excluded/non-covered amount: ₹${round2(
          input.amount -
            approvedAmount
        )}.`,

      confidence: 0.96,

      processingState:
        "NORMAL",

      trace,
    };
  }

  return {
    decision:
      "APPROVED",

    approvedAmount,

    reason:
      "Dental claim fully approved under the policy.",

    confidence: 0.96,

    processingState:
      "NORMAL",

    trace,
  };
}


/* =========================================================
   MAIN DECISION ENGINE
========================================================= */

export function evaluateClaim(
  input: ClaimInput
): DecisionResult {
  const trace: string[] = [];

  let processingState:
    ProcessingState = "NORMAL";

  const amount =
    Number(input.amount);

  /* =======================================================
     1. MEMBER VERIFICATION
  ======================================================= */

  const member =
    findMember(
      input.employeeId
    );

  if (!member) {
    return {
      decision:
        "MANUAL_REVIEW",

      approvedAmount: 0,

      reason:
        "Employee could not be verified against the policy member roster.",

      confidence: 0.4,

      processingState:
        "DEGRADED",

      trace: [
        "Member lookup failed.",
        "Claim moved to manual review.",
      ],
    };
  }

  trace.push(
    `Member verified: ${
      member.name ??
      input.employeeId
    } (${input.employeeId}).`
  );


  /* =======================================================
     2. MINIMUM CLAIM
  ======================================================= */

  const minimumClaim =
    getMinimumClaimAmount();

  trace.push(
    `Minimum claim amount from policy: ₹${minimumClaim}.`
  );

  if (
    amount < minimumClaim
  ) {
    return {
      decision:
        "REJECTED",

      approvedAmount: 0,

      reason:
        `Claim amount ₹${amount} is below the minimum claim amount of ₹${minimumClaim}.`,

      confidence: 0.99,

      processingState,

      trace,
    };
  }


  /* =======================================================
     3. EXCLUSIONS
  ======================================================= */

  const excludedCondition =
    hasExcludedTreatment(
      input.diagnosis ?? "",
      input.treatmentType
    );

  if (
    excludedCondition
  ) {
    trace.push(
      `Diagnosis/treatment "${input.diagnosis}" matches policy exclusion: "${excludedCondition}".`
    );

    return {
      decision:
        "REJECTED",

      approvedAmount: 0,

      reason:
        "EXCLUDED_CONDITION: The claimed treatment falls under an excluded condition/treatment in the policy.",

      confidence: 0.99,

      processingState,

      trace,
    };
  }


  /* =======================================================
     4. WAITING PERIOD
  ======================================================= */

  const joinDate =
    member.join_date;

  if (joinDate) {
    const initialWaitingDays =
      getInitialWaitingDays();

    const initialEligibleDate =
      addDays(
        joinDate,
        initialWaitingDays
      );

    trace.push(
      `Member joined on ${joinDate}. Initial waiting period: ${initialWaitingDays} days.`
    );

    if (
      isBefore(
        input.treatmentDate,
        initialEligibleDate
      )
    ) {
      return {
        decision:
          "REJECTED",

        approvedAmount: 0,

        reason:
          `WAITING_PERIOD: Initial waiting period applies. Eligible from ${initialEligibleDate}.`,

        confidence: 0.98,

        processingState,

        trace,
      };
    }

    const diseaseWaitingDays =
      getDiseaseWaitingDays(
        input.diagnosis ?? ""
      );

    if (
      diseaseWaitingDays > 0
    ) {
      const diseaseEligibleDate =
        addDays(
          joinDate,
          diseaseWaitingDays
        );

      trace.push(
        `Disease-specific waiting period: ${diseaseWaitingDays} days.`
      );

      trace.push(
        `Eligible date for this condition: ${diseaseEligibleDate}.`
      );

      if (
        isBefore(
          input.treatmentDate,
          diseaseEligibleDate
        )
      ) {
        return {
          decision:
            "REJECTED",

          approvedAmount: 0,

          reason:
            `WAITING_PERIOD: ${input.diagnosis} has a ${diseaseWaitingDays}-day waiting period. Eligible from ${diseaseEligibleDate}.`,

          confidence: 0.99,

          processingState,

          trace,
        };
      }
    }
  }


  /* =======================================================
     5. PRE-AUTHORIZATION
  ======================================================= */

  if (
    requiresDiagnosticPreAuth(
      input
    ) &&
    !input.hasPreAuth
  ) {
    trace.push(
      "High-value diagnostic treatment requires pre-authorization."
    );

    return {
      decision:
        "REJECTED",

      approvedAmount: 0,

      reason:
        "PRE_AUTH_MISSING: High-value diagnostic treatment requires pre-authorization.",

      confidence: 0.99,

      processingState,

      trace,
    };
  }


  /* =======================================================
     6. DENTAL
  ======================================================= */

  const dentalResult =
    calculateDentalClaim(
      input,
      trace
    );

  if (dentalResult) {
    return dentalResult;
  }


  /* =======================================================
     7. FRAUD SIGNALS
  ======================================================= */

  const sameDayClaims =
    input.sameDayClaimsBefore ??
    0;

  const monthlyClaims =
    input.monthlyClaimsBefore ??
    0;

  const sameDayLimit =
    getSameDayClaimLimit();

  const monthlyLimit =
    getMonthlyClaimLimit();

  const highValueThreshold =
    getHighValueClaimThreshold();

  let fraudScore = 0;

  if (
    sameDayClaims >=
    sameDayLimit
  ) {
    fraudScore = 0.85;

    trace.push(
      `Fraud signal: ${sameDayClaims} previous same-day claims detected.`
    );
  }

  if (
    monthlyClaims >=
    monthlyLimit
  ) {
    fraudScore =
      Math.max(
        fraudScore,
        0.82
      );

    trace.push(
      `Fraud signal: ${monthlyClaims} previous monthly claims detected.`
    );
  }

  if (
    amount >
    highValueThreshold
  ) {
    fraudScore =
      Math.max(
        fraudScore,
        0.82
      );

    trace.push(
      `High-value claim signal: ₹${amount} exceeds ₹${highValueThreshold}.`
    );
  }

  if (
    fraudScore >=
    getFraudManualReviewThreshold()
  ) {
    return {
      decision:
        "MANUAL_REVIEW",

      approvedAmount: 0,

      reason:
        "Manual review required because claim activity triggered fraud-pattern signals. The claim is not automatically rejected.",

      confidence: 0.86,

      processingState,

      trace,
    };
  }


  /* =======================================================
     8. GLOBAL PER-CLAIM LIMIT
  ======================================================= */

  const perClaimLimit =
    getGlobalPerClaimLimit();

  trace.push(
    `Global per-claim limit: ₹${perClaimLimit}.`
  );

  /*
   * IMPORTANT:
   *
   * Dental is evaluated before this check because
   * TC006 is an itemized partial claim:
   *
   * ₹12,000 total
   * ₹8,000 covered
   * ₹4,000 excluded
   *
   * The dental sublimit controls the covered amount.
   */

  if (
    input.treatmentType !==
      "DENTAL" &&
    amount >
      perClaimLimit
  ) {
    return {
      decision:
        "REJECTED",

      approvedAmount: 0,

      reason:
        `PER_CLAIM_EXCEEDED: The per-claim limit is ₹${perClaimLimit}, but claimed amount is ₹${amount}.`,

      confidence: 0.99,

      processingState,

      trace,
    };
  }


  /* =======================================================
     9. COMPONENT FAILURE
  ======================================================= */

  if (
    input.simulateComponentFailure
  ) {
    processingState =
      "DEGRADED";

    trace.push(
      "Simulated AI/document component failure detected."
    );

    trace.push(
      "Claim continued using deterministic policy rules."
    );

    const calculation =
      calculateNormalApproval(
        input
      );

    return {
      decision:
        "APPROVED",

      approvedAmount:
        calculation.approvedAmount,

      reason:
        "Claim approved using available policy rules despite a component failure. Manual review is recommended because processing was degraded.",

      confidence: 0.68,

      processingState,

      trace,
    };
  }


  /* =======================================================
     10. NETWORK HOSPITAL
  ======================================================= */

  if (
    input.hospitalName &&
    isNetworkHospital(
      input.hospitalName
    )
  ) {
    const calculation =
      calculateNetworkApproval(
        input
      );

    const discount =
      getNetworkDiscount(
        input.treatmentType
      );

    const copay =
      getCopay(
        input.treatmentType
      );

    trace.push(
      `Network hospital detected: ${input.hospitalName}.`
    );

    trace.push(
      `Network discount: ${discount}%.`
    );

    trace.push(
      `Network discount amount: ₹${calculation.discountAmount}.`
    );

    trace.push(
      `Amount after network discount: ₹${calculation.discountedAmount}.`
    );

    trace.push(
      `Copay: ${copay}%.`
    );

    trace.push(
      `Copay amount: ₹${calculation.copayAmount}.`
    );

    trace.push(
      `Final approved amount: ₹${calculation.approvedAmount}.`
    );

    return {
      decision:
        "APPROVED",

      approvedAmount:
        calculation.approvedAmount,

      reason:
        `Network hospital discount applied first, followed by ${copay}% copay. Final approved amount: ₹${calculation.approvedAmount}.`,

      confidence: 0.95,

      processingState,

      trace,
    };
  }


  /* =======================================================
     11. STANDARD CALCULATION
  ======================================================= */

  const calculation =
    calculateNormalApproval(
      input
    );

  const sublimit =
    getCategorySublimit(
      input.treatmentType
    );

  const copay =
    getCopay(
      input.treatmentType
    );

  trace.push(
    `Category sublimit: ₹${sublimit}.`
  );

  trace.push(
    `Eligible amount after sublimit: ₹${calculation.eligibleAmount}.`
  );

  trace.push(
    `Copay: ${copay}%.`
  );

  trace.push(
    `Copay amount: ₹${calculation.copayAmount}.`
  );

  trace.push(
    `Final approved amount: ₹${calculation.approvedAmount}.`
  );


  /* =======================================================
     12. FINAL DECISION
  ======================================================= */

  /*
   * Copay alone does NOT make a claim PARTIAL.
   *
   * Example:
   *
   * Claim       ₹1500
   * Sublimit    ₹2000
   * Eligible    ₹1500
   * Copay       10%
   * Approved    ₹1350
   *
   * Result:
   * APPROVED ₹1350
   */

  if (
    calculation.eligibleAmount <
    amount
  ) {
    return {
      decision:
        "PARTIAL",

      approvedAmount:
        calculation.approvedAmount,

      reason:
        `Claim partially approved because the eligible amount was limited by the category sublimit. ${copay}% copay was then applied.`,

      confidence: 0.95,

      processingState,

      trace,
    };
  }

  return {
    decision:
      "APPROVED",

    approvedAmount:
      calculation.approvedAmount,

    reason:
      `Claim approved under the policy. ${copay}% copay applied.`,

    confidence: 0.95,

    processingState,

    trace,
  };
}