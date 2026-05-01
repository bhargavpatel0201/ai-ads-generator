export type ProjectStatus = 'draft' | 'published' | 'processing' | 'generated'

export type Project = {
  id: number
  title: string
  productName?: string
  description?: string
  productDescription?: string
  userPrompt?: string
  aspectRatio?: string
  createdAt?: string
  status?: ProjectStatus
  updatedAt?: string
  views?: number
  tags?: string[]
  uploadedImages?: string[]
  productImage?: string
  modelImage?: string
  generatedImage?: string
  generatedVideo?: string
  authorName?: string
  authorAvatar?: string
  likes?: number
}
