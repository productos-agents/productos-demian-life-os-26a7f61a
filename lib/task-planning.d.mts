export type TaskForPlanning = {
  dueDate?: string | null;
  category?: string | null;
  createdAt?: string | Date | null;
};
export function compareTasks(a: TaskForPlanning, b: TaskForPlanning): number;
