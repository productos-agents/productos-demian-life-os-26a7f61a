const priorityWeight = (category) => category === "Alta" ? 0 : category === "Baja" ? 2 : 1;

/** Sort dated tasks by deadline, then priority, then most recently edited/created. Undated tasks go last. */
export function compareTasks(a, b) {
  const dueA = a.dueDate || "9999-12-31";
  const dueB = b.dueDate || "9999-12-31";
  return dueA.localeCompare(dueB)
    || priorityWeight(a.category) - priorityWeight(b.category)
    || String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
}
