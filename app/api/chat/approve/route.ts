/**
 * Chat Action Approval Endpoint
 *
 * Executes approved actions from the chat interface.
 * Supports sending emails, creating tasks, and creating events.
 *
 * Part of Loop #7 Enhancements
 *
 * Usage: POST /api/chat/approve
 * Body: { actionType: string, actionData: object }
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, EmailToSend } from '@/lib/gmail/send';
import { logAuditEvent } from '@/lib/supabase/audit-queries';
import { createTaskDirect } from '@/lib/supabase/task-queries';
import { createCalendarEvent, CalendarEventInput } from '@/lib/google/calendar';
import { upsertCalendarEvent } from '@/lib/supabase/calendar-queries';

export const dynamic = 'force-dynamic';

interface ApproveRequest {
  actionType: 'send_email' | 'create_task' | 'create_event';
  actionData: Record<string, unknown>;
  messageId?: string;
  conversationId?: string;
}

interface ApproveResponse {
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
  task?: Record<string, unknown>;
  event?: Record<string, unknown>;
  messageId?: string;
  error?: string;
}

/**
 * Handle email send action
 */
async function handleSendEmail(data: Record<string, unknown>): Promise<ApproveResponse> {
  // Validate required fields
  if (!data.recipient_email || typeof data.recipient_email !== 'string') {
    return {
      success: false,
      error: 'Recipient email is required',
    };
  }

  if (!data.subject || typeof data.subject !== 'string') {
    return {
      success: false,
      error: 'Subject is required',
    };
  }

  if (!data.body || typeof data.body !== 'string') {
    return {
      success: false,
      error: 'Email body is required',
    };
  }

  // Build email object
  const emailToSend: EmailToSend = {
    to: data.recipient_email,
    subject: data.subject,
    body: data.body,
  };

  // If this is a reply, add threading info
  if (data.is_reply && data.thread_id) {
    emailToSend.threadId = data.thread_id as string;
  }

  console.log(`📧 Sending approved email to ${emailToSend.to}`);

  // Send the email
  const result = await sendEmail(emailToSend);

  if (!result.success) {
    // Log failed attempt
    await logAuditEvent({
      entity_type: 'chat_action',
      entity_id: `email-${Date.now()}`,
      action: 'send_email_failed',
      actor: 'user',
      metadata: {
        to: emailToSend.to,
        subject: emailToSend.subject,
        error: result.error,
      },
    });

    return {
      success: false,
      error: result.error || 'Failed to send email',
    };
  }

  // Log successful send
  await logAuditEvent({
    entity_type: 'chat_action',
    entity_id: result.messageId || `email-${Date.now()}`,
    action: 'send_email',
    actor: 'user',
    new_state: {
      to: emailToSend.to,
      subject: emailToSend.subject,
      message_id: result.messageId,
      thread_id: result.threadId,
    },
  });

  return {
    success: true,
    message: `Email sent successfully to ${emailToSend.to}`,
    data: {
      messageId: result.messageId,
      threadId: result.threadId,
    },
  };
}

/**
 * Handle task creation action
 */
