export enum LogLevel { DEBUG = 0, INFO = 1, WARN = 2, ERROR = 3 }
export enum LogCategory { PROMPT = 'prompt', RESPONSE = 'response', METRICS = 'metrics', ERROR = 'error', CONFIG = 'config' }
export type MessageRole = 'system' | 'user' | 'assistant' | 'function' | 'tool'
export interface LogMessage { role: MessageRole; content: string; name?: string; function_call?: { name: string; arguments: string } }
export interface TokenUsage { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; details?: Record<string, unknown> }
export interface TimingInfo { time_to_first_byte_ms?: number; total_duration_ms: number; request_received_at?: string; response_sent_at?: string }
export interface RequestContext { request_id: string; user_id?: string; session_id?: string; ip_address?: string; user_agent?: string }
export interface ModelInfo { provider: string; model: string; base_url?: string }
export interface LogEntry { timestamp: string; level: LogLevel; category: LogCategory; request_id: string; context?: RequestContext; messages?: LogMessage[]; content?: string; model?: ModelInfo; token_usage?: TokenUsage; timing?: TimingInfo; success: boolean; error_code?: string; error_message?: string; is_streaming?: boolean; streaming_chunk_index?: number }
export interface LogFilter { min_level: LogLevel; categories?: LogCategory[]; providers?: string[]; exclude_patterns?: string[] }
export interface SanitizationConfig { redact_fields?: string[]; content_patterns?: Array<{ pattern: string; replacement: string }>; max_content_length?: number }
export interface ILogFormatter { format(entry: LogEntry): string; content_type: string }
export interface ILogSink { write(entry: LogEntry): void | Promise<void>; flush(): void | Promise<void>; close(): void | Promise<void> }
export interface LoggerConfig { level: LogLevel; categories?: LogCategory[]; sinks: ILogSink[]; formatter: ILogFormatter; filter?: LogFilter; sanitization?: SanitizationConfig; async_mode?: boolean; buffer_size?: number }