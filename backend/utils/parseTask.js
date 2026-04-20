/**
 * Utility function to parse relative dates from natural language
 * This is a fallback/helper for the AI parsing
 */

const dayMap = {
  'monday': 1,
  'tuesday': 2,
  'wednesday': 3,
  'thursday': 4,
  'friday': 5,
  'saturday': 6,
  'sunday': 0
};

/**
 * Parse relative date strings like "tomorrow", "next Monday", etc.
 * @param {string} dateStr - Relative date string
 * @param {Date} baseDate - Base date to calculate from
 * @returns {Date} Parsed date
 */
const parseRelativeDate = (dateStr, baseDate = new Date()) => {
  const lowerStr = dateStr.toLowerCase().trim();
  const result = new Date(baseDate);

  // Handle "today"
  if (lowerStr.includes('today')) {
    return result;
  }

  // Handle "tomorrow"
  if (lowerStr.includes('tomorrow')) {
    result.setDate(result.getDate() + 1);
    return result;
  }

  // Handle "day after tomorrow"
  if (lowerStr.includes('day after tomorrow')) {
    result.setDate(result.getDate() + 2);
    return result;
  }

  // Handle "next week"
  if (lowerStr.includes('next week')) {
    result.setDate(result.getDate() + 7);
    return result;
  }

  // Handle day names (e.g., "Monday", "next Monday")
  for (const [dayName, dayNum] of Object.entries(dayMap)) {
    if (lowerStr.includes(dayName)) {
      const currentDay = result.getDay();
      let daysUntilTarget = dayNum - currentDay;

      // If today is the same day or already passed, go to next week
      if (daysUntilTarget <= 0) {
        daysUntilTarget += 7;
      }

      // If "next" is specified, add 7 days
      if (lowerStr.includes('next')) {
        daysUntilTarget += 7;
      }

      result.setDate(result.getDate() + daysUntilTarget);
      return result;
    }
  }

  // Handle "in X days"
  const inDaysMatch = lowerStr.match(/in\s+(\d+)\s+days?/);
  if (inDaysMatch) {
    const days = parseInt(inDaysMatch[1]);
    result.setDate(result.getDate() + days);
    return result;
  }

  return null;
};

/**
 * Parse time string to hours and minutes
 * @param {string} timeStr - Time string (e.g., "3pm", "15:00", "3:30 PM")
 * @returns {object} { hours, minutes }
 */
const parseTime = (timeStr) => {
  const lowerStr = timeStr.toLowerCase().trim();
  let hours = 0;
  let minutes = 0;

  // Handle "X PM/AM" format
  const ampmMatch = lowerStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  if (ampmMatch) {
    hours = parseInt(ampmMatch[1]);
    minutes = ampmMatch[2] ? parseInt(ampmMatch[2]) : 0;
    const period = ampmMatch[3];

    if (period === 'pm' && hours !== 12) {
      hours += 12;
    } else if (period === 'am' && hours === 12) {
      hours = 0;
    }
  }
  // Handle 24-hour format
  else {
    const [h, m] = lowerStr.split(':');
    hours = parseInt(h);
    minutes = m ? parseInt(m) : 0;
  }

  return { hours, minutes };
};

module.exports = {
  parseRelativeDate,
  parseTime
};
