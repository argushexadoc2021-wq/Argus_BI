import { supabase } from '@/lib/supabase';
import {
  DEFAULT_CANVAS_SETTINGS,
  type CanvasSettings,
  type ColleagueUser,
  type EdgeStyle,
  type MindMapEdge,
  type MindMapMember,
  type MindMapNode,
  type MindMapRecord,
  type MindMapRole,
  type MindMapStatus,
  type NodeStyle,
  type TemplateEdgeSeed,
  type TemplateNodeSeed,
} from './types';

function normalizeCanvas(raw: any): CanvasSettings {
  return {
    zoom: Number(raw?.zoom) || DEFAULT_CANVAS_SETTINGS.zoom,
    panX: Number(raw?.panX) || 0,
    panY: Number(raw?.panY) || 0,
    grid: raw?.grid !== false,
    connectorStyle:
      raw?.connectorStyle === 'straight' || raw?.connectorStyle === 'elbow'
        ? raw.connectorStyle
        : 'curved',
    background: typeof raw?.background === 'string' && raw.background ? raw.background : '#f8fbff',
  };
}

function normalizeMap(row: any): MindMapRecord {
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    created_by: String(row.created_by),
    title: String(row.title || 'Untitled Mind Map'),
    description: row.description ?? null,
    status: row.status === 'archived' ? 'archived' : 'active',
    canvas_settings: normalizeCanvas(row.canvas_settings),
    version: Number(row.version) || 1,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    deleted_at: row.deleted_at ?? null,
    node_count: row.node_count != null ? Number(row.node_count) : undefined,
    my_role: row.my_role,
    creator_name: row.creator_name,
  };
}

function normalizeNode(row: any): MindMapNode {
  return {
    id: String(row.id),
    mind_map_id: String(row.mind_map_id),
    parent_node_id: row.parent_node_id ? String(row.parent_node_id) : null,
    title: String(row.title ?? ''),
    description: row.description ?? null,
    notes: row.notes ?? null,
    node_type: String(row.node_type || (row.parent_node_id ? 'topic' : 'root')),
    position_x: Number(row.position_x) || 0,
    position_y: Number(row.position_y) || 0,
    width: Math.max(80, Number(row.width) || 184),
    height: Math.max(38, Number(row.height) || 56),
    sort_order: Number(row.sort_order) || 0,
    style: (row.style && typeof row.style === 'object' ? row.style : {}) as NodeStyle,
    is_collapsed: Boolean(row.is_collapsed),
    created_by: row.created_by ? String(row.created_by) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function normalizeEdge(row: any): MindMapEdge {
  return {
    id: String(row.id),
    mind_map_id: String(row.mind_map_id),
    source_node_id: String(row.source_node_id),
    target_node_id: String(row.target_node_id),
    label: row.label ?? null,
    edge_type: String(row.edge_type || 'connection'),
    style: (row.style && typeof row.style === 'object' ? row.style : {}) as EdgeStyle,
    created_at: String(row.created_at),
  };
}

export class VersionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VersionConflictError';
  }
}

export interface LoadedMindMap {
  map: MindMapRecord;
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  members: MindMapMember[];
  myRole: MindMapRole;
}

