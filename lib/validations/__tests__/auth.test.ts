import { describe, it, expect } from 'vitest'
import {
  loginSchema,
  userRegistrationSchema,
  passwordResetSchema,
  newPasswordSchema
} from '../auth'

describe('Auth Validation Schemas', () => {
  describe('loginSchema', () => {
    it('should validate correct login data', () => {
      const validData = {
        email: 'test@ics.ac',
        password: 'password123'
      }
      
      const result = loginSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should reject invalid email format', () => {
      const invalidData = {
        email: 'notanemail',
        password: 'password123'
      }
      
      const result = loginSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toContain('Invalid email address')
    })

    it('should reject email from wrong domain', () => {
      const invalidData = {
        email: 'test@gmail.com',
        password: 'password123'
      }
      
      const result = loginSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toContain('@ics.ac domain')
    })

    it('should reject empty email', () => {
      const invalidData = {
        email: '',
        password: 'password123'
      }
      
      const result = loginSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toContain('Email is required')
    })

    it('should reject password shorter than 6 characters', () => {
      const invalidData = {
        email: 'test@ics.ac',
        password: '12345'
      }
      
      const result = loginSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toContain('at least 6 characters')
    })

    it('should reject password longer than 100 characters', () => {
      const invalidData = {
        email: 'test@ics.ac',
        password: 'a'.repeat(101)
      }
      
      const result = loginSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toContain('too long')
    })
  })

  describe('userRegistrationSchema', () => {
    const validUserData = {
      email: 'newuser@ics.ac',
      password: 'SecurePass123!',
      first_name: 'John',
      last_name: 'Doe',
      role: 'project_manager' as const,
      division_id: '123e4567-e89b-12d3-a456-426614174000'
    }

    it('should validate correct registration data', () => {
      const result = userRegistrationSchema.safeParse(validUserData)
      expect(result.success).toBe(true)
    })

    it('should validate registration without division_id', () => {
      const { division_id, ...dataWithoutDivision } = validUserData
      const result = userRegistrationSchema.safeParse(dataWithoutDivision)
      expect(result.success).toBe(true)
    })

    it('should reject weak passwords', () => {
      const weakPasswords = [
        'password',      // No uppercase, number, or special char
        'Password',      // No number or special char
        'Password1',     // No special char
        'password1!',    // No uppercase
        'PASSWORD1!',    // No lowercase
        'Passworda!',    // No number
      ]

      weakPasswords.forEach(password => {
        const result = userRegistrationSchema.safeParse({
          ...validUserData,
          password
        })
        expect(result.success).toBe(false)
        expect(result.error?.issues[0].message).toContain('uppercase, lowercase, number, and special character')
      })
    })

    it('should reject invalid roles', () => {
      const result = userRegistrationSchema.safeParse({
        ...validUserData,
        role: 'superadmin'
      })
      expect(result.success).toBe(false)
    })

    it('should validate all allowed roles', () => {
      const roles = ['controller', 'executive', 'ops_manager', 'project_manager', 'accounting', 'viewer'] as const
      
      roles.forEach(role => {
        const result = userRegistrationSchema.safeParse({
          ...validUserData,
          role
        })
        expect(result.success).toBe(true)
      })
    })

    it('should reject names with invalid characters', () => {
      const invalidNames = [
        'John123',       // Numbers
        'John@Doe',      // Special chars
        'John_Doe',      // Underscore
        'John.Doe',      // Period
      ]

      invalidNames.forEach(name => {
        const result = userRegistrationSchema.safeParse({
          ...validUserData,
          first_name: name
        })
        expect(result.success).toBe(false)
        expect(result.error?.issues[0].message).toContain('invalid characters')
      })
    })

    it('should accept names with valid special characters', () => {
      const validNames = [
        "O'Brien",       // Apostrophe
        'Mary-Jane',     // Hyphen
        'John Smith',    // Space
      ]

      validNames.forEach(name => {
        const result = userRegistrationSchema.safeParse({
          ...validUserData,
          first_name: name
        })
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid UUID for division_id', () => {
      const result = userRegistrationSchema.safeParse({
        ...validUserData,
        division_id: 'not-a-uuid'
      })
      expect(result.success).toBe(false)
    })

    it('should accept null division_id', () => {
      const result = userRegistrationSchema.safeParse({
        ...validUserData,
        division_id: null
      })
      expect(result.success).toBe(true)
    })
  })

  describe('passwordResetSchema', () => {
    it('should validate correct email', () => {
      const result = passwordResetSchema.safeParse({
        email: 'user@ics.ac'
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid email domain', () => {
      const result = passwordResetSchema.safeParse({
        email: 'user@example.com'
      })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toContain('@ics.ac domain')
    })
  })

  describe('newPasswordSchema', () => {
    it('should validate matching passwords', () => {
      const result = newPasswordSchema.safeParse({
        password: 'NewSecure123!',
        confirmPassword: 'NewSecure123!'
      })
      expect(result.success).toBe(true)
    })

    it('should reject non-matching passwords', () => {
      const result = newPasswordSchema.safeParse({
        password: 'NewSecure123!',
        confirmPassword: 'Different123!'
      })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toContain("Passwords don't match")
    })

    it('should validate password strength requirements', () => {
      const result = newPasswordSchema.safeParse({
        password: 'weakpass',
        confirmPassword: 'weakpass'
      })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toContain('uppercase, lowercase, number, and special character')
    })

    it('should reject passwords shorter than 8 characters', () => {
      const result = newPasswordSchema.safeParse({
        password: 'Short1!',
        confirmPassword: 'Short1!'
      })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toContain('at least 8 characters')
    })

    it('should reject passwords longer than 100 characters', () => {
      const longPassword = 'A'.repeat(50) + 'a'.repeat(49) + '1!' // 101 characters
      const result = newPasswordSchema.safeParse({
        password: longPassword,
        confirmPassword: longPassword
      })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toContain('too long')
    })
  })
})