import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '../button'

describe('Button Component', () => {
  describe('Basic Rendering', () => {
    it('should render with children text', () => {
      render(<Button>Click me</Button>)
      expect(screen.getByRole('button')).toHaveTextContent('Click me')
    })

    it('should render with default variant and size', () => {
      render(<Button>Default Button</Button>)
      const button = screen.getByRole('button')
      
      expect(button).toHaveClass('bg-primary')
      expect(button).toHaveClass('h-10')
      expect(button).toHaveClass('px-4')
    })
  })

  describe('Variants', () => {
    const variants = [
      { variant: 'primary' as const, expectedClass: 'bg-primary' },
      { variant: 'secondary' as const, expectedClass: 'bg-secondary' },
      { variant: 'outline' as const, expectedClass: 'border' },
      { variant: 'ghost' as const, expectedClass: 'hover:bg-accent' },
      { variant: 'danger' as const, expectedClass: 'bg-destructive' },
      { variant: 'default' as const, expectedClass: 'bg-foreground' },
    ]

    variants.forEach(({ variant, expectedClass }) => {
      it(`should render ${variant} variant correctly`, () => {
        render(<Button variant={variant}>{variant} Button</Button>)
        const button = screen.getByRole('button')
        expect(button).toHaveClass(expectedClass)
      })
    })
  })

  describe('Sizes', () => {
    const sizes = [
      { size: 'sm' as const, expectedClass: 'h-8' },
      { size: 'md' as const, expectedClass: 'h-10' },
      { size: 'lg' as const, expectedClass: 'h-12' },
      { size: 'default' as const, expectedClass: 'h-10' },
    ]

    sizes.forEach(({ size, expectedClass }) => {
      it(`should render ${size} size correctly`, () => {
        render(<Button size={size}>{size} Button</Button>)
        const button = screen.getByRole('button')
        expect(button).toHaveClass(expectedClass)
      })
    })
  })

  describe('Loading State', () => {
    it('should show loading spinner when loading', () => {
      render(<Button loading>Loading</Button>)
      
      // Should have spinner
      const spinner = screen.getByRole('button').querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
      
      // Should still show children
      expect(screen.getByRole('button')).toHaveTextContent('Loading')
    })

    it('should be disabled when loading', () => {
      render(<Button loading>Submit</Button>)
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })

    it('should not trigger onClick when loading', () => {
      const handleClick = vi.fn()
      render(<Button loading onClick={handleClick}>Click</Button>)
      
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('Disabled State', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<Button disabled>Disabled</Button>)
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('should have disabled styles', () => {
      render(<Button disabled>Disabled</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('disabled:opacity-50')
      expect(button).toHaveClass('disabled:pointer-events-none')
    })

    it('should not trigger onClick when disabled', () => {
      const handleClick = vi.fn()
      render(<Button disabled onClick={handleClick}>Click</Button>)
      
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('Event Handlers', () => {
    it('should call onClick when clicked', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Click me</Button>)
      
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('should call onFocus when focused', () => {
      const handleFocus = vi.fn()
      render(<Button onFocus={handleFocus}>Focus me</Button>)
      
      fireEvent.focus(screen.getByRole('button'))
      expect(handleFocus).toHaveBeenCalledTimes(1)
    })

    it('should call onBlur when blurred', () => {
      const handleBlur = vi.fn()
      render(<Button onBlur={handleBlur}>Blur me</Button>)
      
      const button = screen.getByRole('button')
      fireEvent.focus(button)
      fireEvent.blur(button)
      expect(handleBlur).toHaveBeenCalledTimes(1)
    })
  })

  describe('Custom Props', () => {
    it('should accept custom className', () => {
      render(<Button className="custom-class">Custom</Button>)
      expect(screen.getByRole('button')).toHaveClass('custom-class')
    })

    it('should pass through HTML button attributes', () => {
      render(
        <Button 
          type="submit" 
          form="test-form"
          name="submit-button"
          value="submit"
        >
          Submit
        </Button>
      )
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('type', 'submit')
      expect(button).toHaveAttribute('form', 'test-form')
      expect(button).toHaveAttribute('name', 'submit-button')
      expect(button).toHaveAttribute('value', 'submit')
    })

    it('should forward ref correctly', () => {
      const ref = vi.fn()
      render(<Button ref={ref}>Ref Button</Button>)
      
      expect(ref).toHaveBeenCalledWith(expect.any(HTMLButtonElement))
    })
  })

  describe('Accessibility', () => {
    it('should have correct ARIA attributes when disabled', () => {
      render(<Button disabled>Disabled</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('disabled')
    })

    it('should be keyboard focusable', () => {
      render(<Button>Focusable</Button>)
      const button = screen.getByRole('button')
      
      button.focus()
      expect(document.activeElement).toBe(button)
    })

    it('should have focus ring styles', () => {
      render(<Button>Focus Ring</Button>)
      const button = screen.getByRole('button')
      
      expect(button).toHaveClass('focus-visible:ring-2')
      expect(button).toHaveClass('focus-visible:ring-ring')
    })
  })

  describe('Complex Scenarios', () => {
    it('should handle rapid clicks', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Rapid Click</Button>)
      
      const button = screen.getByRole('button')
      for (let i = 0; i < 10; i++) {
        fireEvent.click(button)
      }
      
      expect(handleClick).toHaveBeenCalledTimes(10)
    })

    it('should handle variant change dynamically', () => {
      const { rerender } = render(<Button variant="primary">Dynamic</Button>)
      let button = screen.getByRole('button')
      expect(button).toHaveClass('bg-primary')
      
      rerender(<Button variant="danger">Dynamic</Button>)
      button = screen.getByRole('button')
      expect(button).toHaveClass('bg-destructive')
    })

    it('should handle loading state toggle', () => {
      const { rerender } = render(<Button loading={false}>Toggle</Button>)
      let button = screen.getByRole('button')
      expect(button).not.toBeDisabled()
      expect(button.querySelector('.animate-spin')).not.toBeInTheDocument()
      
      rerender(<Button loading={true}>Toggle</Button>)
      button = screen.getByRole('button')
      expect(button).toBeDisabled()
      expect(button.querySelector('.animate-spin')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should render without children', () => {
      render(<Button />)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should handle null children', () => {
      render(<Button>{null}</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should handle complex children', () => {
      render(
        <Button>
          <span>Icon</span>
          <span>Text</span>
        </Button>
      )
      
      const button = screen.getByRole('button')
      expect(button).toHaveTextContent('IconText')
    })

    it('should maintain disabled state when both disabled and loading', () => {
      const { rerender } = render(<Button disabled loading>Both</Button>)
      expect(screen.getByRole('button')).toBeDisabled()
      
      // Remove loading but keep disabled
      rerender(<Button disabled loading={false}>Both</Button>)
      expect(screen.getByRole('button')).toBeDisabled()
    })
  })
})