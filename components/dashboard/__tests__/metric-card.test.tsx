import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricCard } from '../metric-card'
import { DollarSign, TrendingUp } from 'lucide-react'

describe('MetricCard Component', () => {
  it('should render basic metric information', () => {
    render(
      <MetricCard
        title="Total Revenue"
        value="$1,234,567"
        description="Year to date"
      />
    )
    
    expect(screen.getByText('Total Revenue')).toBeInTheDocument()
    expect(screen.getByText('$1,234,567')).toBeInTheDocument()
    expect(screen.getByText('Year to date')).toBeInTheDocument()
  })

  it('should render with an icon when provided', () => {
    const { container } = render(
      <MetricCard
        title="Revenue"
        value="$500,000"
        icon={DollarSign}
      />
    )
    
    const icon = container.querySelector('svg')
    expect(icon).toBeInTheDocument()
    expect(icon).toHaveClass('h-6 w-6 text-foreground/80')
  })

  it('should render positive trend correctly', () => {
    render(
      <MetricCard
        title="Growth"
        value="125%"
        trend={{ value: 12.5, isPositive: true }}
      />
    )
    
    const trendElement = screen.getByText(/↑ 12.5%/)
    expect(trendElement).toHaveClass('text-green-600')
  })

  it('should render negative trend correctly', () => {
    render(
      <MetricCard
        title="Expenses"
        value="$75,000"
        trend={{ value: -5.2, isPositive: false }}
      />
    )
    
    const trendElement = screen.getByText(/↓ 5.2%/)
    expect(trendElement).toHaveClass('text-red-600')
  })

  it('should apply custom className', () => {
    const { container } = render(
      <MetricCard
        title="Custom"
        value="100"
        className="custom-class"
      />
    )
    
    const card = container.querySelector('.custom-class')
    expect(card).toBeInTheDocument()
  })

  it('should handle numeric values', () => {
    render(
      <MetricCard
        title="Count"
        value={42}
      />
    )
    
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('should not render optional elements when not provided', () => {
    render(
      <MetricCard
        title="Minimal"
        value="Test"
      />
    )
    
    // Should not have description
    expect(screen.queryByText(/Year to date/)).not.toBeInTheDocument()
    
    // Should not have trend
    expect(screen.queryByText(/↑/)).not.toBeInTheDocument()
    expect(screen.queryByText(/↓/)).not.toBeInTheDocument()
  })

  it('should handle all props together', () => {
    render(
      <MetricCard
        title="Complete Metric"
        value="$999,999"
        description="Q4 2025 Performance"
        icon={TrendingUp}
        trend={{ value: 25.5, isPositive: true }}
        className="test-metric"
      />
    )
    
    expect(screen.getByText('Complete Metric')).toBeInTheDocument()
    expect(screen.getByText('$999,999')).toBeInTheDocument()
    expect(screen.getByText('Q4 2025 Performance')).toBeInTheDocument()
    expect(screen.getByText(/↑ 25.5%/)).toBeInTheDocument()
    
    const { container } = render(<div />)
    expect(container.querySelector('.test-metric')).toBeDefined()
  })

  it('should have proper accessibility structure', () => {
    render(
      <MetricCard
        title="Accessible Metric"
        value="100%"
        description="Completion rate"
      />
    )
    
    // Card should have proper heading structure
    const heading = screen.getByRole('heading', { name: 'Accessible Metric' })
    expect(heading).toBeInTheDocument()
  })

  it('should apply hover styles', () => {
    const { container } = render(
      <MetricCard
        title="Hover Test"
        value="123"
      />
    )
    
    const card = container.firstChild
    expect(card).toHaveClass('hover:shadow-md')
    expect(card).toHaveClass('transition-shadow')
  })
})