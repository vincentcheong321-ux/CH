
export const YEAR = new Date().getFullYear();

export const MONTH_NAMES = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
];

// Helper to get total days in a month
const getDaysInMonth = (year: number, monthIndex: number) => {
    return new Date(year, monthIndex + 1, 0).getDate();
};

/**
 * Generates weeks for a given month/year.
 * It ensures weeks are always full 7-day cycles (Sunday to Saturday).
 * Week 1 is the week that contains the 1st of the month.
 * 
 * Returns: { 1: [Date, Date...], 2: [Date...] }
 */
export const getWeeksForMonth = (year: number, monthIndex: number): Record<number, Date[]> => {
    const weeks: Record<number, Date[]> = {};
    const firstDayOfMonth = new Date(year, monthIndex, 1);
    const lastDayOfMonth = new Date(year, monthIndex + 1, 0);
    
    // Backtrack to the Sunday of the week containing the 1st
    // getDay() returns 0 for Sunday, 1 for Monday, etc.
    const startDayOfWeek = firstDayOfMonth.getDay(); 
    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(firstDayOfMonth.getDate() - startDayOfWeek);

    let currentWeekNum = 1;
    let currentDate = new Date(startDate);

    // Iterate until the start of the week is beyond the last day of the month
    // We include any week that starts on or before the last day of the month.
    // This ensures we cover all days in the current month.
    while (currentDate <= lastDayOfMonth) {
        const weekDays: Date[] = [];
        
        // Build a full 7-day week
        for (let i = 0; i < 7; i++) {
            weekDays.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        weeks[currentWeekNum] = weekDays;
        currentWeekNum++;
        // currentDate is now at the start of the next week
    }
    
    return weeks;
};

// Signature updated to accept Date[] directly. 
// Year/Month params kept for backwards compatibility in call sites if needed, but unused.
export const getWeekRangeString = (year: number | null, monthIndex: number | null, days: Date[]) => {
    if (!days || days.length === 0) return '';
    
    const start = days[0];
    const end = days[days.length - 1];
    
    const fmt = (d: Date) => {
        const m = MONTH_NAMES[d.getMonth()].slice(0, 3);
        const day = d.getDate().toString().padStart(2, '0');
        return `${day} ${m}`;
    };
    
    return `${fmt(start)} - ${fmt(end)}`;
};
