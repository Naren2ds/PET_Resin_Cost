export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function getYearOptions(startYear = 2018, endYear = 2026) {
  const years: string[] = [];
  for (let year = startYear; year <= endYear; year += 1) {
    years.push(String(year));
  }
  return years;
}

export function getMonthOptions(selectedYear: string, _destination?: string) {
  if (!selectedYear) return MONTHS;
  const year = Number(selectedYear);

  if (year === 2018) {
    return MONTHS.slice(6);
  }
  if (year === 2026) {
    return MONTHS;
  }
  return MONTHS;
}

