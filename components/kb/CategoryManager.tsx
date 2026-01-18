'use client';

import { useState } from 'react';

interface KBCategory {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

interface CategoryManagerProps {
  categories: KBCategory[];
  onCreateCategory: (name: string, description: string, color: string) => Promise<void>;
  onUpdateCategory: (id: string, name: string, description: string, color: string) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
}

const COLOR_OPTIONS = [
  { name: 'Red', value: '#EF4444' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Yellow', value: '#F59E0B' },
  { name: 'Green', value: '#10B981' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Gray', value: '#6B7280' },
];

export default function CategoryManager({
  categories,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
}: CategoryManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<KBCategory | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6B7280');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setName('');
    setDescription('');
    setColor('#6B7280');
    setEditingCategory(null);
    setShowForm(false);
  };

  const handleEdit = (category: KBCategory) => {
    setEditingCategory(category);
    setName(category.name);
    setDescription(category.description || '');
    setColor(category.color);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      if (editingCategory) {
        await onUpdateCategory(editingCategory.id, name.trim(), description.trim(), color);
      } else {
        await onCreateCategory(name.trim(), description.trim(), color);
      }
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category: KBCategory) => {
    if (!confirm(`Delete category "${category.name}"? Documents will keep their other categories.`)) {
      return;
    }
    await onDeleteCategory(category.id);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Categories</h2>
          <p className="text-sm text-gray-500">
            Organize your documents with custom categories
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          New Category
        </button>
      </div>

      {/* Category Form */}
      {showForm && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Category name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setColor(opt.value)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      color === opt.value
                        ? 'border-gray-900 scale-110'
                        : 'border-transparent hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: opt.value }}
                    title={opt.name}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingCategory ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Category List */}
      {categories.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <p>No categories yet</p>
          <p className="text-sm mt-1">Create categories to organize your documents</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {categories.map((category) => (
            <li
              key={category.id}
              className="px-4 py-3 flex items-center justify-between hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <span
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <div>
                  <div className="font-medium text-gray-900">{category.name}</div>
                  {category.description && (
                    <div className="text-sm text-gray-500">{category.description}</div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(category)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(category)}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
