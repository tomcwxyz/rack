export type SetupInstructionSelection =
  | "binding"
  | "default"
  | "include"
  | "exclude"
  | "unused";

type SelectionContext = {
  moduleId: string;
  include: readonly string[];
  exclude: readonly string[];
  sharedBindingIds?: readonly string[];
  sharedAdaptableDefaultIds?: readonly string[];
};

const contains = (values: readonly string[] | undefined, id: string): boolean =>
  values?.includes(id) ?? false;

export const setupInstructionSelection = ({
  moduleId,
  include,
  exclude,
  sharedBindingIds,
  sharedAdaptableDefaultIds,
}: SelectionContext): SetupInstructionSelection => {
  if (contains(sharedBindingIds, moduleId)) return "binding";
  if (include.includes(moduleId)) return "include";
  if (exclude.includes(moduleId)) return "exclude";
  if (contains(sharedAdaptableDefaultIds, moduleId)) return "default";
  return "unused";
};

export const updateSetupInstructionSelection = (
  moduleId: string,
  selection: SetupInstructionSelection,
  include: readonly string[],
  exclude: readonly string[],
): { include: string[]; exclude: string[] } => {
  const nextInclude = include.filter((id) => id !== moduleId);
  const nextExclude = exclude.filter((id) => id !== moduleId);

  if (selection === "include") nextInclude.push(moduleId);
  if (selection === "exclude") nextExclude.push(moduleId);

  return {
    include: [...new Set(nextInclude)],
    exclude: [...new Set(nextExclude)],
  };
};
