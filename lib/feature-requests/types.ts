import type { FeatureRequestCategory, FeatureRequestStatus } from "./config"

export interface FeatureRequestDoc {
  id: string
  title: string
  description: string
  whyItMatters?: string
  category: FeatureRequestCategory
  status: FeatureRequestStatus
  authorId: string
  voteCount: number
  hidden?: boolean
  canonicalRequestId?: string
  releaseNote?: string
  releaseLink?: string
  createdAt: number
  updatedAt: number
}

export interface FeatureRequestVoteDoc {
  id: string
  featureRequestId: string
  userId: string
  createdAt: number
}

export interface FeatureRequestStatusHistoryDoc {
  id: string
  featureRequestId: string
  fromStatus: FeatureRequestStatus | null
  toStatus: FeatureRequestStatus
  changedBy: string
  reason?: string
  createdAt: number
}

export interface FeatureRequestUpdateDoc {
  id: string
  featureRequestId: string
  authorId: string
  body: string
  createdAt: number
}

export interface FeatureRequestInternalNoteDoc {
  id: string
  featureRequestId: string
  authorId: string
  body: string
  createdAt: number
  updatedAt: number
}

export interface PublicAuthor {
  id: string
  name: string
}

export interface PublicFeatureRequest {
  id: string
  title: string
  description: string
  whyItMatters?: string
  category: FeatureRequestCategory
  status: FeatureRequestStatus
  voteCount: number
  hasVoted: boolean
  author: PublicAuthor
  isAuthor: boolean
  canonicalRequestId?: string
  releaseNote?: string
  releaseLink?: string
  createdAt: number
  updatedAt: number
  updates?: { id: string; body: string; createdAt: number }[]
}
