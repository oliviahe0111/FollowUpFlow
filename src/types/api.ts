/**
 * Shared API types and DTOs for type-safe API communication
 */

// Node types from Prisma schema
export type NodeType = 'root_question' | 'followup_question' | 'ai_answer' | 'followup_answer';

// Base DTOs matching database schema
export interface BoardDTO {
  id: string;
  title: string;
  description?: string;
  owner_id: string;
  created_at: string; // ISO string
  updated_at: string; // ISO string
}

export interface NodeDTO {
  id: string;
  board_id: string;
  type: NodeType;
  content: string;
  root_id?: string;
  parent_id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  created_at: string; // ISO string
  updated_at: string; // ISO string
}

export interface EdgeDTO {
  id: string;
  board_id: string;
  source_id: string;
  target_id: string;
  created_at: string; // ISO string
  updated_at: string; // ISO string
}

// Request body types
export interface CreateBoardBody {
  title: string;
  description?: string;
}

export interface CreateNodeBody {
  board_id: string;
  type: NodeType;
  content: string;
  root_id?: string;
  parent_id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UpdateNodeBody {
  content?: string;
  type?: NodeType;
  root_id?: string;
  parent_id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface CreateEdgeBody {
  board_id: string;
  source_id: string;
  target_id: string;
}

// LLM API types
export interface LLMRequest {
  prompt: string;
  system?: string;
  max_completion_tokens?: number;
  max_tokens?: number; // Legacy support
  temperature?: number;
}

export interface LLMResponse {
  content: string;
}

// Error response type
export interface ErrorResponse {
  error: string;
  code?: string;
}

//Type guard functions
export function isValidNodeType(type: unknown): type is NodeType {
  return typeof type === 'string' && 
    ['root_question', 'followup_question', 'ai_answer', 'followup_answer'].includes(type);
}

export function isCreateBoardBody(body: unknown): body is CreateBoardBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  
  return (
    typeof b.title === 'string' &&
    b.title.trim().length > 0 &&
    (b.description === undefined || typeof b.description === 'string')
  );
}

export function isCreateNodeBody(body: unknown): body is CreateNodeBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  
  return (
    typeof b.board_id === 'string' &&
    isValidNodeType(b.type) &&
    typeof b.content === 'string' &&
    typeof b.x === 'number' &&
    typeof b.y === 'number' &&
    typeof b.width === 'number' &&
    typeof b.height === 'number' &&
    (b.root_id === undefined || b.root_id === null || typeof b.root_id === 'string') &&
    (b.parent_id === undefined || b.parent_id === null || typeof b.parent_id === 'string')
  );
}

export function isUpdateNodeBody(body: unknown): body is UpdateNodeBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  
  // At least one field must be provided
  const hasValidField = (
    (b.content !== undefined && typeof b.content === 'string') ||
    (b.type !== undefined && isValidNodeType(b.type)) ||
    (b.x !== undefined && typeof b.x === 'number') ||
    (b.y !== undefined && typeof b.y === 'number') ||
    (b.width !== undefined && typeof b.width === 'number') ||
    (b.height !== undefined && typeof b.height === 'number') ||
    (b.root_id !== undefined && (b.root_id === null || typeof b.root_id === 'string')) ||
    (b.parent_id !== undefined && (b.parent_id === null || typeof b.parent_id === 'string'))
  );
  
  return hasValidField;
}

export function isCreateEdgeBody(body: unknown): body is CreateEdgeBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  
  return (
    typeof b.board_id === 'string' &&
    typeof b.source_id === 'string' &&
    typeof b.target_id === 'string'
  );
}

export function isLLMRequest(body: unknown): body is LLMRequest {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  
  return (
    typeof b.prompt === 'string' &&
    b.prompt.trim().length > 0 &&
    (b.system === undefined || typeof b.system === 'string') &&
    (b.max_completion_tokens === undefined || (typeof b.max_completion_tokens === 'number' && b.max_completion_tokens > 0)) &&
    (b.max_tokens === undefined || (typeof b.max_tokens === 'number' && b.max_tokens > 0)) &&
    (b.temperature === undefined || (typeof b.temperature === 'number' && b.temperature >= 0 && b.temperature <= 2))
  );
}

// Helper function to convert Prisma dates to strings
export function toDTOWithDates<T extends Record<string, unknown>>(obj: T): T & { created_at: string; updated_at: string } {
  return {
    ...obj,
    created_at: obj.createdAt instanceof Date ? obj.createdAt.toISOString() : String(obj.createdAt),
    updated_at: obj.updatedAt instanceof Date ? obj.updatedAt.toISOString() : String(obj.updatedAt),
  };
}

// Query parameter validation helpers
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export function validateRequiredQueryParam(param: string | string[] | undefined, name: string): string {
  if (!param || Array.isArray(param)) {
    throw new Error(`${name} is required and must be a single value`);
  }
  return param;
}