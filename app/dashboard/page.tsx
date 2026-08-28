"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  FolderKanban,
  Play,
  Trash2,
  ExternalLink,
  Clock,
  Loader2,
  Plus,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";

// Import shared components
import { HeaderProvider } from "@/components/shared/header/HeaderContext";
import HeaderWrapper from "@/components/shared/header/Wrapper/Wrapper";
import HeaderDropdownWrapper from "@/components/shared/header/Dropdown/Wrapper/Wrapper";
import { Connector } from "@/components/shared/layout/curvy-rect";

interface Project {
  _id: string;
  name: string;
  sandboxId: string;
  sandboxUrl: string;
  sourceUrl?: string;
  status: string;
  createdAt: string;
  lastAccessedAt: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Redirect-only effect — separate from data fetching.
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Fetch projects only when authenticated with a stable session.
  useEffect(() => {
    if (status === "authenticated" && session?.user?.id) {
      fetchProjects();
    }
  }, [status, session]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async (project: Project) => {
    setResumingId(project._id);
    try {
      const res = await fetch(`/api/projects/${project._id}/resume`, {
        method: "POST",
      });
      const data = await res.json();

      if (data.success) {
        toast.success("Sandbox resumed!", {
          description: "Redirecting to your project...",
        });
        // Navigate to the generation page with the sandbox ID
        setTimeout(() => {
          router.push(
            `/generation?sandbox=${project.sandboxId}&resume=project`,
          );
        }, 800);
      } else {
        toast.error("Resume Failed", {
          description: data.error || "The sandbox could not be resumed.",
        });
      }
    } catch (error) {
      console.error("Error resuming project:", error);
      toast.error("Failed to resume project");
    } finally {
      setResumingId(null);
    }
  };

  const handleDelete = async (project: Project) => {
    setDeletingId(project._id);
    try {
      const res = await fetch(`/api/projects/${project._id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Project deleted");
        setProjects((prev) =>
          prev.filter((p) => p._id !== project._id),
        );
      } else {
        toast.error("Failed to delete project");
      }
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error("Failed to delete project");
    } finally {
      setDeletingId(null);
    }
  };

  const startEditing = (project: Project) => {
    setEditingId(project._id);
    setEditName(project.name);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName("");
  };

  const handleRename = async (project: Project) => {
    const trimmed = editName.trim();
    if (!trimmed) {
      toast.error("Project name cannot be empty");
      return;
    }
    if (trimmed === project.name) {
      // No change — just exit edit mode
      cancelEditing();
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch(`/api/projects/${project._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        toast.success("Project renamed");
        setProjects((prev) =>
          prev.map((p) =>
            p._id === project._id ? { ...p, name: trimmed } : p,
          ),
        );
        cancelEditing();
      } else {
        toast.error("Failed to rename project");
      }
    } catch (error) {
      console.error("Error renaming project:", error);
      toast.error("Failed to rename project");
    } finally {
      setSavingName(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Running
          </span>
        );
      case "paused":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Paused
          </span>
        );
      case "killed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Expired
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            Unknown
          </span>
        );
    }
  };

