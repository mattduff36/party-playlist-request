import type { GlobalEventState, EventState, EventConfig } from './global-event.tsx';
import type { OptimisticUpdate } from './optimistic-updates';

/**
 * State Validation and Error Handling
 * 
 * This module provides comprehensive validation for the global event state
 * and optimistic updates, ensuring data integrity and proper error handling.
 */

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
  suggestion?: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  suggestion?: string;
}

export interface ValidationRule<T = any> {
  field: string;
  validator: (value: T, context?: any) => ValidationResult;
  required?: boolean;
  dependencies?: string[];
}

export class StateValidator {
  private rules: Map<string, ValidationRule[]> = new Map();

  constructor() {
    this.initializeRules();
  }

  /**
   * Initialize validation rules
   */
  private initializeRules(): void {
    // Global event state rules
    this.addRule('status', {
      field: 'status',
      validator: this.validateEventStatus,
      required: true,
    });

    this.addRule('version', {
      field: 'version',
      validator: this.validateVersion,
      required: true,
    });

    this.addRule('pagesEnabled', {
      field: 'pagesEnabled',
      validator: this.validatePagesEnabled,
      required: true,
      dependencies: ['status'],
    });

    this.addRule('config', {
      field: 'config',
      validator: this.validateEventConfig,
      required: true,
    });

    this.addRule('activeAdminId', {
      field: 'activeAdminId',
      validator: this.validateAdminId,
      required: false,
    });

    this.addRule('isConnected', {
      field: 'isConnected',
      validator: this.validateConnectionStatus,
      required: true,
    });

    // Optimistic update rules
    this.addRule('optimisticUpdate', {
      field: 'optimisticUpdate',
      validator: this.validateOptimisticUpdate,
      required: true,
    });
  }

  /**
   * Add validation rule
   */
  addRule(ruleName: string, rule: ValidationRule): void {
    if (!this.rules.has(ruleName)) {
      this.rules.set(ruleName, []);
    }
    this.rules.get(ruleName)!.push(rule);
  }

  /**
   * Validate global event state
   */
  validateGlobalEventState(state: GlobalEventState): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate each field
    for (const [ruleName, rules] of this.rules) {
      for (const rule of rules) {
        if (rule.field === 'optimisticUpdate') continue; // Skip optimistic update rules

        const value = this.getFieldValue(state, rule.field);
        const result = rule.validator(value, state);

        errors.push(...result.errors);
        warnings.push(...result.warnings);
      }
    }

