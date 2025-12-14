
export const YEAR = 2025; // Default/Fallback

export const MONTH_NAMES = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
];

// Data Structure: [Month Index 0-11]: { type: [days] }
// NOTE: Overflow days (e.g. 32, 33) are used to group dates from the start of the next month into the current month's weeks.

// 2025 Configuration
export const DRAW_DATES: Record<number, { w: number[], s1: number[], s2: number[], t: number[] }> = {
  0: { w: [1,8,15,22,29], s1: [4,11,18,25,32], s2: [5,12,19,26,33], t: [28] }, // JAN (32=Feb1, 33=Feb2)
  1: { w: [5,12,19,26], s1: [8,15,22,29], s2: [9,16,23,30], t: [4,11] }, // FEB (1,2 rmv. 29=Mar1, 30=Mar2)
  2: { w: [5,12,19,26], s1: [8,15,22,29], s2: [9,16,23,30], t: [] }, // MAR (1,2 rmv. Normal end)
  3: { w: [2,9,16,23,30], s1: [5,12,19,26,33], s2: [6,13,20,27,34], t: [29] }, // APR (33=May3, 34=May4)
  4: { w: [7,14,21,28], s1: [10,17,24,31], s2: [11,18,25,32], t: [27] }, // MAY (3,4 rmv. 32=Jun1)
  5: { w: [4,11,18,25], s1: [7,14,21,28], s2: [8,15,22,29], t: [] }, // JUN (1 rmv. Normal end)
  6: { w: [2,9,16,23,30], s1: [5,12,19,26,33], s2: [6,13,20,27,34], t: [29] }, // JUL (33=Aug2, 34=Aug3)
  7: { w: [6,13,20,27], s1: [9,16,23,30], s2: [10,17,24,31], t: [] }, // AUG (2,3 rmv. Normal end)
  8: { w: [3,10,17,24], s1: [6,13,20,27], s2: [7,14,21,28], t: [] }, // SEP (Normal end)
  9: { w: [1,8,15,22,29], s1: [4,11,18,25,32], s2: [5,12,19,26,33], t: [28] }, // OCT (32=Nov1, 33=Nov2)
  10: { w: [5,12,19,26], s1: [8,15,22,29], s2: [9,16,23,30], t: [] }, // NOV (1,2 rmv. Normal end)
  11: { w: [3,10,17,24,31], s1: [6,13,20,27,34], s2: [7,14,21,28,35], t: [] }, // DEC (34=Jan3, 35=Jan4)
};

// 2026 Configuration
export const DRAW_DATES_2026: Record<number, { w: number[], s1: number[], s2: number[], t: number[] }> = {
  0: { w: [7,14,21,28], s1: [3,10,17,24,31], s2: [4,11,18,25,32], t: [1, 27] }, // JAN (1=NewYear, 27=Tue, 32=Feb1)
  1: { w: [4,11,18,25], s1: [7,14,21,28], s2: [8,15,22,29], t: [] }, // FEB (1 removed. 29=Mar1)
  2: { w: [4,11,18,25], s1: [7,14,21,28], s2: [8,15,22,29], t: [] }, // MAR (1 removed. Ends cleanly)
  3: { w: [1,8,15,22,29], s1: [4,11,18,25,32], s2: [5,12,19,26,33], t: [] }, // APR (32=May2, 33=May3)
  4: { w: [6,13,20,27], s1: [9,16,23,30], s2: [10,17,24,31], t: [] }, // MAY (2,3 removed. Ends cleanly)
  5: { w: [3,10,17,24], s1: [6,13,20,27], s2: [7,14,21,28], t: [] }, // JUN
  6: { w: [1,8,15,22,29], s1: [4,11,18,25,32], s2: [5,12,19,26,33], t: [] }, // JUL (32=Aug1, 33=Aug2)
  7: { w: [5,12,19,26], s1: [8,15,22,29], s2: [9,16,23,30], t: [] }, // AUG (1,2 removed. Ends cleanly)
  8: { w: [2,9,16,23,30], s1: [5,12,19,26,33], s2: [6,13,20,27,34], t: [] }, // SEP (33=Oct3, 34=Oct4)
  9: { w: [7,14,21,28], s1: [10,17,24,31], s2: [11,18,25,32], t: [] }, // OCT (3,4 removed. 32=Nov1)
  10: { w: [4,11,18,25], s1: [7,14,21,28], s2: [8,15,22,29], t: [] }, // NOV (1 removed. Ends cleanly)
  11: { w: [2,9,16,23,30], s1: [5,12,19,26,33], s2: [6,13,20,27,34], t: [] }, // DEC (33=Jan2, 34=Jan3)
};

export const getWeekNumber = (d: Date) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
};

export const getWeeksForMonth = (year: number, monthIndex: number) => {
    // Check if we are using 2026 or 2025
    const currentMonthData = year === 2026 ? DRAW_DATES_2026[monthIndex] : DRAW_DATES[monthIndex];
      
    if (!currentMonthData) return {};
    
    const allDays = Array.from(new Set([...currentMonthData.w, ...currentMonthData.s1, ...currentMonthData.s2, ...currentMonthData.t])).sort((a,b) => a-b);
    const weeks: Record<number, number[]> = {};
    
    allDays.forEach(day => {
        // Construct date using the day. Overflow days (32, 33) automatically roll over to next month.
        const date = new Date(year, monthIndex, day);
        let weekNum = getWeekNumber(date);
        
        // FIX: Handle Year-End Week Wrapping
        if (monthIndex === 11 && weekNum === 1) {
            weekNum = 53;
        }

        if (!weeks[weekNum]) weeks[weekNum] = [];
        weeks[weekNum].push(day);
    });
    return weeks;
}