async function handleCreateTask(data: Record<string, unknown>): Promise<ApproveResponse> {
  // Validate required fields
  if (!data.title || typeof data.title !== 'string') {
    return {
      success: false,
      error: 'Task title is required',
    };
  }

  // Build task data
  const taskData: {
    title: string;
    description?: string | null;
    due_date?: string | null;
    priority?: 'low' | 'med' | 'high';
  } = {
    title: data.title,
    description: data.description as string | null,
    priority: ['low', 'med', 'high'].includes(data.priority as string)
      ? (data.priority as 'low' | 'med' | 'high')
      : 'med',
  };

  // Handle due date
  if (data.due_date) {
    // If we have both date and time, combine them
    if (data.due_time) {
      taskData.due_date = `${data.due_date}T${data.due_time}:00`;
    } else {
      taskData.due_date = data.due_date as string;
    }
  }

  console.log(`📝 Creating task: ${taskData.title}`);

  try {
    const task = await createTaskDirect(taskData);

    // Log successful creation
    await logAuditEvent({
      entity_type: 'task',
      entity_id: task.id,
      action: 'create_from_chat',
      actor: 'user',
      new_state: {
        title: task.title,
        due_date: task.due_date,
        priority: task.priority,
      },
    });

    return {
      success: true,
      message: `Task "${task.title}" created successfully`,
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        due_date: task.due_date,
        priority: task.priority,
        status: task.status,
      },
    };
  } catch (error) {
    console.error('Task creation error:', error);

    await logAuditEvent({
      entity_type: 'chat_action',
      entity_id: `task-${Date.now()}`,
      action: 'create_task_failed',
      actor: 'user',
      metadata: {
        title: taskData.title,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create task',
    };
  }
}

/**
 * Handle event creation action
 */
async function handleCreateEvent(data: Record<string, unknown>): Promise<ApproveResponse> {
  // Validate required fields
  if (!data.summary || typeof data.summary !== 'string') {
    return {
      success: false,
      error: 'Event summary is required',
    };
  }

  if (!data.start_time || typeof data.start_time !== 'string') {
    return {
      success: false,
      error: 'Event start time is required',
    };
  }

  if (!data.end_time || typeof data.end_time !== 'string') {
    return {
      success: false,
      error: 'Event end time is required',
    };
  }

  // Build event data
  const eventData: CalendarEventInput = {
    summary: data.summary,
    description: (data.description as string) || null,
    startTime: new Date(data.start_time),
    endTime: new Date(data.end_time),
    attendees: Array.isArray(data.attendees)
      ? data.attendees
          .filter((a: { email?: string | null; name?: string }) => a.email)
          .map((a: { email: string; name?: string }) => a.email)
      : undefined,
    location: (data.location as string) || null,
  };

  console.log(`📅 Creating event: ${eventData.summary}`);

  try {
    // Create event in Google Calendar
    const googleEvent = await createCalendarEvent(eventData);

    // Sync to local database
    const { event: dbEvent } = await upsertCalendarEvent(googleEvent);

    // Log successful creation
    await logAuditEvent({
      entity_type: 'calendar_event',
      entity_id: dbEvent.id,
      action: 'create_from_chat',
      actor: 'user',
      new_state: {
        summary: dbEvent.summary,
        start_time: dbEvent.start_time,
        end_time: dbEvent.end_time,
        google_event_id: dbEvent.google_event_id,
      },
    });

    return {
      success: true,
      message: `Event "${dbEvent.summary}" created successfully`,
      event: {
        id: dbEvent.id,
        summary: dbEvent.summary,
        description: dbEvent.description,
        start_time: dbEvent.start_time,
        end_time: dbEvent.end_time,
        location: dbEvent.location,
        google_event_id: dbEvent.google_event_id,
      },
    };
  } catch (error) {
    console.error('Event creation error:', error);

    await logAuditEvent({
      entity_type: 'chat_action',
      entity_id: `event-${Date.now()}`,
      action: 'create_event_failed',
      actor: 'user',
      metadata: {
        summary: eventData.summary,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create event',
    };
  }
}

/**
 * POST /api/chat/approve
 */
export async function POST(request: NextRequest) {
  try {
    const body: ApproveRequest = await request.json();
    const { actionType, actionData, messageId, conversationId } = body;

    // Validate request
    if (!actionType || !actionData) {
      return NextResponse.json(
        { success: false, error: 'Action type and data are required' },
        { status: 400 }
      );
    }

    console.log(`🎯 Processing approved action: ${actionType}`);

    let response: ApproveResponse;

    switch (actionType) {
      case 'send_email':
        response = await handleSendEmail(actionData);
        break;

      case 'create_task':
        response = await handleCreateTask(actionData);
        break;

      case 'create_event':
        response = await handleCreateEvent(actionData);
        break;

      default:
        response = {
          success: false,
          error: `Unknown action type: ${actionType}`,
        };
    }

    // Add message ID if provided
    if (response.success && messageId) {
      response.messageId = messageId;
    }

    if (!response.success) {
      console.error(`❌ Action failed: ${response.error}`);
      return NextResponse.json(response, { status: 400 });
    }

    console.log(`✅ Action completed: ${response.message}`);
    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ Approve endpoint error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
