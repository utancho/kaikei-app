/** Match PrismaD1's datetime serialization, including lexicographic date comparisons. */
export const d1Date = (date: Date) => date.toISOString().replace("Z", "+00:00");
