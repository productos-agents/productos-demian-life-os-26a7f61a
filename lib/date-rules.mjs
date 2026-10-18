export function mexicoDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  return part("year") + "-" + part("month") + "-" + part("day");
}
