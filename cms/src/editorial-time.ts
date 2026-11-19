const zone = "America/Sao_Paulo";
const formatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: zone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const localTime = (date: Date) => formatter.format(date).replace(" ", "T");
export const brasiliaDisplay = (utc: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: zone,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(utc));
export function brasiliaToUtc(local: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw new Error("Data e hora inválidas.");
  // Resolve through IANA time zone rules rather than the browser's local zone
  // or a permanent hard-coded UTC offset.
  const target = Date.parse(local + ":00Z");
  let utc = target;
  for (let i = 0; i < 3; i++)
    utc += target - Date.parse(localTime(new Date(utc)) + ":00Z");
  if (localTime(new Date(utc)) !== local)
    throw new Error("Horário inexistente em São Paulo.");
  return new Date(utc).toISOString();
}
export function nextBrasiliaFive(at = new Date()) {
  const date = localTime(at).slice(0, 10);
  let candidate = date + "T05:00";
  if (Date.parse(brasiliaToUtc(candidate)) <= at.getTime()) {
    const tomorrow = new Date(date + "T12:00:00Z");
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    candidate = tomorrow.toISOString().slice(0, 10) + "T05:00";
  }
  return candidate;
}
