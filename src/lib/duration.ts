/** 60 → "60 мин", 180 → "3 часа", 300 → "5 часов", 90 → "90 мин" (as in the service menu design). */
export function duration(min: number): string {
  if (min >= 120 && min % 60 === 0) {
    const h = min / 60;
    const word = h % 10 === 1 && h % 100 !== 11 ? "час" : h % 10 >= 2 && h % 10 <= 4 && (h % 100 < 12 || h % 100 > 14) ? "часа" : "часов";
    return `${h} ${word}`;
  }
  return `${min} мин`;
}
