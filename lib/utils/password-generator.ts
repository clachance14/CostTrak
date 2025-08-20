import { randomBytes } from 'crypto'

/**
 * Generates a secure temporary password
 * @param length - Length of the password (default: 12)
 * @returns A secure password string
 */
export function generateSecurePassword(length: number = 12): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  const symbols = '@$!%*?&'
  const allChars = uppercase + lowercase + numbers + symbols

  // Ensure at least one character from each category
  let password = ''
  password += uppercase[randomBytes(1)[0] % uppercase.length]
  password += lowercase[randomBytes(1)[0] % lowercase.length]
  password += numbers[randomBytes(1)[0] % numbers.length]
  password += symbols[randomBytes(1)[0] % symbols.length]

  // Fill the rest with random characters
  for (let i = password.length; i < length; i++) {
    password += allChars[randomBytes(1)[0] % allChars.length]
  }

  // Shuffle the password
  return password
    .split('')
    .sort(() => randomBytes(1)[0] > 127 ? 0.5 : -0.5)
    .join('')
}

/**
 * Masks a password for display (shows first 3 and last 2 characters)
 * @param password - The password to mask
 * @returns Masked password string
 */
export function maskPassword(password: string): string {
  if (password.length <= 5) {
    return '*'.repeat(password.length)
  }
  const firstThree = password.substring(0, 3)
  const lastTwo = password.substring(password.length - 2)
  const maskedMiddle = '*'.repeat(password.length - 5)
  return `${firstThree}${maskedMiddle}${lastTwo}`
}