  // Show loading while checking authentication.
  if (status === "loading" || (status === "authenticated" && !session)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-red-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your projects...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <HeaderProvider>
      <div className="min-h-screen bg-background-base">
        <HeaderDropdownWrapper />

        {/* Header */}
        <div className="sticky top-0 left-0 w-full z-[101] bg-background-base header">
          <div className="absolute top-0 cmw-container border-x border-border-faint h-full pointer-events-none" />
          <div className="h-1 bg-border-faint w-full left-0 -bottom-1 absolute" />

          <div className="cmw-container absolute h-full pointer-events-none top-0">
            <Connector className="absolute -left-[10.5px] -bottom-11" />
            <Connector className="absolute -right-[10.5px] -bottom-11" />
          </div>

          <HeaderWrapper>
            <div className="max-w-[1200px] mx-auto w-full flex justify-between items-center">
              <div className="flex gap-6 items-center">
                <Link href="/" className="flex items-center gap-3 group">
                  <Image
                    src="/logo.png"
                    alt="MirrorSite AI Logo"
                    width={40}
                    height={40}
                    className="rounded-lg"
                  />
                  <div className="text-xl font-bold bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent">
                    MirrorSite AI
                  </div>
                </Link>
              </div>
            </div>
          </HeaderWrapper>
        </div>

        {/* Content */}
        <div className="max-w-[1200px] mx-auto px-6 py-12">
          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center justify-between mb-8"
          >
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <FolderKanban className="w-8 h-8 text-orange-500" />
                My Projects
              </h1>
              <p className="text-gray-500 mt-1">
                Your saved sandbox applications — resume any of them anytime.
              </p>
            </div>
            <Link
              href="/builder"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg font-medium transition-all shadow-sm hover:shadow-md"
            >
              <Plus className="w-4 h-4" />
              New Project
            </Link>
          </motion.div>

          {/* Loading State */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
              <p className="text-gray-500">Loading your projects...</p>
            </div>
          ) : projects.length === 0 ? (
            /* Empty State */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-24"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-orange-50 flex items-center justify-center">
                <FolderKanban className="w-10 h-10 text-orange-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">
                No projects yet
              </h2>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                When you build a website with AI, your sandbox will be saved
                here automatically. You can resume any project at any time —
                paused sandboxes are preserved indefinitely.
              </p>
              <Link
                href="/builder"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg font-medium transition-all shadow-sm hover:shadow-md"
              >
                <Plus className="w-4 h-4" />
                Create Your First Project
              </Link>
            </motion.div>
          ) : (
            /* Project Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project, index) => (
                <motion.div
                  key={project._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 group"
                >
                  {/* Preview Thumbnail */}
                  <div className="relative h-40 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
                    {project.sandboxUrl ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <iframe
                          src={project.sandboxUrl}
                          className="pointer-events-none"
                          style={{
                            width: "1280px",
                            height: "720px",
                            transform: "scale(0.22)",
                            transformOrigin: "top left",
                            border: "none",
                            position: "absolute",
                            top: "0",
                            left: "0",
                          }}
                          title="Project preview"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <FolderKanban className="w-12 h-12 text-gray-300" />
                      </div>
                    )}
                    {/* Status badge overlay */}
                    <div className="absolute top-3 right-3 z-10">
                      {getStatusBadge(project.status)}
                    </div>
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => handleResume(project)}
                        disabled={resumingId === project._id || project.status === "killed"}
                        className="p-3 bg-white rounded-full shadow-lg hover:scale-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Resume project"
                      >
                        {resumingId === project._id ? (
                          <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                        ) : (
                          <Play className="w-5 h-5 text-orange-500" />
                        )}
                      </button>
                      {project.sandboxUrl && project.status !== "killed" && (
                        <a
                          href={project.sandboxUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 bg-white rounded-full shadow-lg hover:scale-110 transition-all"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-5 h-5 text-gray-600" />
                        </a>
                      )}
                      <button
                        onClick={() => handleDelete(project)}
                        disabled={deletingId === project._id}
                        className="p-3 bg-white rounded-full shadow-lg hover:scale-110 transition-all disabled:opacity-50"
                        title="Delete project"
                      >
                        {deletingId === project._id ? (
                          <Loader2 className="w-5 h-5 text-red-500 animate-spin" />
                        ) : (
                          <Trash2 className="w-5 h-5 text-red-500" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Project Info */}
                  <div className="p-4">
                    {editingId === project._id ? (
                      /* Inline edit mode */
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleRename(project);
                            } else if (e.key === "Escape") {
                              cancelEditing();
                            }
                          }}
                          disabled={savingName}
                          className="flex-1 px-2 py-1 text-sm font-semibold text-gray-800 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400"
                          maxLength={60}
                        />
                        <button
                          onClick={() => handleRename(project)}
                          disabled={savingName}
                          className="p-1.5 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50"
                          title="Save"
                        >
                          {savingName ? (
                            <Loader2 className="w-4 h-4 text-green-500 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4 text-green-500" />
                          )}
                        </button>
                        <button
                          onClick={cancelEditing}
                          disabled={savingName}
                          className="p-1.5 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
                          title="Cancel"
                        >
                          <X className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    ) : (
                      /* Display mode with edit button */
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-gray-800 truncate flex-1">
                          {project.name}
                        </h3>
                        <button
                          onClick={() => startEditing(project)}
                          className="p-1.5 hover:bg-orange-50 rounded-md transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                          title="Rename project"
                        >
                          <Pencil className="w-3.5 h-3.5 text-gray-400 hover:text-orange-500" />
                        </button>
                      </div>
                    )}
                    {project.sourceUrl && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${(() => {
                            try {
                              return new URL(
                                project.sourceUrl!.startsWith('http')
                                  ? project.sourceUrl!
                                  : `https://${project.sourceUrl}`,
                              ).hostname;
                            } catch {
                              return project.sourceUrl!;
                            }
                          })()}&sz=16`}
                          alt=""
                          className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
                          width={14}
                          height={14}
                        />
                        <p className="text-xs text-gray-500 truncate">
                          {project.sourceUrl}
                        </p>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
                      <Clock className="w-3 h-3" />
                      <span>Last accessed {formatDate(project.lastAccessedAt)}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Info Banner */}
          {!loading && projects.length > 0 && (
            <div className="mt-12 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>💡 How it works:</strong> Your sandboxes are
                automatically saved when created. When a sandbox times out,
                it's <strong>paused</strong> rather than killed — meaning your
                full state (files, processes, memory) is preserved. Resume any
                project to pick up right where you left off.
              </p>
            </div>
          )}
        </div>
      </div>
    </HeaderProvider>
  );
}
