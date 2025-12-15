
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
 * 
 * STRICT RULE: A week belongs to the month where its Monday falls.
 * This prevents overlaps. For example, if Dec 29 (Mon) - Jan 4 (Sun), 
 * this week belongs to December. January views will start from the first 
 * Monday that actually falls in January (e.g., Jan 5).
 * 
 * Returns: { 1: [Date, Date...], 2: [Date...] }
 */
export const getWeeksForMonth = (year: number, monthIndex: number): Record<number, Date[]> => {
    const weeks: Record<number, Date[]> = {};
    const firstDayOfMonth = new Date(year, monthIndex, 1);
    
    // 1. Find the Monday of the week containing the 1st of the month
    const dayOfWeek = firstDayOfMonth.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    // If Sun(0) -> -6 days. If Mon(1) -> -0 days. If Tue(2) -> -1 day.
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    const potentialStartMonday = new Date(firstDayOfMonth);
    potentialStartMonday.setDate(firstDayOfMonth.getDate() - daysSinceMonday);

    // 2. Logic: A week belongs to the month where its Monday falls.
    // If the Monday containing the 1st is in the PREVIOUS month, 
    // we skip that week for this month's view (it belongs to the previous month).
    let currentMonday = new Date(potentialStartMonday);
    
    if (currentMonday.getMonth() !== monthIndex) {
        // Monday is in previous month (e.g. Dec 29), so add 7 days to start from 
        // the first Monday OF this month (e.g. Jan 5)
        currentMonday.setDate(currentMonday.getDate() + 7);
    }

    let currentWeekNum = 1;

    // 3. Iterate as long as the Monday is within the current month
    // We check monthIndex to ensure we don't bleed into the next month
    while (currentMonday.getMonth() === monthIndex) {
        const weekDays: Date[] = [];
        
        // Build the full week (Mon-Sun)
        let tempDay = new Date(currentMonday);
        for (let i = 0; i < 7; i++) {
            weekDays.push(new Date(tempDay));
            tempDay.setDate(tempDay.getDate() + 1);
        }
        
        weeks[currentWeekNum] = weekDays;
        currentWeekNum++;
        
        // Move to next Monday
        currentMonday.setDate(currentMonday.getDate() + 7);
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
