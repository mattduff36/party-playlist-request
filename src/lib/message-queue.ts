// Message queue system for approval notifications
// Ensures messages don't overlap and each gets proper display time

import { sql } from '@/lib/db/neon-client';
import { triggerEvent, getUserChannel } from '@/lib/pusher';

interface QueuedMessage {
  userId: string;
  messageText: string;
  duration: number;
  timestamp: number;
}

class MessageQueue {
  private queues: Map<string, QueuedMessage[]> = new Map();
  private processing: Set<string> = new Set();
  private currentMessageEnd: Map<string, number> = new Map();

  async addMessage(userId: string, messageText: string, duration: number = 8): Promise<void> {
    const message: QueuedMessage = {
      userId,
      messageText,
      duration,
      timestamp: Date.now(),
    };

    // Initialize queue for this user if it doesn't exist
    if (!this.queues.has(userId)) {
      this.queues.set(userId, []);
    }

    // Add message to queue
    const queue = this.queues.get(userId)!;
    queue.push(message);

    console.log(`📨 [MessageQueue] Message queued for user ${userId}. Queue length: ${queue.length}`);

    // Start processing if not already processing for this user
    if (!this.processing.has(userId)) {
      this.processQueue(userId);
    }
  }

  private async processQueue(userId: string): Promise<void> {
    // Mark as processing
    this.processing.add(userId);

    try {
      const queue = this.queues.get(userId);
      if (!queue || queue.length === 0) {
        this.processing.delete(userId);
        return;
      }

      // Check if we need to wait for current message to finish
      const currentEnd = this.currentMessageEnd.get(userId) || 0;
      const now = Date.now();
      
      if (currentEnd > now) {
        const waitTime = currentEnd - now;
        console.log(`⏳ [MessageQueue] Waiting ${waitTime}ms for current message to finish for user ${userId}`);
        await this.sleep(waitTime);
      }

      // Get next message from queue
      const message = queue.shift();
      if (!message) {
        this.processing.delete(userId);
        return;
      }

      console.log(`📤 [MessageQueue] Sending message for user ${userId}: "${message.messageText.substring(0, 50)}..."`);

      // Send the message
      await this.sendMessage(message);

      // Track when this message will end
      const messageEnd = Date.now() + (message.duration * 1000);
      this.currentMessageEnd.set(userId, messageEnd);

      // Continue processing queue after a small delay
      setTimeout(() => this.processQueue(userId), 100);

    } catch (error) {
      console.error(`❌ [MessageQueue] Error processing queue for user ${userId}:`, error);
      this.processing.delete(userId);
    }
  }

  private async sendMessage(message: QueuedMessage): Promise<void> {
    const { userId, messageText, duration } = message;
    const messageCreatedAt = new Date().toISOString();

    try {
      // Update the event config with the message using direct SQL
      await sql`
        UPDATE events
        SET config = jsonb_set(
              jsonb_set(
                jsonb_set(
                  config,
                  '{message_text}',
                  to_jsonb(${messageText}::text)
                ),
                '{message_duration}',
                to_jsonb(${duration}::int)
              ),
              '{message_created_at}',
              to_jsonb(${messageCreatedAt}::text)
            ),
            updated_at = NOW()
        WHERE user_id = ${userId}
      `;

      // Trigger Pusher event for real-time message update
      const userChannel = getUserChannel(userId);
      await triggerEvent(userChannel, 'message-update', {
        message_text: messageText,
        message_duration: duration,
        message_created_at: messageCreatedAt,
        timestamp: Date.now()
      });

      console.log(`✅ [MessageQueue] Message sent successfully to user ${userId}`);
    } catch (error) {
      console.error(`❌ [MessageQueue] Failed to send message:`, error);
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get queue status for debugging
  getQueueStatus(userId: string): { queueLength: number; isProcessing: boolean; currentMessageEnd: number | null } {
    const queue = this.queues.get(userId) || [];
    return {
      queueLength: queue.length,
      isProcessing: this.processing.has(userId),
      currentMessageEnd: this.currentMessageEnd.get(userId) || null,
    };
  }
}

// Singleton instance
export const messageQueue = new MessageQueue();

