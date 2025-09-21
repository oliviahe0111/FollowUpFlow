// Domain types for the application
// This file contains shared types to reduce 'any' usage throughout the codebase

// Import Prisma DB model types
import type { Board as PrismaBoard, Node as PrismaNode, Edge as PrismaEdge, NodeType as PrismaNodeType } from '@prisma/client';

// === DB Models (from Prisma) ===
export type { PrismaBoard, PrismaNode, PrismaEdge, PrismaNodeType };

// === API DTOs (snake_case for responses) ===
export interface ApiBoard {
  id: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
}

export interface ApiNode {
  id: string;
  board_id: string;
  type: PrismaNodeType;
  content: string;
  root_id: string | null;
  parent_id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  created_at: string;
  updated_at: string;
}

export interface ApiEdge {
  id: string;
  board_id: string;
  source_id: string;
  target_id: string;
  created_at: string;
  updated_at: string;
}

// Legacy aliases for backward compatibility (will be removed later)
export type Board = ApiBoard;
export type Node = ApiNode;
export type Edge = ApiEdge;
export type NodeType = PrismaNodeType;

// API Response envelopes
export interface ApiSuccessResponse<T> {
  data: T;
}

export interface ApiErrorResponse {
  error: string;
  code?: string;
}

// Request types for API endpoints
export interface CreateBoardRequest {
  title: string;
  description?: string;
}

export interface CreateNodeRequest {
  board_id: string;
  type: PrismaNodeType;
  content: string;
  root_id?: string;
  parent_id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CreateEdgeRequest {
  board_id: string;
  source_id: string;
  target_id: string;
}

export interface UpdateNodeRequest {
  content?: string;
  type?: PrismaNodeType;
  root_id?: string;
  parent_id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

// Utility types for transformations
export interface CamelCaseNode {
  id: string;
  boardId: string;
  type: PrismaNodeType;
  content: string;
  rootId: string | null;
  parentId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
}

export interface CamelCaseEdge {
  id: string;
  boardId: string;
  sourceId: string;
  targetId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CamelCaseBoard {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
}

// Transformation helpers
export function toSnakeCase<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    result[snakeKey] = value;
  }
  return result;
}

export function toCamelCase<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

// Validation helpers
export function isValidNodeType(type: string): type is PrismaNodeType {
  return ['root_question', 'ai_answer', 'followup_question', 'followup_answer'].includes(type);
}

export function isValidId(str: string): boolean {
  // Support both UUID and CUID formats since Prisma uses CUID by default
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const cuidRegex = /^c[a-z0-9]{24}$/i; // CUID format: starts with 'c' followed by 24 alphanumeric chars
  
  return uuidRegex.test(str) || cuidRegex.test(str);
}

// Prisma result transformers (DB models -> API DTOs)
export function nodeToDTO(node: PrismaNode): ApiNode {
  return {
    id: node.id,
    board_id: node.boardId,
    type: node.type,
    content: node.content,
    root_id: node.rootId,
    parent_id: node.parentId,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    created_at: node.createdAt.toISOString(),
    updated_at: node.updatedAt.toISOString(),
  };
}

export function edgeToDTO(edge: PrismaEdge): ApiEdge {
  return {
    id: edge.id,
    board_id: edge.boardId,
    source_id: edge.sourceId,
    target_id: edge.targetId,
    created_at: edge.createdAt.toISOString(),
    updated_at: edge.createdAt.toISOString(), // Edge model only has createdAt
  };
}

export function boardToDTO(board: PrismaBoard): ApiBoard {
  return {
    id: board.id,
    title: board.title,
    description: board.description || '',
    owner_id: (board as { ownerId?: string | null }).ownerId || '',
    created_at: board.createdAt.toISOString(),
    updated_at: board.createdAt.toISOString(), // Board model only has createdAt
  };
}