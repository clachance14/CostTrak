import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import DOMPurify from 'isomorphic-dompurify'

// Mock components to test XSS prevention
function ProjectName({ name }: { name: string }) {
  return <div data-testid="project-name">{name}</div>
}

function ProjectDescription({ description }: { description: string }) {
  // Unsafe - for testing what NOT to do
  return <div data-testid="unsafe" dangerouslySetInnerHTML={{ __html: description }} />
}

function SafeProjectDescription({ description }: { description: string }) {
  // Safe - sanitized HTML
  const sanitized = DOMPurify.sanitize(description)
  return <div data-testid="safe" dangerouslySetInnerHTML={{ __html: sanitized }} />
}

describe('XSS Prevention Tests', () => {
  describe('Script Injection Prevention', () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror="alert(\'XSS\')">',
      '<svg onload="alert(\'XSS\')">',
      '<iframe src="javascript:alert(\'XSS\')"></iframe>',
      '<input onfocus="alert(\'XSS\')" autofocus>',
      '<select onfocus="alert(\'XSS\')" autofocus>',
      '<textarea onfocus="alert(\'XSS\')" autofocus>',
      '<button onclick="alert(\'XSS\')">Click me</button>',
      '<form action="javascript:alert(\'XSS\')"><input type="submit"></form>',
      '<a href="javascript:alert(\'XSS\')">Click me</a>',
      '<div onmouseover="alert(\'XSS\')">Hover me</div>',
      '"><script>alert("XSS")</script>',
      '\'-alert(1)-\'',
      '\';alert(1);//',
      '</script><script>alert(1)</script>',
      '<ScRiPt>alert(1)</ScRiPt>',
      '<<SCRIPT>alert("XSS");//<</SCRIPT>',
      '<IMG """><SCRIPT>alert("XSS")</SCRIPT>">',
    ]

    it('should escape HTML in text content', () => {
      xssPayloads.forEach(payload => {
        render(<ProjectName name={payload} />)
        const element = screen.getByTestId('project-name')
        
        // Should display the raw text, not execute scripts
        expect(element.textContent).toBe(payload)
        // Should not contain executable script tags
        expect(element.innerHTML).not.toContain('<script')
        expect(element.innerHTML).not.toContain('onerror=')
        expect(element.innerHTML).not.toContain('onclick=')
      })
    })

    it('should sanitize HTML when using dangerouslySetInnerHTML', () => {
      xssPayloads.forEach(payload => {
        const { container } = render(<SafeProjectDescription description={payload} />)
        const element = screen.getByTestId('safe')
        
        // Should not contain script tags or event handlers
        expect(element.innerHTML).not.toContain('<script')
        expect(element.innerHTML).not.toContain('onerror')
        expect(element.innerHTML).not.toContain('onclick')
        expect(element.innerHTML).not.toContain('javascript:')
        
        // Check that no script elements were created
        const scripts = container.querySelectorAll('script')
        expect(scripts.length).toBe(0)
      })
    })
  })

  describe('Attribute Injection Prevention', () => {
    it('should prevent attribute-based XSS', () => {
      const maliciousAttributes = [
        { href: 'javascript:alert("XSS")' },
        { href: 'jAvAsCrIpT:alert("XSS")' },
        { href: 'data:text/html,<script>alert("XSS")</script>' },
        { src: 'javascript:alert("XSS")' },
        { style: 'background: url(javascript:alert("XSS"))' },
      ]

      maliciousAttributes.forEach(attrs => {
        const SafeLink = ({ href }: { href: string }) => {
          // Validate href to prevent javascript: URLs
          const isValidHref = href.startsWith('http://') || 
                            href.startsWith('https://') || 
                            href.startsWith('/') ||
                            href.startsWith('#')
          
          return (
            <a 
              href={isValidHref ? href : '#'} 
              data-testid="safe-link"
            >
              Link
            </a>
          )
        }

        render(<SafeLink href={attrs.href || attrs.src || ''} />)
        const link = screen.getByTestId('safe-link')
        
        expect(link.getAttribute('href')).toBe('#')
      })
    })
  })

  describe('CSS Injection Prevention', () => {
    it('should prevent style-based XSS', () => {
      const maliciousStyles = [
        'background: url(javascript:alert("XSS"))',
        'background: expression(alert("XSS"))',
        'width: expression(alert("XSS"))',
        'behavior: url(xss.htc)',
      ]

      const SafeDiv = ({ style }: { style: string }) => {
        // Parse and validate CSS
        const isValidStyle = !style.includes('javascript:') && 
                           !style.includes('expression(') &&
                           !style.includes('behavior:')
        
        return (
          <div 
            style={isValidStyle ? { background: 'blue' } : {}} 
            data-testid="safe-div"
          >
            Content
          </div>
        )
      }

      maliciousStyles.forEach(style => {
        render(<SafeDiv style={style} />)
        const div = screen.getByTestId('safe-div')
        
        // Should not have malicious styles
        expect(div.getAttribute('style')).not.toContain('javascript:')
        expect(div.getAttribute('style')).not.toContain('expression')
      })
    })
  })

  describe('URL Parameter Injection Prevention', () => {
    it('should sanitize URL parameters', () => {
      const maliciousParams = [
        '"><script>alert("XSS")</script>',
        '?next=javascript:alert("XSS")',
        '&redirect_to=data:text/html,<script>alert("XSS")</script>',
      ]

      maliciousParams.forEach(param => {
        // Simulate safe URL parameter handling
        const safeParam = encodeURIComponent(param)
        const decodedParam = decodeURIComponent(safeParam)
        
        // When rendered, should be escaped
        render(<div data-testid="param">{decodedParam}</div>)
        const element = screen.getByTestId('param')
        
        expect(element.innerHTML).not.toContain('<script')
        expect(element.textContent).toBe(param)
      })
    })
  })

  describe('JSON Data XSS Prevention', () => {
    it('should safely handle JSON data with XSS attempts', () => {
      const maliciousJson = {
        name: '<script>alert("XSS")</script>',
        description: '<img src=x onerror="alert(\'XSS\')">',
        metadata: {
          tag: '</script><script>alert("XSS")</script>',
        }
      }

      // Safe component that properly escapes JSON data
      const JsonDisplay = ({ data }: { data: any }) => {
        return (
          <div data-testid="json-display">
            <div>{data.name}</div>
            <div>{data.description}</div>
            <pre>{JSON.stringify(data.metadata, null, 2)}</pre>
          </div>
        )
      }

      render(<JsonDisplay data={maliciousJson} />)
      const display = screen.getByTestId('json-display')
      
      // Should escape all HTML
      expect(display.innerHTML).not.toContain('<script')
      expect(display.innerHTML).not.toContain('onerror=')
    })
  })

  describe('Form Input Sanitization', () => {
    it('should sanitize form inputs before display', () => {
      const FormDisplay = ({ value }: { value: string }) => {
        // Sanitize input before display
        const sanitized = value
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
          .replace(/\//g, '&#x2F;')
        
        return <div data-testid="form-value">{sanitized}</div>
      }

      const maliciousInput = '<script>alert("XSS")</script>'
      render(<FormDisplay value={maliciousInput} />)
      
      const element = screen.getByTestId('form-value')
      expect(element.innerHTML).toBe('&lt;script&gt;alert("XSS")&lt;&#x2F;script&gt;')
    })
  })

  describe('Template Literal XSS Prevention', () => {
    it('should prevent XSS in template literals', () => {
      const userInput = '<script>alert("XSS")</script>'
      
      // Unsafe approach (for comparison)
      const unsafeTemplate = `<div>${userInput}</div>`
      
      // Safe approach
      const SafeTemplate = () => {
        const message = `User said: ${userInput}`
        return <div data-testid="safe-template">{message}</div>
      }
      
      render(<SafeTemplate />)
      const element = screen.getByTestId('safe-template')
      
      // Should display text, not execute
      expect(element.textContent).toContain(userInput)
      expect(element.innerHTML).not.toContain('<script')
    })
  })

  describe('Event Handler Injection Prevention', () => {
    it('should prevent dynamic event handler injection', () => {
      const maliciousHandler = 'alert("XSS")'
      
      // Safe component that doesn't eval strings as handlers
      const SafeButton = ({ onClick }: { onClick?: string }) => {
        // Only allow function handlers, not strings
        const handleClick = typeof onClick === 'function' ? onClick : undefined
        
        return (
          <button 
            onClick={handleClick}
            data-testid="safe-button"
          >
            Click me
          </button>
        )
      }
      
      render(<SafeButton onClick={maliciousHandler} />)
      const button = screen.getByTestId('safe-button')
      
      // Should not have onclick attribute with string
      expect(button.getAttribute('onclick')).toBeNull()
    })
  })

  describe('SVG XSS Prevention', () => {
    it('should sanitize SVG content', () => {
      const maliciousSvg = `
        <svg xmlns="http://www.w3.org/2000/svg">
          <script>alert("XSS")</script>
          <image href="x" onerror="alert('XSS')">
          <animate onbegin="alert('XSS')" attributeName="x" dur="1s">
        </svg>
      `
      
      const SafeSvg = ({ svg }: { svg: string }) => {
        const sanitized = DOMPurify.sanitize(svg, {
          USE_PROFILES: { svg: true },
          KEEP_CONTENT: false
        })
        
        return (
          <div 
            data-testid="safe-svg"
            dangerouslySetInnerHTML={{ __html: sanitized }}
          />
        )
      }
      
      render(<SafeSvg svg={maliciousSvg} />)
      const container = screen.getByTestId('safe-svg')
      
      // Should not contain script or event handlers
      expect(container.innerHTML).not.toContain('<script')
      expect(container.innerHTML).not.toContain('onerror')
      expect(container.innerHTML).not.toContain('onbegin')
    })
  })
})