    // Cross-field validation
    const crossFieldResult = this.validateCrossFields(state);
    errors.push(...crossFieldResult.errors);
    warnings.push(...crossFieldResult.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate optimistic update
   */
  validateOptimisticUpdate(update: OptimisticUpdate): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate update structure
    if (!update.id || typeof update.id !== 'string') {
      errors.push({
        field: 'id',
        message: 'Update ID is required and must be a string',
        code: 'INVALID_ID',
        severity: 'error',
      });
    }

    if (!update.type || !['status', 'config', 'admin', 'pages'].includes(update.type)) {
      errors.push({
        field: 'type',
        message: 'Update type must be one of: status, config, admin, pages',
        code: 'INVALID_TYPE',
        severity: 'error',
      });
    }

    if (!update.payload || typeof update.payload !== 'object') {
      errors.push({
        field: 'payload',
        message: 'Update payload is required and must be an object',
        code: 'INVALID_PAYLOAD',
        severity: 'error',
      });
    }

    if (typeof update.version !== 'number' || update.version < 0) {
      errors.push({
        field: 'version',
        message: 'Update version must be a non-negative number',
        code: 'INVALID_VERSION',
        severity: 'error',
      });
    }

    if (!update.status || !['pending', 'applying', 'applied', 'failed', 'conflict'].includes(update.status)) {
      errors.push({
        field: 'status',
        message: 'Update status must be one of: pending, applying, applied, failed, conflict',
        code: 'INVALID_STATUS',
        severity: 'error',
      });
    }

    if (typeof update.timestamp !== 'number' || update.timestamp <= 0) {
      errors.push({
        field: 'timestamp',
        message: 'Update timestamp must be a positive number',
        code: 'INVALID_TIMESTAMP',
        severity: 'error',
      });
    }

    // Validate payload based on type
    const payloadResult = this.validateUpdatePayload(update.type, update.payload);
    errors.push(...payloadResult.errors);
    warnings.push(...payloadResult.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate update payload based on type
   */
  private validateUpdatePayload(type: string, payload: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    switch (type) {
      case 'status':
        if (!payload.status || !['offline', 'standby', 'live'].includes(payload.status)) {
          errors.push({
            field: 'payload.status',
            message: 'Status must be one of: offline, standby, live',
            code: 'INVALID_STATUS_VALUE',
            severity: 'error',
          });
        }
        break;

      case 'config':
        if (!payload || typeof payload !== 'object') {
          errors.push({
            field: 'payload',
            message: 'Config payload must be an object',
            code: 'INVALID_CONFIG_PAYLOAD',
            severity: 'error',
          });
        } else {
          const configResult = this.validateEventConfig(payload);
          errors.push(...configResult.errors);
          warnings.push(...configResult.warnings);
        }
        break;

      case 'admin':
        if (!payload.adminId || typeof payload.adminId !== 'string') {
          errors.push({
            field: 'payload.adminId',
            message: 'Admin ID is required and must be a string',
            code: 'INVALID_ADMIN_ID',
            severity: 'error',
          });
        }
        if (!payload.adminName || typeof payload.adminName !== 'string') {
          errors.push({
            field: 'payload.adminName',
            message: 'Admin name is required and must be a string',
            code: 'INVALID_ADMIN_NAME',
            severity: 'error',
          });
        }
        break;

      case 'pages':
        if (!payload || typeof payload !== 'object') {
          errors.push({
            field: 'payload',
            message: 'Pages payload must be an object',
            code: 'INVALID_PAGES_PAYLOAD',
            severity: 'error',
          });
        } else {
          if (payload.requests !== undefined && typeof payload.requests !== 'boolean') {
            errors.push({
              field: 'payload.requests',
              message: 'Requests flag must be a boolean',
              code: 'INVALID_REQUESTS_FLAG',
              severity: 'error',
            });
          }
          if (payload.display !== undefined && typeof payload.display !== 'boolean') {
            errors.push({
              field: 'payload.display',
              message: 'Display flag must be a boolean',
              code: 'INVALID_DISPLAY_FLAG',
              severity: 'error',
            });
          }
        }
        break;
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate event status
   */
  private validateEventStatus = (status: EventState): ValidationResult => {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!status || !['offline', 'standby', 'live'].includes(status)) {
      errors.push({
        field: 'status',
        message: 'Event status must be one of: offline, standby, live',
        code: 'INVALID_EVENT_STATUS',
        severity: 'error',
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  };

  /**
   * Validate version
   */
  private validateVersion = (version: number): ValidationResult => {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (typeof version !== 'number' || version < 0) {
      errors.push({
        field: 'version',
        message: 'Version must be a non-negative number',
        code: 'INVALID_VERSION',
        severity: 'error',
      });
    }

    if (version > 1000000) {
      warnings.push({
        field: 'version',
        message: 'Version number is unusually high',
        code: 'HIGH_VERSION_NUMBER',
        suggestion: 'Consider resetting version counter',
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  };

  /**
   * Validate pages enabled
   */
  private validatePagesEnabled = (pagesEnabled: { requests: boolean; display: boolean }, context?: GlobalEventState): ValidationResult => {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!pagesEnabled || typeof pagesEnabled !== 'object') {
      errors.push({
        field: 'pagesEnabled',
        message: 'Pages enabled must be an object',
        code: 'INVALID_PAGES_ENABLED',
        severity: 'error',
      });
      return { isValid: false, errors, warnings };
    }

    if (typeof pagesEnabled.requests !== 'boolean') {
      errors.push({
        field: 'pagesEnabled.requests',
        message: 'Requests flag must be a boolean',
        code: 'INVALID_REQUESTS_FLAG',
        severity: 'error',
      });
    }

    if (typeof pagesEnabled.display !== 'boolean') {
      errors.push({
        field: 'pagesEnabled.display',
        message: 'Display flag must be a boolean',
        code: 'INVALID_DISPLAY_FLAG',
        severity: 'error',
      });
    }

    // Cross-validation with status
    if (context?.status === 'live' && !pagesEnabled.requests && !pagesEnabled.display) {
      errors.push({
        field: 'pagesEnabled',
        message: 'Live status requires at least one page to be enabled',
        code: 'LIVE_STATUS_REQUIRES_PAGES',
        severity: 'error',
        suggestion: 'Enable at least one page or change status to standby/offline',
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  };

  /**
   * Validate event config
   */
  private validateEventConfig = (config: EventConfig): ValidationResult => {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!config || typeof config !== 'object') {
      errors.push({
        field: 'config',
        message: 'Event config must be an object',
        code: 'INVALID_CONFIG',
        severity: 'error',
      });
      return { isValid: false, errors, warnings };
    }

    // Validate pages_enabled
    if (!config.pages_enabled || typeof config.pages_enabled !== 'object') {
      errors.push({
        field: 'config.pages_enabled',
        message: 'Pages enabled config is required',
        code: 'MISSING_PAGES_ENABLED',
        severity: 'error',
      });
    } else {
      const pagesResult = this.validatePagesEnabled(config.pages_enabled);
      errors.push(...pagesResult.errors);
      warnings.push(...pagesResult.warnings);
    }

    // Validate event title
    if (config.event_title && typeof config.event_title !== 'string') {
      errors.push({
        field: 'config.event_title',
        message: 'Event title must be a string',
        code: 'INVALID_EVENT_TITLE',
        severity: 'error',
      });
    }

    // Validate request limit
    if (config.request_limit !== undefined) {
      if (typeof config.request_limit !== 'number' || config.request_limit < 0) {
        errors.push({
          field: 'config.request_limit',
          message: 'Request limit must be a non-negative number',
          code: 'INVALID_REQUEST_LIMIT',
          severity: 'error',
        });
      } else if (config.request_limit > 1000) {
        warnings.push({
          field: 'config.request_limit',
          message: 'Request limit is very high',
          code: 'HIGH_REQUEST_LIMIT',
          suggestion: 'Consider if this limit is necessary',
        });
      }
    }

    // Validate auto_approve
    if (config.auto_approve !== undefined && typeof config.auto_approve !== 'boolean') {
      errors.push({
        field: 'config.auto_approve',
        message: 'Auto approve must be a boolean',
        code: 'INVALID_AUTO_APPROVE',
        severity: 'error',
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  };

  /**
   * Validate admin ID
   */
  private validateAdminId = (adminId: string | null): ValidationResult => {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (adminId !== null && (typeof adminId !== 'string' || adminId.length === 0)) {
      errors.push({
        field: 'activeAdminId',
        message: 'Admin ID must be null or a non-empty string',
        code: 'INVALID_ADMIN_ID',
        severity: 'error',
      });
    }

    if (adminId && adminId.length > 100) {
      warnings.push({
        field: 'activeAdminId',
        message: 'Admin ID is unusually long',
        code: 'LONG_ADMIN_ID',
        suggestion: 'Consider using shorter admin IDs',
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  };

  /**
   * Validate connection status
   */
  private validateConnectionStatus = (isConnected: boolean): ValidationResult => {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (typeof isConnected !== 'boolean') {
      errors.push({
        field: 'isConnected',
        message: 'Connection status must be a boolean',
        code: 'INVALID_CONNECTION_STATUS',
        severity: 'error',
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  };

  /**
   * Validate cross-fields
   */
  private validateCrossFields(state: GlobalEventState): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate status and pages consistency
    if (state.status === 'live' && !state.pagesEnabled.requests && !state.pagesEnabled.display) {
      errors.push({
        field: 'status',
        message: 'Live status requires at least one page to be enabled',
        code: 'LIVE_STATUS_REQUIRES_PAGES',
        severity: 'error',
        suggestion: 'Enable at least one page or change status to standby/offline',
      });
    }

    // Validate admin and status consistency
    if (state.status !== 'offline' && !state.activeAdminId) {
      warnings.push({
        field: 'activeAdminId',
        message: 'Non-offline status typically requires an active admin',
        code: 'MISSING_ACTIVE_ADMIN',
        suggestion: 'Consider setting an active admin for better state management',
      });
    }

    // Validate version consistency
    if (state.version < 0) {
      errors.push({
        field: 'version',
        message: 'Version cannot be negative',
        code: 'NEGATIVE_VERSION',
        severity: 'error',
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Get field value from state
   */
  private getFieldValue(state: GlobalEventState, field: string): any {
    const fields = field.split('.');
    let value: any = state;
    
    for (const f of fields) {
      if (value && typeof value === 'object' && f in value) {
        value = value[f];
      } else {
        return undefined;
      }
    }
    
    return value;
  }
}

/**
 * Error handler for state validation
 */
export class StateErrorHandler {
  private validator: StateValidator;

  constructor() {
    this.validator = new StateValidator();
  }

  /**
   * Handle validation errors
   */
  handleValidationErrors(result: ValidationResult): void {
    if (!result.isValid) {
      console.error('State validation failed:', result.errors);
      
      // Log each error with details
      result.errors.forEach(error => {
        console.error(`Validation Error [${error.code}]: ${error.message}`, {
          field: error.field,
          severity: error.severity,
          suggestion: error.suggestion,
        });
      });
    }

    // Log warnings
    if (result.warnings.length > 0) {
      console.warn('State validation warnings:', result.warnings);
      
      result.warnings.forEach(warning => {
        console.warn(`Validation Warning [${warning.code}]: ${warning.message}`, {
          field: warning.field,
          suggestion: warning.suggestion,
        });
      });
    }
  }

  /**
   * Validate and handle state
   */
  validateAndHandle(state: GlobalEventState): ValidationResult {
    const result = this.validator.validateGlobalEventState(state);
    this.handleValidationErrors(result);
    return result;
  }

  /**
   * Validate and handle optimistic update
   */
  validateAndHandleUpdate(update: OptimisticUpdate): ValidationResult {
    const result = this.validator.validateOptimisticUpdate(update);
    this.handleValidationErrors(result);
    return result;
  }
}

// Export singleton instances
export const stateValidator = new StateValidator();
export const stateErrorHandler = new StateErrorHandler();

export type { ValidationResult, ValidationError, ValidationWarning, ValidationRule };
