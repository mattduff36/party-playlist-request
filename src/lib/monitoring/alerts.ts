/**
 * Alerting System
 * 
 * This module handles alert delivery through various channels
 * including email, Slack, webhooks, and in-app notifications.
 */

export interface AlertChannel {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'console' | 'in_app';
  enabled: boolean;
  config: Record<string, any>;
}

export interface AlertTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface AlertDelivery {
  id: string;
  alertId: string;
  channelId: string;
  status: 'pending' | 'sent' | 'failed' | 'retrying';
  attempts: number;
  maxAttempts: number;
  nextRetry?: number;
  error?: string;
  sentAt?: number;
}

class AlertingSystem {
  private channels: Map<string, AlertChannel> = new Map();
  private templates: Map<string, AlertTemplate> = new Map();
  private deliveries: AlertDelivery[] = [];
  private retryQueue: AlertDelivery[] = [];
  private isProcessing: boolean = false;

  constructor() {
    this.initializeDefaultChannels();
    this.initializeDefaultTemplates();
    this.startRetryProcessor();
  }
  getAlerts() {
    // Return shallow copy of recent deliveries as alerts-like objects
    return this.deliveries
      .map(d => ({
        id: d.id,
        severity: 'low' as const,
        message: d.error ? d.error : 'Delivery event',
        metric: 'alerts',
        value: 0,
        threshold: 0,
        timestamp: d.sentAt || Date.now(),
        resolved: d.status === 'sent',
      }));
  }

  getAlertStats() {
    const deliveries = this.getDeliveryStats();
    // Map delivery stats to expected alert stats shape
    return {
      total: deliveries.total,
      resolved: deliveries.sent,
      unresolved: deliveries.pending + deliveries.retrying + deliveries.failed,
      critical: 0,
      high: 0,
      medium: 0,
      low: deliveries.total, // best-effort placeholder
    };
  }

  /**
   * Add an alert channel
   */
  addChannel(channel: AlertChannel) {
    this.channels.set(channel.id, channel);
    console.log(`📢 Alert channel added: ${channel.name} (${channel.type})`);
  }

  /**
   * Remove an alert channel
   */
  removeChannel(channelId: string) {
    this.channels.delete(channelId);
    console.log(`📢 Alert channel removed: ${channelId}`);
  }

