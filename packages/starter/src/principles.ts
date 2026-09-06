export const PRACTICE_PRINCIPLES = {
  minimumUsefulChange: "practice.minimum-useful-change",
  reuseBeforeNewCode: "practice.reuse-before-new-code",
  dependencyRestraint: "practice.dependency-restraint",
  fixCauses: "practice.fix-causes",
  contextEconomy: "practice.context-economy",
  conciseHandoff: "practice.concise-handoff",
  preserveSafety: "practice.preserve-safety",
  meaningfulVerification: "practice.meaningful-verification",
  costDiscipline: "practice.cost-discipline",
} as const;

export type PracticePrincipleId =
  (typeof PRACTICE_PRINCIPLES)[keyof typeof PRACTICE_PRINCIPLES];

export const starterPracticePrinciples: Readonly<Record<string, readonly PracticePrincipleId[]>> = {
  "@rack-starter/honey.method.minimum-code": [
    PRACTICE_PRINCIPLES.minimumUsefulChange,
    PRACTICE_PRINCIPLES.reuseBeforeNewCode,
    PRACTICE_PRINCIPLES.dependencyRestraint,
  ],
  "@rack-starter/honey.method.fix-causes": [PRACTICE_PRINCIPLES.fixCauses],
  "@rack-starter/honey.method.context-economy": [PRACTICE_PRINCIPLES.contextEconomy],
  "@rack-starter/honey.craft.deliberate-shortcuts": [PRACTICE_PRINCIPLES.minimumUsefulChange],
  "@rack-starter/honey.voice.concise-engineering": [PRACTICE_PRINCIPLES.conciseHandoff],
  "@rack-starter/honey.method.agent-wire": [PRACTICE_PRINCIPLES.conciseHandoff],
  "@rack-starter/honey.guardrail.no-false-economy": [
    PRACTICE_PRINCIPLES.preserveSafety,
    PRACTICE_PRINCIPLES.meaningfulVerification,
  ],
  "@rack-starter/honey.task.lean-review": [
    PRACTICE_PRINCIPLES.minimumUsefulChange,
    PRACTICE_PRINCIPLES.reuseBeforeNewCode,
    PRACTICE_PRINCIPLES.dependencyRestraint,
    PRACTICE_PRINCIPLES.preserveSafety,
  ],
  "@rack-starter/craft.dependency-discipline": [PRACTICE_PRINCIPLES.dependencyRestraint],
  "@rack-starter/guardrail.security": [PRACTICE_PRINCIPLES.preserveSafety],
  "@rack-starter/guardrail.change-verification": [PRACTICE_PRINCIPLES.meaningfulVerification],
};

export const getStarterPracticePrinciples = (moduleId: string): readonly PracticePrincipleId[] =>
  starterPracticePrinciples[moduleId] ?? [];
