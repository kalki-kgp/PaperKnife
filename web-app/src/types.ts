import type { LucideIcon } from 'lucide-react'

export type ToolCategory = 'Edit' | 'Optimize' | 'Secure' | 'Convert'

export interface ToolDefinition {
  id: string
  title: string
  description: string
  category: ToolCategory
  accent: string
  icon: LucideIcon
  eta: string
}

export interface JobRecord {
  id: string
  toolId: string
  fileName: string
  createdAt: number
  status: 'queued' | 'running' | 'done'
}
