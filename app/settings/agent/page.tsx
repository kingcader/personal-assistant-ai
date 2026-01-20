'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Sop, BusinessRule, SopCategory, RuleType } from '@/lib/supabase/business-context-queries';

type Tab = 'sops' | 'rules';

const SOP_CATEGORIES: { value: SopCategory; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'scheduling', label: 'Scheduling' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'research', label: 'Research' },
  { value: 'communication', label: 'Communication' },
  { value: 'task_management', label: 'Task Management' },
  { value: 'other', label: 'Other' },
];

const RULE_TYPES: { value: RuleType; label: string; description: string }[] = [
  { value: 'constraint', label: 'Constraint', description: 'Must NOT do' },
  { value: 'preference', label: 'Preference', description: 'Should do if possible' },
  { value: 'requirement', label: 'Requirement', description: 'Must always do' },
];

export default function AgentSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('rules');
  const [sops, setSops] = useState<Sop[]>([]);
  const [rules, setRules] = useState<BusinessRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showSopModal, setShowSopModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingSop, setEditingSop] = useState<Sop | null>(null);
  const [editingRule, setEditingRule] = useState<BusinessRule | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [sopsRes, rulesRes] = await Promise.all([
        fetch('/api/sops?inactive=true'),
        fetch('/api/rules?inactive=true'),
      ]);
      const [sopsData, rulesData] = await Promise.all([sopsRes.json(), rulesRes.json()]);

      if (sopsData.success) setSops(sopsData.sops);
      if (rulesData.success) setRules(rulesData.rules);
    } catch (error) {
      console.error('Failed to load data:', error);
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function toggleRuleActive(rule: BusinessRule) {
    try {
      const response = await fetch(`/api/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !rule.is_active }),
      });
      if (response.ok) {
        showToast(rule.is_active ? 'Rule disabled' : 'Rule enabled', 'success');
        loadData();
      }
    } catch (error) {
      showToast('Failed to update rule', 'error');
    }
  }

  async function toggleSopActive(sop: Sop) {
    try {
      const response = await fetch(`/api/sops/${sop.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !sop.is_active }),
      });
      if (response.ok) {
        showToast(sop.is_active ? 'SOP disabled' : 'SOP enabled', 'success');
        loadData();
      }
    } catch (error) {
      showToast('Failed to update SOP', 'error');
    }
  }

  async function deleteRule(id: string) {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      const response = await fetch(`/api/rules/${id}`, { method: 'DELETE' });
      if (response.ok) {
        showToast('Rule deleted', 'success');
        loadData();
      }
    } catch (error) {
      showToast('Failed to delete rule', 'error');
    }
  }

  async function deleteSop(id: string) {
    if (!confirm('Are you sure you want to delete this SOP?')) return;
    try {
      const response = await fetch(`/api/sops/${id}`, { method: 'DELETE' });
      if (response.ok) {
        showToast('SOP deleted', 'success');
        loadData();
      }
    } catch (error) {
      showToast('Failed to delete SOP', 'error');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/" className="hover:text-gray-700">Home</Link>
            <span>/</span>
            <Link href="/settings" className="hover:text-gray-700">Settings</Link>
            <span>/</span>
            <span>Agent</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Agent Configuration</h1>
          <p className="text-sm text-gray-500 mt-1">
            Teach your AI assistant how to work with business rules and procedures
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'rules'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Business Rules
            <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
              {rules.filter(r => r.is_active).length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('sops')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'sops'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            SOPs / Playbooks
            <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
              {sops.filter(s => s.is_active).length}
            </span>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          </div>
        ) : (
          <>
            {/* Business Rules Tab */}
            {activeTab === 'rules' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm text-gray-500">
                    Rules tell the agent what it must/must not do
                  </p>
                  <button
                    onClick={() => { setEditingRule(null); setShowRuleModal(true); }}
                    className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800"
                  >
                    + Add Rule
                  </button>
                </div>

                {rules.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                    <p className="text-gray-500 mb-4">No business rules configured</p>
                    <button
                      onClick={() => setShowRuleModal(true)}
                      className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm"
                    >
                      Add your first rule
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rules.map((rule) => (
                      <div
                        key={rule.id}
                        className={`bg-white rounded-lg border p-4 ${
                          rule.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-gray-900">{rule.name}</h3>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                rule.rule_type === 'constraint' ? 'bg-red-100 text-red-700' :
                                rule.rule_type === 'requirement' ? 'bg-green-100 text-green-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {rule.rule_type}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              <span className="font-medium">When:</span> {rule.condition}
                            </p>
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Then:</span> {rule.action}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleRuleActive(rule)}
                              className={`px-2 py-1 rounded text-xs ${
                                rule.is_active
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {rule.is_active ? 'Active' : 'Inactive'}
                            </button>
                            <button
                              onClick={() => { setEditingRule(rule); setShowRuleModal(true); }}
                              className="p-1 text-gray-400 hover:text-gray-600"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteRule(rule.id)}
                              className="p-1 text-gray-400 hover:text-red-600"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SOPs Tab */}
            {activeTab === 'sops' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm text-gray-500">
                    SOPs teach the agent HOW to perform tasks
                  </p>
                  <button
                    onClick={() => { setEditingSop(null); setShowSopModal(true); }}
                    className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800"
                  >
                    + Add SOP
                  </button>
                </div>

                {sops.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                    <p className="text-gray-500 mb-4">No SOPs configured</p>
                    <button
                      onClick={() => setShowSopModal(true)}
                      className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm"
                    >
                      Add your first SOP
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sops.map((sop) => (
                      <div
                        key={sop.id}
                        className={`bg-white rounded-lg border p-4 ${
                          sop.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-gray-900">{sop.name}</h3>
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                {sop.category}
                              </span>
                            </div>
                            {sop.description && (
                              <p className="text-sm text-gray-500 mb-2">{sop.description}</p>
                            )}
                            <p className="text-sm text-gray-600">
                              {sop.steps.length} step{sop.steps.length !== 1 ? 's' : ''}
                              {sop.trigger_patterns && sop.trigger_patterns.length > 0 && (
                                <span className="ml-2 text-gray-400">
                                  | Triggers: {sop.trigger_patterns.join(', ')}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleSopActive(sop)}
                              className={`px-2 py-1 rounded text-xs ${
                                sop.is_active
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {sop.is_active ? 'Active' : 'Inactive'}
                            </button>
                            <button
                              onClick={() => { setEditingSop(sop); setShowSopModal(true); }}
                              className="p-1 text-gray-400 hover:text-gray-600"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteSop(sop.id)}
                              className="p-1 text-gray-400 hover:text-red-600"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Toast */}
        {toast && (
          <div className={`fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          } text-white`}>
            {toast.message}
          </div>
        )}

        {/* Rule Modal */}
        {showRuleModal && (
          <RuleModal
            rule={editingRule}
            onClose={() => { setShowRuleModal(false); setEditingRule(null); }}
            onSave={() => { setShowRuleModal(false); setEditingRule(null); loadData(); showToast('Rule saved', 'success'); }}
          />
        )}

        {/* SOP Modal */}
        {showSopModal && (
          <SopModal
            sop={editingSop}
            onClose={() => { setShowSopModal(false); setEditingSop(null); }}
            onSave={() => { setShowSopModal(false); setEditingSop(null); loadData(); showToast('SOP saved', 'success'); }}
          />
        )}
      </div>
    </div>
  );
}

// Rule Modal Component
function RuleModal({
  rule,
  onClose,
  onSave,
}: {
  rule: BusinessRule | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState(rule?.name || '');
  const [description, setDescription] = useState(rule?.description || '');
  const [ruleType, setRuleType] = useState<RuleType>(rule?.rule_type || 'preference');
  const [condition, setCondition] = useState(rule?.condition || '');
  const [action, setAction] = useState(rule?.action || '');
  const [priority, setPriority] = useState(rule?.priority || 0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !condition.trim() || !action.trim()) return;

    setIsSubmitting(true);
    try {
      const url = rule ? `/api/rules/${rule.id}` : '/api/rules';
      const method = rule ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          rule_type: ruleType,
          condition: condition.trim(),
          action: action.trim(),
          priority,
        }),
      });

      if (response.ok) {
        onSave();
      }
    } catch (error) {
      console.error('Failed to save rule:', error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {rule ? 'Edit Rule' : 'Add Business Rule'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., No early meetings"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <div className="grid grid-cols-3 gap-2">
                {RULE_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setRuleType(type.value)}
                    className={`p-2 rounded-lg border text-sm ${
                      ruleType === type.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium">{type.label}</div>
                    <div className="text-xs text-gray-500">{type.description}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">When (Condition) *</label>
              <input
                type="text"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                placeholder="e.g., scheduling any meeting"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Then (Action) *</label>
              <input
                type="text"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder="e.g., never schedule before 9am Costa Rica time"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional context..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || !condition.trim() || !action.trim() || isSubmitting}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : rule ? 'Save Changes' : 'Add Rule'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// SOP Modal Component
function SopModal({
  sop,
  onClose,
  onSave,
}: {
  sop: Sop | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState(sop?.name || '');
  const [description, setDescription] = useState(sop?.description || '');
  const [category, setCategory] = useState<SopCategory>(sop?.category || 'other');
  const [triggerPatterns, setTriggerPatterns] = useState(sop?.trigger_patterns?.join(', ') || '');
  const [steps, setSteps] = useState<Array<{ instruction: string }>>(
    sop?.steps.map(s => ({ instruction: s.instruction })) || [{ instruction: '' }]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  function addStep() {
    setSteps([...steps, { instruction: '' }]);
  }

  function removeStep(index: number) {
    if (steps.length > 1) {
      setSteps(steps.filter((_, i) => i !== index));
    }
  }

  function updateStep(index: number, instruction: string) {
    const newSteps = [...steps];
    newSteps[index] = { instruction };
    setSteps(newSteps);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || steps.every(s => !s.instruction.trim())) return;

    setIsSubmitting(true);
    try {
      const url = sop ? `/api/sops/${sop.id}` : '/api/sops';
      const method = sop ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          category,
          trigger_patterns: triggerPatterns.split(',').map(t => t.trim()).filter(Boolean),
          steps: steps
            .filter(s => s.instruction.trim())
            .map((s, i) => ({ step_number: i + 1, instruction: s.instruction.trim() })),
        }),
      });

      if (response.ok) {
        onSave();
      }
    } catch (error) {
      console.error('Failed to save SOP:', error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {sop ? 'Edit SOP' : 'Add SOP / Playbook'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Follow-up Email Procedure"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SopCategory)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {SOP_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="When to use this procedure..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Keywords</label>
              <input
                type="text"
                value={triggerPatterns}
                onChange={(e) => setTriggerPatterns(e.target.value)}
                placeholder="e.g., follow up, send reminder, check in"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Comma-separated keywords that trigger this SOP</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Steps *</label>
              <div className="space-y-2">
                {steps.map((step, index) => (
                  <div key={index} className="flex gap-2">
                    <span className="text-sm text-gray-400 py-2 w-6">{index + 1}.</span>
                    <input
                      type="text"
                      value={step.instruction}
                      onChange={(e) => updateStep(index, e.target.value)}
                      placeholder={`Step ${index + 1}...`}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    {steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStep(index)}
                        className="p-2 text-gray-400 hover:text-red-600"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addStep}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  + Add step
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || steps.every(s => !s.instruction.trim()) || isSubmitting}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : sop ? 'Save Changes' : 'Add SOP'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