export const mindMapApi = {
  /** List all accessible non-deleted mind maps for the current company & user */
  async listMindMaps(
    companyId: string | null,
    currentUserId: string | null,
    isAdmin: boolean,
  ): Promise<MindMapRecord[]> {
    let q = supabase
      .from('mind_maps')
      .select('*')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
    if (companyId) q = q.eq('company_id', companyId);

    const { data: mapsRaw, error } = await q;
    if (error) throw new Error(error.message);
    const maps = (mapsRaw ?? []).map(normalizeMap);
    if (!maps.length) return [];

    const mapIds = maps.map((m) => m.id);
    const creatorIds = Array.from(new Set(maps.map((m) => m.created_by)));

    const [nodesRes, membersRes, creatorsRes] = await Promise.all([
      supabase.from('mind_map_nodes').select('mind_map_id').in('mind_map_id', mapIds),
      currentUserId
        ? supabase
            .from('mind_map_members')
            .select('mind_map_id, role')
            .eq('user_id', currentUserId)
            .in('mind_map_id', mapIds)
        : Promise.resolve({ data: [] as any[] }),
      creatorIds.length
        ? supabase.from('company_users').select('id, full_name, email').in('id', creatorIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const counts = new Map<string, number>();
    for (const n of (nodesRes.data ?? []) as any[]) {
      counts.set(n.mind_map_id, (counts.get(n.mind_map_id) ?? 0) + 1);
    }

    const roleMap = new Map<string, MindMapRole>();
    for (const mem of (membersRes.data ?? []) as any[]) {
      roleMap.set(mem.mind_map_id, mem.role as MindMapRole);
    }

    const creatorMap = new Map<string, string>();
    for (const u of (creatorsRes.data ?? []) as any[]) {
      creatorMap.set(u.id, u.full_name || u.email || 'User');
    }

    return maps.map((m) => ({
      ...m,
      node_count: counts.get(m.id) ?? 0,
      my_role:
        isAdmin || (currentUserId && m.created_by === currentUserId)
          ? 'owner'
          : roleMap.get(m.id) ?? 'viewer',
      creator_name: creatorMap.get(m.created_by) ?? 'Team Member',
    }));
  },

  /** Load a single mind map with all relational nodes, custom edges, and members */
  async loadMindMap(
    mapId: string,
    currentUserId: string | null,
    isAdmin: boolean,
  ): Promise<LoadedMindMap> {
    const { data: mapRow, error: mapErr } = await supabase
      .from('mind_maps')
      .select('*')
      .eq('id', mapId)
      .is('deleted_at', null)
      .maybeSingle();

    if (mapErr) throw new Error(mapErr.message);
    if (!mapRow) throw new Error('Mind map not found or you do not have access.');

    const [nodesRes, edgesRes, membersRes] = await Promise.all([
      supabase
        .from('mind_map_nodes')
        .select('*')
        .eq('mind_map_id', mapId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('mind_map_edges')
        .select('*')
        .eq('mind_map_id', mapId)
        .order('created_at', { ascending: true }),
      supabase
        .from('mind_map_members')
        .select('*')
        .eq('mind_map_id', mapId)
        .order('created_at', { ascending: true }),
    ]);

    if (nodesRes.error) throw new Error(nodesRes.error.message);
    if (edgesRes.error) throw new Error(edgesRes.error.message);

    const rawMembers = (membersRes.data ?? []) as any[];
    const userIds = Array.from(new Set(rawMembers.map((m) => m.user_id)));
    const userLookup = new Map<string, { id: string; full_name: string; email: string; role: string }>();
    if (userIds.length) {
      const { data: users } = await supabase
        .from('company_users')
        .select('id, full_name, email, role')
        .in('id', userIds);
      for (const u of (users ?? []) as any[]) {
        userLookup.set(u.id, {
          id: String(u.id),
          full_name: String(u.full_name || u.email || 'User'),
          email: String(u.email || ''),
          role: String(u.role || 'USER'),
        });
      }
    }

    const members: MindMapMember[] = rawMembers.map((m) => ({
      id: String(m.id),
      mind_map_id: String(m.mind_map_id),
      user_id: String(m.user_id),
      role: m.role as MindMapRole,
      invited_by: m.invited_by ? String(m.invited_by) : null,
      created_at: String(m.created_at),
      user: userLookup.get(String(m.user_id)),
    }));

    const map = normalizeMap(mapRow);
    const myMember = currentUserId ? members.find((m) => m.user_id === currentUserId) : undefined;
    const myRole: MindMapRole =
      isAdmin || (currentUserId && map.created_by === currentUserId)
        ? 'owner'
        : myMember?.role ?? 'viewer';

    return {
      map: { ...map, my_role: myRole },
      nodes: (nodesRes.data ?? []).map(normalizeNode),
      edges: (edgesRes.data ?? []).map(normalizeEdge),
      members,
      myRole,
    };
  },

  /** Atomically create a new mind map + root node (+ optional template nodes & edges) in 1 DB transaction */
  async createMindMap(opts: {
    companyId: string | null;
    title: string;
    description?: string | null;
    canvasSettings?: Partial<CanvasSettings>;
    nodes?: TemplateNodeSeed[];
    edges?: TemplateEdgeSeed[];
  }): Promise<{ map: MindMapRecord; nodes: MindMapNode[]; edges: MindMapEdge[] }> {
    const { data, error } = await supabase.rpc('mm_create_mind_map', {
      p_company_id: opts.companyId,
      p_title: opts.title,
      p_description: opts.description ?? null,
      p_canvas_settings: { ...DEFAULT_CANVAS_SETTINGS, ...(opts.canvasSettings ?? {}) },
      p_nodes: opts.nodes ?? [],
      p_edges: opts.edges ?? [],
    });

    if (error) throw new Error(error.message);
    const payload = data as any;
    return {
      map: normalizeMap(payload.mind_map),
      nodes: (payload.nodes ?? []).map(normalizeNode),
      edges: (payload.edges ?? []).map(normalizeEdge),
    };
  },

  /** Update mind map metadata with optimistic concurrency version check */
  async updateMindMapMeta(
    id: string,
    patch: {
      title?: string;
      description?: string | null;
      status?: MindMapStatus;
      canvas_settings?: CanvasSettings;
      expectedVersion?: number;
    },
  ): Promise<MindMapRecord> {
    const { data, error } = await supabase.rpc('mm_update_mind_map_meta', {
      p_id: id,
      p_title: patch.title ?? null,
      p_description: patch.description !== undefined ? (patch.description ?? '') : null,
      p_status: patch.status ?? null,
      p_canvas_settings: patch.canvas_settings ?? null,
      p_expected_version: patch.expectedVersion ?? null,
    });
    if (error) {
      if (error.message?.includes('VERSION_CONFLICT') || error.code === '40001') {
        throw new VersionConflictError(
          'This mind map was updated in another tab or by a teammate. Reload to get the latest version.',
        );
      }
      throw new Error(error.message);
    }
    return normalizeMap(data);
  },

  /** Duplicate an entire mind map (nodes, hierarchy & edges) in one DB transaction */
  async duplicateMindMap(sourceId: string, newTitle?: string): Promise<MindMapRecord> {
    const { data, error } = await supabase.rpc('mm_duplicate_mind_map', {
      p_source_id: sourceId,
      p_new_title: newTitle ?? null,
    });
    if (error) throw new Error(error.message);
    return normalizeMap(data);
  },

  /** Soft delete a mind map (sets deleted_at) */
  async softDeleteMindMap(id: string): Promise<void> {
    const { error } = await supabase.rpc('mm_soft_delete_mind_map', { p_id: id });
    if (error) throw new Error(error.message);
  },

  // ------------------------------------------------------------------ Independent Node Persistence

  async createNode(input: {
    mind_map_id: string;
    parent_node_id: string;
    title: string;
    description?: string | null;
    notes?: string | null;
    node_type?: string;
    position_x: number;
    position_y: number;
    width?: number;
    height?: number;
    sort_order?: number;
    style?: NodeStyle;
    created_by?: string | null;
  }): Promise<MindMapNode> {
    const { data, error } = await supabase
      .from('mind_map_nodes')
      .insert([
        {
          mind_map_id: input.mind_map_id,
          parent_node_id: input.parent_node_id,
          title: input.title,
          description: input.description ?? null,
          notes: input.notes ?? null,
          node_type: input.node_type ?? 'topic',
          position_x: Math.round(input.position_x),
          position_y: Math.round(input.position_y),
          width: Math.max(80, Math.round(input.width ?? 184)),
          height: Math.max(38, Math.round(input.height ?? 56)),
          sort_order: input.sort_order ?? 0,
          style: input.style ?? {},
          is_collapsed: false,
          created_by: input.created_by ?? null,
        },
      ])
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return normalizeNode(data);
  },

  async updateNode(
    nodeId: string,
    patch: Partial<{
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
    }>,
  ): Promise<MindMapNode> {
    const payload: Record<string, any> = {};
    if (patch.parent_node_id !== undefined) payload.parent_node_id = patch.parent_node_id;
    if (patch.title !== undefined) payload.title = patch.title;
    if (patch.description !== undefined) payload.description = patch.description;
    if (patch.notes !== undefined) payload.notes = patch.notes;
    if (patch.node_type !== undefined) payload.node_type = patch.node_type;
    if (patch.position_x !== undefined) payload.position_x = Math.round(patch.position_x);
    if (patch.position_y !== undefined) payload.position_y = Math.round(patch.position_y);
    if (patch.width !== undefined) payload.width = Math.max(80, Math.round(patch.width));
    if (patch.height !== undefined) payload.height = Math.max(38, Math.round(patch.height));
    if (patch.sort_order !== undefined) payload.sort_order = patch.sort_order;
    if (patch.style !== undefined) payload.style = patch.style;
    if (patch.is_collapsed !== undefined) payload.is_collapsed = patch.is_collapsed;

    const { data, error } = await supabase
      .from('mind_map_nodes')
      .update(payload)
      .eq('id', nodeId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return normalizeNode(data);
  },

  /** Atomically insert a parent node above a selected node (supports both child and root nodes) */
  async insertParentNode(opts: {
    mindMapId: string;
    childNodeId: string;
    title?: string;
    positionX?: number;
    positionY?: number;
    width?: number;
    height?: number;
    style?: NodeStyle;
  }): Promise<{ wrappedRoot: boolean; newParent: MindMapNode; childNode: MindMapNode }> {
    const { data, error } = await supabase.rpc('mm_insert_parent_node', {
      p_mind_map_id: opts.mindMapId,
      p_child_node_id: opts.childNodeId,
      p_title: opts.title ?? 'Parent Topic',
      p_position_x: opts.positionX != null ? Math.round(opts.positionX) : null,
      p_position_y: opts.positionY != null ? Math.round(opts.positionY) : null,
      p_width: opts.width ?? 192,
      p_height: opts.height ?? 60,
      p_style: opts.style ?? {},
    });
    if (error) throw new Error(error.message);
    const j = data as any;
    return {
      wrappedRoot: Boolean(j.wrapped_root),
      newParent: normalizeNode(j.new_parent),
      childNode: normalizeNode(j.child_node),
    };
  },

  /** Atomically delete a non-root node and all its descendants */
  async deleteNodeSubtree(mindMapId: string, nodeId: string): Promise<string[]> {
    const { data, error } = await supabase.rpc('mm_delete_node_subtree', {
      p_mind_map_id: mindMapId,
      p_node_id: nodeId,
    });
    if (error) throw new Error(error.message);
    return ((data as any)?.deleted_ids ?? []).map(String);
  },

  /** Atomically paste / duplicate a subtree under a target parent */
  async pasteSubtree(
    mindMapId: string,
    targetParentId: string,
    nodes: TemplateNodeSeed[],
  ): Promise<MindMapNode[]> {
    const { data, error } = await supabase.rpc('mm_paste_subtree', {
      p_mind_map_id: mindMapId,
      p_target_parent_id: targetParentId,
      p_nodes: nodes,
    });
    if (error) throw new Error(error.message);
    return ((data as any[]) ?? []).map(normalizeNode);
  },

  // ------------------------------------------------------------------ Custom Non-Hierarchical Edges

  async createEdge(input: {
    mind_map_id: string;
    source_node_id: string;
    target_node_id: string;
    label?: string | null;
    edge_type?: string;
    style?: EdgeStyle;
  }): Promise<MindMapEdge> {
    const { data, error } = await supabase
      .from('mind_map_edges')
      .insert([
        {
          mind_map_id: input.mind_map_id,
          source_node_id: input.source_node_id,
          target_node_id: input.target_node_id,
          label: input.label ?? null,
          edge_type: input.edge_type ?? 'connection',
          style: input.style ?? { strokeColor: '#6366f1', strokeWidth: 2, dashed: true, arrow: true },
        },
      ])
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return normalizeEdge(data);
  },

  async updateEdge(
    edgeId: string,
    patch: { label?: string | null; style?: EdgeStyle },
  ): Promise<MindMapEdge> {
    const { data, error } = await supabase
      .from('mind_map_edges')
      .update(patch)
      .eq('id', edgeId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return normalizeEdge(data);
  },

  async deleteEdge(edgeId: string): Promise<void> {
    const { error } = await supabase.from('mind_map_edges').delete().eq('id', edgeId);
    if (error) throw new Error(error.message);
  },

  // ------------------------------------------------------------------ Sharing & Company Members

  async listCompanyColleagues(companyId: string | null): Promise<ColleagueUser[]> {
    let q = supabase
      .from('company_users')
      .select('id, full_name, email, role, company_id')
      .eq('status', 'Active')
      .order('full_name', { ascending: true });
    if (companyId) q = q.eq('company_id', companyId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((u) => ({
      id: String(u.id),
      full_name: String(u.full_name || u.email || 'User'),
      email: String(u.email || ''),
      role: String(u.role || 'USER'),
      company_id: u.company_id ? String(u.company_id) : null,
    }));
  },

  async upsertMember(
    mindMapId: string,
    userId: string,
    role: MindMapRole,
    invitedBy: string | null,
  ): Promise<MindMapMember> {
    const { data, error } = await supabase
      .from('mind_map_members')
      .upsert(
        {
          mind_map_id: mindMapId,
          user_id: userId,
          role,
          invited_by: invitedBy,
        },
        { onConflict: 'mind_map_id,user_id' },
      )
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return {
      id: String(data.id),
      mind_map_id: String(data.mind_map_id),
      user_id: String(data.user_id),
      role: data.role as MindMapRole,
      invited_by: data.invited_by ? String(data.invited_by) : null,
      created_at: String(data.created_at),
    };
  },

  async removeMember(memberId: string): Promise<void> {
    const { error } = await supabase.from('mind_map_members').delete().eq('id', memberId);
    if (error) throw new Error(error.message);
  },
};