  /**
   * Send an alert through all enabled channels
   */
  async sendAlert(alert: {
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    metric: string;
    value: number;
    threshold: number;
    timestamp: number;
  }) {
    const template = this.getTemplateForSeverity(alert.severity);
    
    for (const channel of this.channels.values()) {
      if (!channel.enabled) continue;

      const delivery: AlertDelivery = {
        id: `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        alertId: alert.id,
        channelId: channel.id,
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
      };

      this.deliveries.push(delivery);
      await this.deliverAlert(delivery, alert, template, channel);
    }
  }

  /**
   * Get delivery status for an alert
   */
  getDeliveryStatus(alertId: string): AlertDelivery[] {
    return this.deliveries.filter(d => d.alertId === alertId);
  }

  /**
   * Get delivery statistics
   */
  getDeliveryStats() {
    const total = this.deliveries.length;
    const sent = this.deliveries.filter(d => d.status === 'sent').length;
    const failed = this.deliveries.filter(d => d.status === 'failed').length;
    const pending = this.deliveries.filter(d => d.status === 'pending').length;
    const retrying = this.deliveries.filter(d => d.status === 'retrying').length;

    return {
      total,
      sent,
      failed,
      pending,
      retrying,
      successRate: total > 0 ? (sent / total) * 100 : 0,
    };
  }

  /**
   * Test a channel configuration
   */
  async testChannel(channelId: string): Promise<boolean> {
    const channel = this.channels.get(channelId);
    if (!channel) return false;

    const testAlert = {
      id: 'test_alert',
      severity: 'low' as const,
      message: 'Test alert from monitoring system',
      metric: 'test_metric',
      value: 0,
      threshold: 0,
      timestamp: Date.now(),
    };

    const template = this.getTemplateForSeverity('low');
    
    try {
      await this.deliverAlert(
        {
          id: 'test_delivery',
          alertId: 'test_alert',
          channelId: channel.id,
          status: 'pending',
          attempts: 0,
          maxAttempts: 1,
        },
        testAlert,
        template,
        channel
      );
      return true;
    } catch (error) {
      console.error(`❌ Channel test failed for ${channel.name}:`, error);
      return false;
    }
  }

  private async deliverAlert(
    delivery: AlertDelivery,
    alert: any,
    template: AlertTemplate,
    channel: AlertChannel
  ) {
    try {
      delivery.attempts++;
      delivery.status = 'pending';

      const subject = this.renderTemplate(template.subject, alert);
      const body = this.renderTemplate(template.body, alert);

      switch (channel.type) {
        case 'email':
          await this.sendEmail(channel, subject, body);
          break;
        case 'slack':
          await this.sendSlack(channel, subject, body);
          break;
        case 'webhook':
          await this.sendWebhook(channel, { subject, body, alert });
          break;
        case 'console':
          this.sendConsole(alert, subject, body);
          break;
        case 'in_app':
          await this.sendInApp(channel, alert, subject, body);
          break;
        default:
          throw new Error(`Unknown channel type: ${channel.type}`);
      }

      delivery.status = 'sent';
      delivery.sentAt = Date.now();
      console.log(`✅ Alert delivered via ${channel.name}: ${alert.message}`);

    } catch (error) {
      console.error(`❌ Alert delivery failed via ${channel.name}:`, error);
      
      if (delivery.attempts < delivery.maxAttempts) {
        delivery.status = 'retrying';
        delivery.nextRetry = Date.now() + (delivery.attempts * 60000); // Exponential backoff
        this.retryQueue.push(delivery);
      } else {
        delivery.status = 'failed';
        delivery.error = error instanceof Error ? error.message : 'Unknown error';
      }
    }
  }

  private async sendEmail(channel: AlertChannel, subject: string, body: string) {
    const { config } = channel;
    
    // In a real implementation, you would use an email service like SendGrid, AWS SES, etc.
    console.log(`📧 EMAIL ALERT [${config.to}]: ${subject}`);
    console.log(`Body: ${body}`);
    
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async sendSlack(channel: AlertChannel, subject: string, body: string) {
    const { config } = channel;
    
    // In a real implementation, you would use the Slack Web API
    console.log(`💬 SLACK ALERT [${config.channel}]: ${subject}`);
    console.log(`Body: ${body}`);
    
    // Simulate Slack API call
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async sendWebhook(channel: AlertChannel, data: any) {
    const { config } = channel;
    
    // In a real implementation, you would make an HTTP request
    console.log(`🔗 WEBHOOK ALERT [${config.url}]:`, data);
    
    // Simulate webhook call
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private sendConsole(alert: any, subject: string, body: string) {
    const severity = alert.severity.toUpperCase();
    const emoji = this.getSeverityEmoji(alert.severity);
    
    console.log(`\n${emoji} ${severity} ALERT: ${subject}`);
    console.log(`📊 Metric: ${alert.metric}`);
    console.log(`📈 Value: ${alert.value} (threshold: ${alert.threshold})`);
    console.log(`⏰ Time: ${new Date(alert.timestamp).toISOString()}`);
    console.log(`📝 Details: ${body}\n`);
  }

  private async sendInApp(channel: AlertChannel, alert: any, subject: string, body: string) {
    // In a real implementation, you would store this in a database
    // and notify connected clients via WebSocket or Server-Sent Events
    console.log(`📱 IN-APP ALERT: ${subject}`);
    console.log(`Body: ${body}`);
    
    // Simulate in-app notification
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private renderTemplate(template: string, data: any): string {
    return template
      .replace(/\{\{severity\}\}/g, data.severity)
      .replace(/\{\{message\}\}/g, data.message)
      .replace(/\{\{metric\}\}/g, data.metric)
      .replace(/\{\{value\}\}/g, data.value.toString())
      .replace(/\{\{threshold\}\}/g, data.threshold.toString())
      .replace(/\{\{timestamp\}\}/g, new Date(data.timestamp).toISOString())
      .replace(/\{\{date\}\}/g, new Date(data.timestamp).toLocaleDateString())
      .replace(/\{\{time\}\}/g, new Date(data.timestamp).toLocaleTimeString());
  }

  private getTemplateForSeverity(severity: string): AlertTemplate {
    return this.templates.get(`${severity}_template`) || this.templates.get('default_template')!;
  }

  private getSeverityEmoji(severity: string): string {
    const emojis = {
      low: '🟡',
      medium: '🟠',
      high: '🔴',
      critical: '🚨',
    };
    return emojis[severity as keyof typeof emojis] || '📢';
  }

  private startRetryProcessor() {
    setInterval(() => {
      this.processRetryQueue();
    }, 30000); // Check every 30 seconds
  }

  private async processRetryQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const now = Date.now();
    const readyToRetry = this.retryQueue.filter(d => d.nextRetry && d.nextRetry <= now);

    for (const delivery of readyToRetry) {
      const channel = this.channels.get(delivery.channelId);
      if (!channel) continue;

      // Remove from retry queue
      const index = this.retryQueue.indexOf(delivery);
      if (index > -1) {
        this.retryQueue.splice(index, 1);
      }

      // Get the original alert (in a real implementation, you'd fetch this from storage)
      const alert = {
        id: delivery.alertId,
        severity: 'medium' as const,
        message: 'Retry alert',
        metric: 'test',
        value: 0,
        threshold: 0,
        timestamp: Date.now(),
      };

      const template = this.getTemplateForSeverity('medium');
      await this.deliverAlert(delivery, alert, template, channel);
    }

    this.isProcessing = false;
  }

  private initializeDefaultChannels() {
    const defaultChannels: AlertChannel[] = [
      {
        id: 'console_channel',
        name: 'Console Output',
        type: 'console',
        enabled: true,
        config: {},
      },
      {
        id: 'email_channel',
        name: 'Email Notifications',
        type: 'email',
        enabled: false,
        config: {
          to: process.env.ALERT_EMAIL || 'admin@example.com',
          from: 'alerts@partyplaylist.com',
        },
      },
      {
        id: 'slack_channel',
        name: 'Slack Notifications',
        type: 'slack',
        enabled: false,
        config: {
          webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
          channel: '#alerts',
        },
      },
    ];

    defaultChannels.forEach(channel => this.addChannel(channel));
  }

  private initializeDefaultTemplates() {
    const defaultTemplates: AlertTemplate[] = [
      {
        id: 'critical_template',
        name: 'Critical Alert Template',
        subject: '🚨 CRITICAL: {{message}}',
        body: `🚨 CRITICAL ALERT

{{message}}

Details:
- Metric: {{metric}}
- Current Value: {{value}}
- Threshold: {{threshold}}
- Time: {{timestamp}}

Please investigate immediately.`,
        severity: 'critical',
      },
      {
        id: 'high_template',
        name: 'High Priority Alert Template',
        subject: '🔴 HIGH: {{message}}',
        body: `🔴 HIGH PRIORITY ALERT

{{message}}

Details:
- Metric: {{metric}}
- Current Value: {{value}}
- Threshold: {{threshold}}
- Time: {{timestamp}}

Please investigate soon.`,
        severity: 'high',
      },
      {
        id: 'medium_template',
        name: 'Medium Priority Alert Template',
        subject: '🟠 MEDIUM: {{message}}',
        body: `🟠 MEDIUM PRIORITY ALERT

{{message}}

Details:
- Metric: {{metric}}
- Current Value: {{value}}
- Threshold: {{threshold}}
- Time: {{timestamp}}

Monitor closely.`,
        severity: 'medium',
      },
      {
        id: 'low_template',
        name: 'Low Priority Alert Template',
        subject: '🟡 LOW: {{message}}',
        body: `🟡 LOW PRIORITY ALERT

{{message}}

Details:
- Metric: {{metric}}
- Current Value: {{value}}
- Threshold: {{threshold}}
- Time: {{timestamp}}

For your information.`,
        severity: 'low',
      },
      {
        id: 'default_template',
        name: 'Default Alert Template',
        subject: '📢 ALERT: {{message}}',
        body: `📢 ALERT

{{message}}

Details:
- Metric: {{metric}}
- Current Value: {{value}}
- Threshold: {{threshold}}
- Time: {{timestamp}}`,
        severity: 'low',
      },
    ];

    defaultTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }
}

// Singleton instance
export const alertingSystem = new AlertingSystem();
