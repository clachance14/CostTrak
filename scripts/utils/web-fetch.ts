// Simple WebFetch utility for scripts
export class WebFetch {
  static async fetch(url: string, prompt: string): Promise<any> {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const text = await response.text()
      
      // Simple mock of processing the content with the prompt
      console.log(`Fetched content from ${url}`)
      console.log(`Prompt: ${prompt}`)
      console.log(`Content length: ${text.length} characters`)
      
      return {
        url,
        prompt,
        content: text.substring(0, 500) + '...' // Return first 500 chars as sample
      }
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error)
      return null
    }
  }
}