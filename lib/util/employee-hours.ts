import { getDailySummaries } from "./daily-summaries";

// Employee Hours (calculated from daily summaries)
export const getEmployeeHours = async (employeeId: string): Promise<{ totalHours: number; thisWeek: number; thisMonth: number }> => {
  try{

    const summaries = await getDailySummaries(employeeId);
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());

    let thisMonth = 0;
    let thisWeek = 0;

    summaries.forEach(summary => {
      const summaryDate = new Date(summary.date);
      
      if (summaryDate >= startOfMonth) {
        thisMonth += summary.hours_worked;
      }
      
      if (summaryDate >= startOfWeek) {
        thisWeek += summary.hours_worked;
      }
    });

    return {
      totalHours: thisMonth,
      thisWeek,
      thisMonth
    };
  }
  catch (error) {
    console.error('Error getting employee hours:', error);
    return { totalHours: 0, thisWeek: 0, thisMonth: 0 };
  }
};