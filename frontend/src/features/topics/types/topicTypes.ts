export type Topic = {
  id: number
  name: string
  slug: string
  description: string | null
  parent_topic_id?: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}
