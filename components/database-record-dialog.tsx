"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { postJson, patchJson } from "@/lib/client/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import type { DatabaseTable, DatabaseProperty } from "@/lib/integrations/totalum/types"
import { toast } from "sonner"

export type TableProperty = DatabaseProperty

interface DatabaseRecordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  tableName: string
  table: DatabaseTable
  mode: "create" | "edit"
  record?: Record<string, unknown>
  onSuccess: () => void
}

function getDefaultValue(prop: DatabaseProperty, record?: Record<string, unknown>): string {
  if (record && record[prop.name] !== undefined && record[prop.name] !== null) {
    const val = record[prop.name]
    if (typeof val === "object") return JSON.stringify(val)
    return String(val)
  }
  return ""
}

function FieldInput({
  prop,
  value,
  onChange,
  record,
}: {
  prop: DatabaseProperty
  value: string
  onChange: (val: string) => void
  record?: Record<string, unknown>
}) {
  const label = prop.label || prop.name
  const isEditable = prop.name !== "_id" && prop.name !== "createdAt" && prop.name !== "updatedAt"

  // Get options from typeExtras if available
  const options = (prop.typeExtras as { options?: Array<{ label: string; value: string }> })?.options

  if (prop.propertyType === "objectReference") {
    return (
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{label}</Label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter linked record ID`}
          disabled={!isEditable}
          className="h-9 text-sm"
        />
        {prop.objectReference && (
          <p className="text-[10px] text-muted-foreground">
            Links to: {prop.objectReference.targetTable} ({prop.objectReference.relationType})
          </p>
        )}
      </div>
    )
  }

  if (options && options.length > 0) {
    return (
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{label}</Label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={!isEditable}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        >
          <option value="">Select…</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    )
  }

  if (prop.propertyType === "long-string") {
    return (
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{label}</Label>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${label}`}
          disabled={!isEditable}
          className="min-h-[80px] text-sm"
        />
      </div>
    )
  }

  if (prop.propertyType === "date") {
    return (
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{label}</Label>
        <Input
          type="datetime-local"
          value={value ? new Date(value).toISOString().slice(0, 16) : ""}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : "")}
          disabled={!isEditable}
          className="h-9 text-sm"
        />
      </div>
    )
  }

  if (prop.propertyType === "number") {
    return (
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{label}</Label>
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${label}`}
          disabled={!isEditable}
          className="h-9 text-sm"
          step="any"
        />
      </div>
    )
  }

  if (prop.propertyType === "file") {
    return (
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{label}</Label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter file URL"
          disabled={!isEditable}
          className="h-9 text-sm"
        />
      </div>
    )
  }

  // Default: string input
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Enter ${label}`}
        disabled={!isEditable}
        className="h-9 text-sm"
      />
    </div>
  )
}

export function DatabaseRecordDialog({
  open,
  onOpenChange,
  projectId,
  tableName,
  table,
  mode,
  record,
  onSuccess,
}: DatabaseRecordDialogProps) {
  const properties = useMemo(() => Object.values(table.properties ?? {}), [table.properties])
  const [formState, setFormState] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const prevOpenRef = useRef(false)

  // Initialize form with record data or defaults — only when dialog opens or record changes
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      const initial: Record<string, string> = {}
      for (const prop of properties) {
        initial[prop.name] = getDefaultValue(prop, record)
      }
      setFormState(initial)
    }
    prevOpenRef.current = open
  }, [open, record, properties])

  const handleChange = (fieldName: string, value: string) => {
    setFormState((prev) => ({ ...prev, [fieldName]: value }))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      // Build the data payload — parse numbers, skip empty strings for optional fields
      const data: Record<string, unknown> = {}
      for (const prop of properties) {
        const val = formState[prop.name]
        if (val === undefined || val === "") continue // skip empty

        if (prop.propertyType === "number") {
          const num = Number(val)
          if (!isNaN(num)) data[prop.name] = num
        } else if (prop.propertyType === "date") {
          data[prop.name] = val // already ISO string
        } else {
          // Try to parse JSON for object fields
          if (prop.propertyType === "objectReference" || (typeof val === "string" && val.startsWith("["))) {
            try {
              data[prop.name] = JSON.parse(val)
            } catch {
              data[prop.name] = val
            }
          } else {
            data[prop.name] = val
          }
        }
      }

      if (mode === "create") {
        await postJson(`/api/projects/${projectId}/database/records`, {
          tableName,
          data,
        })
        toast.success("Record created")
      } else {
        if (!record?._id) throw new Error("No record ID")
        await patchJson(`/api/projects/${projectId}/database/records/${record._id}`, {
          tableName,
          data,
        })
        toast.success("Record updated")
      }
      onSuccess()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save record")
    } finally {
      setSubmitting(false)
    }
  }

  // Only show writable properties in create mode, all in edit mode
  const visibleProps =
    mode === "create"
      ? properties.filter(
          (p) =>
            p.name !== "_id" &&
            p.name !== "createdAt" &&
            p.name !== "updatedAt" &&
            p.propertyType !== "objectReference",
        )
      : properties.filter((p) => p.name !== "_id")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create record" : "Edit record"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? `Add a new record to the ${table.label || table.type} table.`
              : `Edit record ${record?._id ?? ""}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {visibleProps.map((prop) => (
            <FieldInput
              key={prop.name}
              prop={prop}
              value={formState[prop.name] ?? ""}
              onChange={(val) => handleChange(prop.name, val)}
              record={record}
            />
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving…" : mode === "create" ? "Create" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
