export type MindMapStatus = 'active' | 'archived';
export type MindMapRole = 'owner' | 'editor' | 'viewer';
export type NodeShape = 'rounded' | 'pill' | 'rectangle' | 'diamond' | 'ellipse' | 'underline';

export interface CanvasSettings {
  zoom: number;
  panX: number;
  panY: number;
  grid: boolean;
  connectorStyle: 'curved' | 'straight' | 'elbow';
  background: string;
}

export interface NodeStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  shape?: NodeShape;
  fontSize?: number;
  fontColor?: string;
  fontWeight?: 'normal' | 'semibold' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  lineColor?: string;
}

export interface EdgeStyle {
  strokeColor?: string;
  strokeWidth?: number;
  dashed?: boolean;
  arrow?: boolean;
}

export interface MindMapRecord {
  id: string;
  company_id: string;
  created_by: string;
  title: string;
  description: string | null;
  status: MindMapStatus;
  canvas_settings: CanvasSettings;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Computed client fields for list view
  node_count?: number;
  my_role?: MindMapRole;
  creator_name?: string;
}

export interface MindMapNode {
  id: string;
  mind_map_id: string;
  parent_node_id: string | null;
  title: string;
  description: string | null;
  notes: string | null;
  node_type: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  sort_order: number;
  style: NodeStyle;
  is_collapsed: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MindMapEdge {
  id: string;
  mind_map_id: string;
  source_node_id: string;
  target_node_id: string;
  label: string | null;
  edge_type: string;
  style: EdgeStyle;
  created_at: string;
}

export interface MindMapMember {
  id: string;
  mind_map_id: string;
  user_id: string;
  role: MindMapRole;
  invited_by: string | null;
  created_at: string;
  user?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  };
}

export interface ColleagueUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  company_id: string | null;
}

export interface TemplateNodeSeed {
  temp_id: string;
  parent_temp_id: string | null;
  title: string;
  description?: string;
  notes?: string;
  node_type: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  sort_order: number;
  style: NodeStyle;
}

export interface TemplateEdgeSeed {
  source_temp_id: string;
  target_temp_id: string;
  label?: string;
  edge_type?: string;
  style?: EdgeStyle;
}

export interface MindMapTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  accent: string;
  defaultTitle: string;
  nodes: TemplateNodeSeed[];
  edges?: TemplateEdgeSeed[];
}

export const DEFAULT_CANVAS_SETTINGS: CanvasSettings = {
  zoom: 1,
  panX: 0,
  panY: 0,
  grid: true,
  connectorStyle: 'curved',
  background: '#f8fbff',
};

export const NODE_COLOR_PALETTE: {
  name: string;
  bg: string;
  border: string;
  text: string;
  line: string;
}[] = [
  { name: 'Slate Navy', bg: '#0f172a', border: '#3b82f6', text: '#ffffff', line: '#3b82f6' },
  { name: 'Argus Blue', bg: '#eff6ff', border: '#3b82f6', text: '#1e3a8a', line: '#3b82f6' },
  { name: 'Emerald', bg: '#ecfdf5', border: '#10b981', text: '#065f46', line: '#10b981' },
  { name: 'Orange', bg: '#fff7ed', border: '#f97316', text: '#9a3412', line: '#f97316' },
  { name: 'Violet', bg: '#f5f3ff', border: '#8b5cf6', text: '#4c1d95', line: '#8b5cf6' },
  { name: 'Amber', bg: '#fffbeb', border: '#f59e0b', text: '#78350f', line: '#f59e0b' },
  { name: 'Rose', bg: '#fff1f2', border: '#f43f5e', text: '#881337', line: '#f43f5e' },
  { name: 'Cyan', bg: '#ecfeff', border: '#06b6d4', text: '#155e75', line: '#06b6d4' },
  { name: 'Pure White', bg: '#ffffff', border: '#cbd5e1', text: '#0f172a', line: '#64748b' },
  { name: 'Solid Blue', bg: '#2563eb', border: '#1d4ed8', text: '#ffffff', line: '#2563eb' },
  { name: 'Solid Emerald', bg: '#059669', border: '#047857', text: '#ffffff', line: '#059669' },
  { name: 'Solid Rose', bg: '#e11d48', border: '#be123c', text: '#ffffff', line: '#e11d48' },
];
