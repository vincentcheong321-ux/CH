
export const YEAR = 2025;

export const MONTH_NAMES = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
];

// Data Structure: [Month Index 0-11]: { type: [days] }
export const DRAW_DATES: Record<number, { w: number[], s1: number[], s2: number[], t: number[] }> = {
  0: { w: [1,8,15,22,29], s1: [4,11,18,25], s2: [5,12,19,26], t: [28] }, // JAN
  1: { w: [5,12,19,26], s1: [1,8,15,22], s2: [2,9,16,23], t: [4,11] }, // FEB
  2: { w: [5,12,19,26], s1: [1,8,15,22,29], s2: [2,9,16,23,30], t: [] }, // MAR
  3: { w: [2,9,16,23,30], s1: [5,12,19,26], s2: [6,13,20,27], t: [29] }, // APR
  4: { w: [7,14,21,28], s1: [3,10,17,24,31], s2: [4,11,18,25], t: [27] }, // MAY
  5: { w: [4,11,18,25], s1: [7,14,21,28], s2: [1,8,15,22,29], t: [] }, // JUN
  6: { w: [2,9,16,23,30], s1: [5,12,19,26], s2: [6,13,20,27], t: [29] }, // JUL
  7: { w: [6,13,20,27], s1: [2,9,16,23,30], s2: [3,10,17,24,31], t: [] }, // AUG
  8: { w: [3,10,17,24], s1: [6,13,20,27], s2: [7,14,21,28], t: [] }, // SEP
  9: { w: [1,8,15,22,29], s1: [4,11,18,25], s2: [5,12,19,26], t: [28] }, // OCT
  10: { w: [5,12,19,26], s1: [1,8,15,22,29], s2: [2,9,16,23,30], t: [] }, // NOV
  11: { w: [3,10,17,24,31], s1: [6,13,20,27], s2: [7,14,21,28], t: [] }, // DEC
};

export const getWeekNumber = (d: Date) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
};

export const getWeeksForMonth = (monthIndex: number) => {
    const currentMonthData = DRAW_DATES[monthIndex];
      if (!currentMonthData) return {};
      const allDays = Array.from(new Set([...currentMonthData.w, ...currentMonthData.s1, ...currentMonthData.s2, ...currentMonthData.t])).sort((a,b) => a-b);
      const weeks: Record<number, number[]> = {};
      allDays.forEach(day => {
          const date = new Date(YEAR, monthIndex, day);
          const weekNum = getWeekNumber(date);
          if (!weeks[weekNum]) weeks[weekNum] = [];
          weeks[weekNum].push(day);
      });
      return weeks;
}
