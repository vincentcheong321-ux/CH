
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
 * It ensures weeks are always full 7-day cycles (Monday to Sunday).
 * Week 1 is the week that contains the 1st of the month.
 * 
 * Returns: { 1: [Date, Date...], 2: [Date...] }
 */
export const getWeeksForMonth = (year: number, monthIndex: number): Record<number, Date[]> => {
    const weeks: Record<number, Date[]> = {};
    const firstDayOfMonth = new Date(year, monthIndex, 1);
    const lastDayOfMonth = new Date(year, monthIndex + 1, 0);
    
    // Find the Monday of the week containing the 1st
    // JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat
    let dayOfWeek = firstDayOfMonth.getDay();
    
    // Calculate days to subtract to reach the previous Monday
    // If Sunday (0), subtract 6 days.
    // If Monday (1), subtract 0 days.
    // If Tuesday (2), subtract 1 day, etc.
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(firstDayOfMonth.getDate() - daysSinceMonday);

    let currentWeekNum = 1;
    let currentDate = new Date(startDate);

    // Iterate until the start of the week is beyond the last day of the month.
    // We include any week that starts on or before the last day of the month.
    // Since we align to Monday, 'currentDate' will always be a Monday.
    while (currentDate <= lastDayOfMonth) {
        const weekDays: Date[] = [];
        
        // Build a full 7-day week (Monday to Sunday)
        for (let i = 0; i < 7; i++) {
            weekDays.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        weeks[currentWeekNum] = weekDays;
        currentWeekNum++;
        // currentDate is now at the start of the next week (next Monday)
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
