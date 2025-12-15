
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
 * It starts from the 1st of the month.
 * It ensures the last week of the month extends to Sunday, even if it crosses into the next month.
 * 
 * Returns: { 1: [Date, Date...], 2: [Date...] }
 */
export const getWeeksForMonth = (year: number, monthIndex: number): Record<number, Date[]> => {
    const weeks: Record<number, Date[]> = {};
    const firstDayOfMonth = new Date(year, monthIndex, 1);
    const lastDayOfMonth = new Date(year, monthIndex + 1, 0);
    
    let currentWeek = 1;
    // Clone to avoid mutation issues
    let currentDate = new Date(firstDayOfMonth);

    // 1. Iterate through the current month
    while (currentDate <= lastDayOfMonth) {
        if (!weeks[currentWeek]) {
            weeks[currentWeek] = [];
        }
        
        weeks[currentWeek].push(new Date(currentDate));
        
        const dayOfWeek = currentDate.getDay(); // 0 is Sunday
        
        // If Sunday, move to next week (unless it's the very last day of iteration, handled by loop)
        if (dayOfWeek === 0) {
            currentWeek++;
        }
        
        // Advance 1 day
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // 2. Handle Overflow: If the last populated week didn't end on a Sunday, extend it into next month.
    const weekKeys = Object.keys(weeks).map(Number).sort((a,b) => a-b);
    if (weekKeys.length > 0) {
        const lastWeekKey = weekKeys[weekKeys.length - 1];
        const lastWeekDays = weeks[lastWeekKey];
        
        // Check the last day in the week
        if (lastWeekDays.length > 0) {
            const lastDate = lastWeekDays[lastWeekDays.length - 1];
            
            if (lastDate.getDay() !== 0) {
                // It's not Sunday, so keep adding days until we hit Sunday
                const nextDate = new Date(lastDate);
                nextDate.setDate(nextDate.getDate() + 1);
                
                while (true) {
                    lastWeekDays.push(new Date(nextDate));
                    if (nextDate.getDay() === 0) break; // Stop after adding Sunday
                    nextDate.setDate(nextDate.getDate() + 1);
                }
            }
        }
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
