
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
 * Generates weeks for a given month/year based on a simple Monday-Sunday logic.
 * Week 1: 1st of month -> First Sunday
 * Week 2+: Monday -> Sunday
 * Last Week: Monday -> End of Month
 * 
 * Returns: { 1: [1, 2, 3, 4], 2: [5, 6, 7, 8, 9, 10, 11], ... }
 */
export const getWeeksForMonth = (year: number, monthIndex: number) => {
    const weeks: Record<number, number[]> = {};
    const totalDays = getDaysInMonth(year, monthIndex);
    
    let currentWeek = 1;
    
    for (let day = 1; day <= totalDays; day++) {
        if (!weeks[currentWeek]) {
            weeks[currentWeek] = [];
        }
        
        weeks[currentWeek].push(day);
        
        const date = new Date(year, monthIndex, day);
        const dayOfWeek = date.getDay(); // 0 is Sunday
        
        // If it's Sunday, and it's not the last day of the month, move to next week
        if (dayOfWeek === 0 && day < totalDays) {
            currentWeek++;
        }
    }
    
    return weeks;
};

export const getWeekRangeString = (year: number, monthIndex: number, days: number[]) => {
    if (!days || days.length === 0) return '';
    
    const startDay = days[0];
    const endDay = days[days.length - 1];
    const mon = MONTH_NAMES[monthIndex].slice(0, 3);
    
    const pad = (n: number) => n.toString().padStart(2, '0');
    
    // Example: 01 DEC - 07 DEC
    return `${pad(startDay)} ${mon} - ${pad(endDay)} ${mon}`;
};
