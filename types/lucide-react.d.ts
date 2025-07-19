declare module 'lucide-react' {
  import { FC, SVGProps } from 'react'
  
  export type LucideIcon = FC<SVGProps<SVGSVGElement>>
  
  // Re-export all existing icons
  export * from 'lucide-react'
  
  // Add missing icon type declarations
  export const TestTube: LucideIcon
  export const Briefcase: LucideIcon
  export const Activity: LucideIcon
  export const FolderOpen: LucideIcon
  export const Bell: LucideIcon
  export const CheckCheck: LucideIcon
  export const Megaphone: LucideIcon
  export const Grid3x3: LucideIcon
  export const TableProperties: LucideIcon
  export const Paperclip: LucideIcon
  export const MessageSquare: LucideIcon
  export const HelpCircle: LucideIcon
  export const Wrench: LucideIcon
  export const FileImage: LucideIcon
  export const ArrowUpDown: LucideIcon
  export const ArrowUp: LucideIcon
  export const ArrowDown: LucideIcon
  export const RotateCcw: LucideIcon
  export const CheckIcon: LucideIcon
  export const ChevronDownIcon: LucideIcon
  export const ChevronUpIcon: LucideIcon
  export const Monitor: LucideIcon
  export const ChevronsUpDown: LucideIcon
}