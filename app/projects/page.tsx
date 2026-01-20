'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Project, ProjectStatus } from '@/lib/supabase/business-context-queries';

type ProjectWithActivity = Project & {
  activity_count?: number;
  last_activity_at?: string;
};

const STATUS_COLORS: Record<ProjectStatus, { bg: string; text: string; dot: string }> = {
  active: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  on_hold: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  completed: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  cancelled: { bg: 'bg-gray-50', text: 'text-gray-500', dot: 'bg-gray-400' },
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectWithActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('active');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadProjects();
  }, [statusFilter]);

  async function loadProjects() {
    try {
      setLoading(true);
      const url = statusFilter === 'all'
        ? '/api/projects'
        : `/api/projects?status=${statusFilter}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setProjects(data.projects);
      } else {
        showToast('Failed to load projects', 'error');
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      showToast('Failed to load projects', 'error');
    } finally {
      setLoading(false);
    }
  }

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function createProject(name: string, description: string) {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      const data = await response.json();

      if (data.success) {
        showToast('Project created', 'success');
        setShowCreateModal(false);
        loadProjects();
      } else {
        showToast(data.error || 'Failed to create project', 'error');
      }
    } catch (error) {
      showToast('Failed to create project', 'error');
    }
  }

  async function updateProjectStatus(projectId: string, newStatus: ProjectStatus) {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await response.json();

      if (data.success) {
        showToast('Project updated', 'success');
        loadProjects();
      } else {
        showToast(data.error || 'Failed to update project', 'error');
      }
    } catch (error) {
      showToast('Failed to update project', 'error');
    }
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function formatRelativeTime(dateString: string | null) {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return formatDate(dateString);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Link href="/" className="hover:text-gray-700">Home</Link>
              <span>/</span>
              <span>Projects</span>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">Projects</h1>
            <p className="text-sm text-gray-500 mt-1">
              Track your active projects and deals
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </button>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {(['all', 'active', 'on_hold', 'completed', 'cancelled'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                statusFilter === status
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {status === 'all' ? 'All' : status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>

        {/* Projects List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-gray-500">No projects found</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800"
            >
              Create your first project
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors cursor-pointer"
                onClick={() => setSelectedProject(project)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900 truncate">{project.name}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[project.status].bg} ${STATUS_COLORS[project.status].text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[project.status].dot}`}></span>
                        {project.status.replace('_', ' ')}
                      </span>
                    </div>
                    {project.description && (
                      <p className="text-sm text-gray-500 line-clamp-2">{project.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      {project.target_completion && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Target: {formatDate(project.target_completion)}
                        </span>
                      )}
                      {project.updated_at && (
                        <span>Updated {formatRelativeTime(project.updated_at)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {project.current_blockers && project.current_blockers.length > 0 && (
                      <span className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs font-medium">
                        {project.current_blockers.length} blocker{project.current_blockers.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>

                {/* Quick stats */}
                {(project.milestones?.length > 0 || project.next_steps?.length) && (
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                    {project.milestones && project.milestones.length > 0 && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        {project.milestones.filter(m => m.completed_at).length}/{project.milestones.length} milestones
                      </span>
                    )}
                    {project.next_steps && project.next_steps.length > 0 && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        {project.next_steps.length} next step{project.next_steps.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div
            className={`fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg ${
              toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            } text-white`}
          >
            {toast.message}
          </div>
        )}

        {/* Create Project Modal */}
        {showCreateModal && (
          <CreateProjectModal
            onClose={() => setShowCreateModal(false)}
            onCreate={createProject}
          />
        )}

        {/* Project Detail Modal */}
        {selectedProject && (
          <ProjectDetailModal
            project={selectedProject}
            onClose={() => setSelectedProject(null)}
            onStatusChange={updateProjectStatus}
            onUpdate={() => {
              loadProjects();
              setSelectedProject(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

// Create Project Modal Component
function CreateProjectModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    await onCreate(name.trim(), description.trim());
    setIsSubmitting(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Project</h2>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Black Coast Estates"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the project..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || isSubmitting}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Project Detail Modal Component
function ProjectDetailModal({
  project,
  onClose,
  onStatusChange,
  onUpdate,
}: {
  project: Project;
  onClose: () => void;
  onStatusChange: (id: string, status: ProjectStatus) => void;
  onUpdate: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProject, setEditedProject] = useState(project);
  const [newBlocker, setNewBlocker] = useState('');
  const [newNextStep, setNewNextStep] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editedProject.name,
          description: editedProject.description,
          current_blockers: editedProject.current_blockers,
          next_steps: editedProject.next_steps,
          target_completion: editedProject.target_completion,
        }),
      });

      if (response.ok) {
        setIsEditing(false);
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to save project:', error);
    } finally {
      setIsSaving(false);
    }
  }

  function addBlocker() {
    if (!newBlocker.trim()) return;
    setEditedProject({
      ...editedProject,
      current_blockers: [...(editedProject.current_blockers || []), newBlocker.trim()],
    });
    setNewBlocker('');
  }

  function removeBlocker(index: number) {
    setEditedProject({
      ...editedProject,
      current_blockers: editedProject.current_blockers?.filter((_, i) => i !== index) || [],
    });
  }

  function addNextStep() {
    if (!newNextStep.trim()) return;
    setEditedProject({
      ...editedProject,
      next_steps: [...(editedProject.next_steps || []), newNextStep.trim()],
    });
    setNewNextStep('');
  }

  function removeNextStep(index: number) {
    setEditedProject({
      ...editedProject,
      next_steps: editedProject.next_steps?.filter((_, i) => i !== index) || [],
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-start justify-between">
          <div className="flex-1">
            {isEditing ? (
              <input
                type="text"
                value={editedProject.name}
                onChange={(e) => setEditedProject({ ...editedProject, name: e.target.value })}
                className="text-xl font-semibold text-gray-900 border-b border-gray-300 focus:border-blue-500 outline-none w-full"
              />
            ) : (
              <h2 className="text-xl font-semibold text-gray-900">{project.name}</h2>
            )}
            <div className="flex items-center gap-2 mt-2">
              <select
                value={project.status}
                onChange={(e) => onStatusChange(project.id, e.target.value as ProjectStatus)}
                className={`px-2 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${STATUS_COLORS[project.status].bg} ${STATUS_COLORS[project.status].text}`}
              >
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Description */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            {isEditing ? (
              <textarea
                value={editedProject.description || ''}
                onChange={(e) => setEditedProject({ ...editedProject, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            ) : (
              <p className="text-gray-600">{project.description || 'No description'}</p>
            )}
          </div>

          {/* Target Completion */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Completion</label>
            {isEditing ? (
              <input
                type="date"
                value={editedProject.target_completion?.split('T')[0] || ''}
                onChange={(e) => setEditedProject({ ...editedProject, target_completion: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            ) : (
              <p className="text-gray-600">
                {project.target_completion
                  ? new Date(project.target_completion).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                  : 'No target date set'}
              </p>
            )}
          </div>

          {/* Blockers */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Blockers
              {editedProject.current_blockers && editedProject.current_blockers.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-xs">
                  {editedProject.current_blockers.length}
                </span>
              )}
            </label>
            <div className="space-y-2">
              {(isEditing ? editedProject : project).current_blockers?.map((blocker, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-red-50 rounded-lg">
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="flex-1 text-sm text-red-700">{blocker}</span>
                  {isEditing && (
                    <button onClick={() => removeBlocker(index)} className="text-red-400 hover:text-red-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              {isEditing && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBlocker}
                    onChange={(e) => setNewBlocker(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addBlocker()}
                    placeholder="Add a blocker..."
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button onClick={addBlocker} className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200">
                    Add
                  </button>
                </div>
              )}
              {!isEditing && (!project.current_blockers || project.current_blockers.length === 0) && (
                <p className="text-sm text-gray-400">No blockers</p>
              )}
            </div>
          </div>

          {/* Next Steps */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Next Steps
              {editedProject.next_steps && editedProject.next_steps.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded text-xs">
                  {editedProject.next_steps.length}
                </span>
              )}
            </label>
            <div className="space-y-2">
              {(isEditing ? editedProject : project).next_steps?.map((step, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                  <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span className="flex-1 text-sm text-blue-700">{step}</span>
                  {isEditing && (
                    <button onClick={() => removeNextStep(index)} className="text-blue-400 hover:text-blue-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              {isEditing && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newNextStep}
                    onChange={(e) => setNewNextStep(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addNextStep()}
                    placeholder="Add a next step..."
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button onClick={addNextStep} className="px-3 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200">
                    Add
                  </button>
                </div>
              )}
              {!isEditing && (!project.next_steps || project.next_steps.length === 0) && (
                <p className="text-sm text-gray-400">No next steps defined</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-between">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
          {isEditing && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
