/**
 * Sanitizes and formats a phone number to strict E.164 format with '+' prefix.
 * Specifically handles Pakistani regional variations and international formats.
 * 
 * @param {string} phone - Input phone number from webhook or registration
 * @returns {string} Formatted phone number (e.g., '+923366107910')
 * @throws {Error} If number is invalid or cannot be safely mapped
 */
const sanitizePhoneNumber = (phone) => {
  if (!phone) {
    throw new Error("Phone number is required for sanitization.");
  }

  // Remove all non-numeric characters except maybe a leading plus which we'll handle
  let digits = phone.replace(/\D/g, '');

  // Handle local Pakistani variations:
  // 1. Starts with '03...' (11 digits) -> Convert to '923...'
  if (digits.startsWith('03') && digits.length === 11) {
    digits = '92' + digits.substring(1);
  }
  // 2. Starts with '3...' (10 digits) -> Convert to '923...'
  else if (digits.startsWith('3') && digits.length === 10) {
    digits = '92' + digits;
  }
  // 3. Starts with '923...' (12 digits) -> Correct Pakistani international format
  else if (digits.startsWith('923') && digits.length === 12) {
    // Already correct
  }
  // 4. Other international formats (generic check)
  else if (digits.length >= 10 && digits.length <= 15) {
    // Keep as is, will prepend +
  } 
  else {
    throw new Error(`Invalid or unsupported phone format: ${phone}. Must be a valid Pakistani or international number.`);
  }

  // Ensure strict E.164 with the '+' prefix
  return `+${digits}`;
};

module.exports = {
  sanitizePhoneNumber
};
