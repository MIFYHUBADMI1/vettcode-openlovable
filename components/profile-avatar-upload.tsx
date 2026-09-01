"use client"

import { useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Camera, Loader2, Upload } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

interface ProfileAvatarUploadProps {
  currentImageUrl?: string
  userName: string
}

export function ProfileAvatarUpload({ currentImageUrl, userName }: ProfileAvatarUploadProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB")
      return
    }

    setUploading(true)
    const localPreview = URL.createObjectURL(file)
    setPreviewUrl(localPreview)

    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/me/avatar", { method: "POST", body: form })
      const body = await res.json().catch(() => null)

      if (!body?.ok) {
        throw new Error(body?.error?.message ?? "Upload failed")
      }

      toast.success("Avatar updated")
      router.refresh()
    } catch (err) {
      setPreviewUrl(null)
      toast.error(err instanceof Error ? err.message : "Couldn't upload avatar")
    } finally {
      setUploading(false)
    }
  }, [router])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const displayUrl = previewUrl || currentImageUrl

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className={`group relative block rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          isDragOver ? "ring-2 ring-primary" : ""
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Avatar className="size-20 border-2 border-border">
          <AvatarImage src={displayUrl || undefined} alt={userName} />
          <AvatarFallback className="bg-secondary text-secondary-foreground text-xl font-medium">
            {initials(userName)}
          </AvatarFallback>
        </Avatar>
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          {uploading ? (
            <Loader2 className="size-5 text-white animate-spin" />
          ) : (
            <Camera className="size-5 text-white" />
          )}
        </div>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ""
        }}
      />
      <p className="mt-2 text-center font-mono text-[10px] text-muted-foreground">
        Click or drag to upload
      </p>
    </div>
  )
}
