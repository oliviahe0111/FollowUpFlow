// Base API configuration
const API_BASE = '';

// Helper function for making API requests
async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = await fetch(url, { ...defaultOptions, ...options });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Board entity
export class Board {
  static async list(orderBy: string = '-created_date', limit?: number) {
    try {
      const response = await apiRequest('/api/boards');
      return response;
    } catch (error) {
      console.error('Error fetching boards:', error);
      throw error;
    }
  }

  static async create(data: { title: string; description?: string }) {
    try {
      const response = await apiRequest('/api/boards', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response;
    } catch (error) {
      console.error('Error creating board:', error);
      throw error;
    }
  }
}

// Node entity
export class Node {
  static async filter(params: { board_id: string }) {
    try {
      const response = await apiRequest(`/api/nodes?board_id=${params.board_id}`);
      return response;
    } catch (error) {
      console.error('Error fetching nodes:', error);
      throw error;
    }
  }

  static async create(data: {
    board_id: string;
    type: string;
    content: string;
    root_id?: string;
    parent_id?: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }) {
    try {
      const response = await apiRequest('/api/nodes', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response;
    } catch (error) {
      console.error('Error creating node:', error);
      throw error;
    }
  }

  static async update(id: string, data: any) {
    try {
      const response = await apiRequest(`/api/nodes?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      return response;
    } catch (error) {
      console.error('Error updating node:', error);
      throw error;
    }
  }
}

// Edge entity
export class Edge {
  static async filter(params: { board_id: string }) {
    try {
      const response = await apiRequest(`/api/edges?board_id=${params.board_id}`);
      return response;
    } catch (error) {
      console.error('Error fetching edges:', error);
      throw error;
    }
  }

  static async create(data: {
    board_id: string;
    source_id: string;
    target_id: string;
  }) {
    try {
      const response = await apiRequest('/api/edges', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response;
    } catch (error) {
      console.error('Error creating edge:', error);
      throw error;
    }
  }
}