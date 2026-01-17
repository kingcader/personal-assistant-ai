/**
 * AI Scheduling Suggestions
 *
 * Analyzes calendar availability and task priorities to suggest
 * optimal time slots for working on tasks.
 *
 * Part of Loop #4: AI-Powered Productivity Calendar
 */

import { findAvailableSlots } from '@/lib/google/calendar';
import {
  createSchedulingSuggestion,
  getPendingSchedulingSuggestions,
} from '@/lib/supabase/calendar-queries';

/**
 * Task data for scheduling analysis
 */
export interface TaskForScheduling {
  id: string;
  title: string;
  priority: 'low' | 'med' | 'high';
  due_date: string | null;
  status: 'todo' | 'in_progress';
  description?: string | null;
}

/**
 * Time slot suggestion
 */
export interface TimeSlotSuggestion {
  start: Date;
  end: Date;
  durationMinutes: number;
  reason: string;
  confidenceScore: number;
}

/**
 * Estimate task duration based on priority and description
 */
function estimateTaskDuration(task: TaskForScheduling): number {
  // Base duration by priority (in minutes)
  const baseDuration = {
    high: 90, // High priority tasks likely need more focus time
    med: 60,
    low: 30,
  };

  let duration = baseDuration[task.priority];

  // Adjust based on description length (rough complexity indicator)
  if (task.description) {
    const wordCount = task.description.split(/\s+/).length;
    if (wordCount > 50) duration += 30;
    else if (wordCount > 20) duration += 15;
  }

  return Math.min(duration, 180); // Cap at 3 hours
}

/**
 * Calculate urgency score for a task
 * Higher score = more urgent
 */
function calculateUrgency(task: TaskForScheduling): number {
  let score = 0;

  // Priority weight
  const priorityWeight = { high: 30, med: 20, low: 10 };
  score += priorityWeight[task.priority];

  // Due date urgency
  if (task.due_date) {
    const now = new Date();
    const dueDate = new Date(task.due_date + 'T23:59:59');
    const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) {
      score += 50; // Overdue
    } else if (daysUntilDue === 0) {
      score += 40; // Due today
    } else if (daysUntilDue === 1) {
      score += 30; // Due tomorrow
    } else if (daysUntilDue <= 3) {
      score += 20; // Due within 3 days
    } else if (daysUntilDue <= 7) {
      score += 10; // Due within a week
    }
  }

  // In-progress tasks get slight boost
  if (task.status === 'in_progress') {
    score += 5;
  }

  return score;
}

/**
 * Generate scheduling suggestions for tasks
 */
export async function generateSchedulingSuggestions(
  tasks: TaskForScheduling[],
  calendarId: string = 'primary',
  daysAhead: number = 7
): Promise<{ task: TaskForScheduling; suggestion: TimeSlotSuggestion }[]> {
  // Sort tasks by urgency
  const sortedTasks = [...tasks].sort((a, b) => calculateUrgency(b) - calculateUrgency(a));

  // Get available time slots for the next N days
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + daysAhead);

  let availableSlots;
  try {
    availableSlots = await findAvailableSlots(
      startDate,
      endDate,
      30, // Minimum 30 minute slots
      8, // Work starts at 8 AM
      18, // Work ends at 6 PM
      calendarId
    );
  } catch (error) {
    console.error('Error fetching available slots:', error);
    return [];
  }

  const suggestions: { task: TaskForScheduling; suggestion: TimeSlotSuggestion }[] = [];
  const usedSlots: { start: number; end: number }[] = [];

  // For each task, find the best available slot
  for (const task of sortedTasks.slice(0, 5)) { // Limit to top 5 most urgent
    const estimatedDuration = estimateTaskDuration(task);

    // Find best slot for this task
    const bestSlot = findBestSlot(
      task,
      availableSlots,
      usedSlots,
      estimatedDuration
    );

    if (bestSlot) {
      suggestions.push({
        task,
        suggestion: bestSlot,
      });

      // Mark this slot as used
      usedSlots.push({
        start: bestSlot.start.getTime(),
        end: bestSlot.end.getTime(),
      });
    }
  }

  return suggestions;
}

/**
 * Find the best available slot for a task
 */
