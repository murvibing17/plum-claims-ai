export type ClaimHistoryRecord = {
  employeeId: string;
  treatmentDate: string;
  claimId: string;
};

const claimHistory: ClaimHistoryRecord[] = [
  {
    claimId: "HIST-001",
    employeeId: "EMP008",
    treatmentDate: "2024-08-10",
  },
  {
    claimId: "HIST-002",
    employeeId: "EMP008",
    treatmentDate: "2024-08-10",
  },
  {
    claimId: "HIST-003",
    employeeId: "EMP008",
    treatmentDate: "2024-08-10",
  },
  {
    claimId: "HIST-004",
    employeeId: "EMP008",
    treatmentDate: "2024-08-05",
  },
  {
    claimId: "HIST-005",
    employeeId: "EMP008",
    treatmentDate: "2024-08-06",
  },
];

export function getClaimHistorySignals(
  employeeId: string,
  treatmentDate: string
) {
  const targetDate = new Date(`${treatmentDate}T00:00:00`);

  const sameDayClaimsBefore = claimHistory.filter(
    (claim) =>
      claim.employeeId === employeeId &&
      claim.treatmentDate === treatmentDate
  ).length;

  const monthlyClaimsBefore = claimHistory.filter((claim) => {
    if (claim.employeeId !== employeeId) {
      return false;
    }

    const claimDate = new Date(`${claim.treatmentDate}T00:00:00`);

    return (
      claimDate.getFullYear() === targetDate.getFullYear() &&
      claimDate.getMonth() === targetDate.getMonth()
    );
  }).length;

  return {
    sameDayClaimsBefore,
    monthlyClaimsBefore,
  };
}