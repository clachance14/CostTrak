import { format } from "date-fns"
import { formatMonth } from "./date-helpers"

export interface PivotConfig {
  dimensions: string[]
  measures: {
    key: string
    aggregation: "sum" | "average" | "count" | "min" | "max"
  }[]
}

export interface PivotPreset {
  id: string
  name: string
  description: string
  config: PivotConfig
}

// Predefined pivot presets for labor data
export const laborPivotPresets: PivotPreset[] = [
  {
    id: "by-month",
    name: "By Month",
    description: "Group by Month → Week → Category → Employee",
    config: {
      dimensions: ["month", "weekEnding", "category", "name"],
      measures: [
        { key: "regularHours", aggregation: "sum" },
        { key: "overtimeHours", aggregation: "sum" },
        { key: "totalCostWithBurden", aggregation: "sum" }
      ]
    }
  },
  {
    id: "by-week",
    name: "By Week",
    description: "Group by Week → Category → Employee",
    config: {
      dimensions: ["weekEnding", "category", "name"],
      measures: [
        { key: "regularHours", aggregation: "sum" },
        { key: "overtimeHours", aggregation: "sum" },
        { key: "totalCostWithBurden", aggregation: "sum" }
      ]
    }
  },
  {
    id: "by-craft",
    name: "By Craft",
    description: "Group by Craft Type → Employee → Week",
    config: {
      dimensions: ["craft", "name", "weekEnding"],
      measures: [
        { key: "regularHours", aggregation: "sum" },
        { key: "overtimeHours", aggregation: "sum" },
        { key: "totalCostWithBurden", aggregation: "sum" }
      ]
    }
  },
  {
    id: "by-category",
    name: "By Category",
    description: "Group by Category → Craft → Employee",
    config: {
      dimensions: ["category", "craft", "name"],
      measures: [
        { key: "regularHours", aggregation: "sum" },
        { key: "overtimeHours", aggregation: "sum" },
        { key: "totalCostWithBurden", aggregation: "sum" }
      ]
    }
  },
  {
    id: "monthly-summary", 
    name: "Monthly Summary",
    description: "Month-over-month comparison by Category",
    config: {
      dimensions: ["month", "category"],
      measures: [
        { key: "regularHours", aggregation: "sum" },
        { key: "overtimeHours", aggregation: "sum" },
        { key: "totalCostWithBurden", aggregation: "sum" },
        { key: "employeeNumber", aggregation: "count" }
      ]
    }
  },
  {
    id: "weekly-summary",
    name: "Weekly Summary",
    description: "Week-over-week comparison by Category",
    config: {
      dimensions: ["weekEnding", "category"],
      measures: [
        { key: "regularHours", aggregation: "sum" },
        { key: "overtimeHours", aggregation: "sum" },
        { key: "totalCostWithBurden", aggregation: "sum" },
        { key: "employeeNumber", aggregation: "count" }
      ]
    }
  },
  {
    id: "overtime-analysis",
    name: "Overtime Analysis",
    description: "Focus on overtime hours by Employee and Week",
    config: {
      dimensions: ["name", "weekEnding"],
      measures: [
        { key: "overtimeHours", aggregation: "sum" },
        { key: "regularHours", aggregation: "sum" },
        { key: "totalCostWithBurden", aggregation: "sum" }
      ]
    }
  }
]

// Formatters for common dimension types
export const dimensionFormatters = {
  month: (value: string) => formatMonth(value),
  weekEnding: (value: string) => format(new Date(value), "MMM d, yyyy"),
  category: (value: string) => value || "Unknown",
  craft: (value: string) => value || "Unknown",
  name: (value: string) => value || "Unknown Employee"
}

// Formatters for common measure types
export const measureFormatters = {
  currency: (value: number) => `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  hours: (value: number) => `${value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}h`,
  count: (value: number) => value.toLocaleString("en-US"),
  percentage: (value: number) => `${value.toFixed(1)}%`
}

// Helper to export pivot data to CSV
export function exportPivotToCSV(
  data: Array<Record<string, unknown>>,
  dimensions: { key: string; label: string }[],
  measures: { key: string; label: string }[],
  filename: string
) {
  // Create headers
  const headers = [
    ...dimensions.map(d => d.label),
    ...measures.map(m => m.label)
  ]

  // Create rows
  const rows = data.map(row => {
    const values = [
      ...dimensions.map(d => row[d.key] || row[d.label] || ""),
      ...measures.map(m => row[m.label] || row[m.key] || 0)
    ]
    return values.map(v => {
      // Escape values containing commas or quotes
      const str = String(v)
      if (str.includes(",") || str.includes('"') || str.includes("\\n")) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }).join(",")
  })

  // Combine headers and rows
  const csvContent = [headers.join(","), ...rows].join("\\n")

  // Create blob and download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  
  link.setAttribute("href", url)
  link.setAttribute("download", filename)
  link.style.visibility = "hidden"
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}