function findBestSlot(
  task: TaskForScheduling,
  availableSlots: { start: Date; end: Date; durationMinutes: number }[],
  usedSlots: { start: number; end: number }[],
  requiredDuration: number
): TimeSlotSuggestion | null {
  for (const slot of availableSlots) {
    // Check if slot has enough time
    if (slot.durationMinutes < requiredDuration) continue;

    // Check if slot overlaps with already used slots
    const slotStart = slot.start.getTime();
    const proposedEnd = slotStart + requiredDuration * 60 * 1000;

    const overlaps = usedSlots.some(
      (used) => slotStart < used.end && proposedEnd > used.start
    );
    if (overlaps) continue;

    // Calculate confidence based on various factors
    let confidence = 0.7; // Base confidence

    // Higher confidence for morning slots (focus time)
    const hour = slot.start.getHours();
    if (hour >= 8 && hour <= 11) confidence += 0.1;

    // Higher confidence if slot duration closely matches needed time
    const durationFit = 1 - Math.abs(slot.durationMinutes - requiredDuration) / slot.durationMinutes;
    confidence += durationFit * 0.1;

    // Higher confidence for tasks due soon
    if (task.due_date) {
      const daysUntilDue = Math.floor(
        (new Date(task.due_date).getTime() - slot.start.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilDue >= 0 && daysUntilDue <= 3) confidence += 0.1;
    }

    // Generate reason
    const reason = generateReason(task, slot, requiredDuration);

    return {
      start: slot.start,
      end: new Date(proposedEnd),
      durationMinutes: requiredDuration,
      reason,
      confidenceScore: Math.min(confidence, 1.0),
    };
  }

  return null;
}

/**
 * Generate human-readable reason for the suggestion
 */
function generateReason(
  task: TaskForScheduling,
  slot: { start: Date; end: Date; durationMinutes: number },
  duration: number
): string {
  const dayName = slot.start.toLocaleDateString('en-US', { weekday: 'long' });
  const timeStr = slot.start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Time of day context
  const hour = slot.start.getHours();
  let timeContext = '';
  if (hour < 12) {
    timeContext = 'morning focus time';
  } else if (hour < 14) {
    timeContext = 'early afternoon slot';
  } else if (hour < 17) {
    timeContext = 'afternoon block';
  } else {
    timeContext = 'end of day slot';
  }

  // Duration context
  const durationStr = duration >= 60
    ? `${Math.round(duration / 60)} hour${duration >= 120 ? 's' : ''}`
    : `${duration} minutes`;

  // Priority context
  const priorityContext = task.priority === 'high'
    ? 'high priority task'
    : task.priority === 'med'
    ? 'task'
    : 'lower priority task';

  // Due date context
  let dueContext = '';
  if (task.due_date) {
    const daysUntil = Math.floor(
      (new Date(task.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntil < 0) dueContext = ' (overdue!)';
    else if (daysUntil === 0) dueContext = ' (due today!)';
    else if (daysUntil === 1) dueContext = ' (due tomorrow)';
    else if (daysUntil <= 3) dueContext = ` (due in ${daysUntil} days)`;
  }

  return `${dayName} ${timeStr} - ${durationStr} ${timeContext} for this ${priorityContext}${dueContext}`;
}

/**
 * Save scheduling suggestions to database
 */
export async function saveSchedulingSuggestions(
  suggestions: { task: TaskForScheduling; suggestion: TimeSlotSuggestion }[],
  aiModelUsed: string = 'scheduling-algorithm'
): Promise<void> {
  for (const { task, suggestion } of suggestions) {
    try {
      await createSchedulingSuggestion(
        task.id,
        suggestion.start,
        suggestion.end,
        suggestion.reason,
        {
          estimatedDurationMinutes: suggestion.durationMinutes,
          confidenceScore: suggestion.confidenceScore,
          aiModelUsed,
        }
      );
    } catch (error) {
      console.error(`Error saving suggestion for task ${task.id}:`, error);
    }
  }
}

/**
 * Check if a task already has a pending suggestion
 */
export async function taskHasPendingSuggestion(taskId: string): Promise<boolean> {
  const pendingSuggestions = await getPendingSchedulingSuggestions();
  return pendingSuggestions.some((s) => s.task_id === taskId);
}
