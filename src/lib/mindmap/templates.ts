import type { MindMapTemplate, NodeStyle, TemplateNodeSeed } from './types';

const ROOT_STYLE: NodeStyle = {
  backgroundColor: '#0f172a',
  borderColor: '#3b82f6',
  borderWidth: 2,
  shape: 'rounded',
  fontSize: 17,
  fontColor: '#ffffff',
  fontWeight: 'bold',
  textAlign: 'center',
  lineColor: '#3b82f6',
};

function branchStyle(bg: string, border: string, text: string): NodeStyle {
  return {
    backgroundColor: bg,
    borderColor: border,
    borderWidth: 2,
    shape: 'rounded',
    fontSize: 14,
    fontColor: text,
    fontWeight: 'bold',
    textAlign: 'left',
    lineColor: border,
  };
}

function leafStyle(border: string): NodeStyle {
  return {
    backgroundColor: '#ffffff',
    borderColor: border,
    borderWidth: 1.5,
    shape: 'pill',
    fontSize: 12,
    fontColor: '#1e293b',
    fontWeight: 'semibold',
    textAlign: 'left',
    lineColor: border,
  };
}

interface BranchSpec {
  title: string;
  description?: string;
  side: 'left' | 'right';
  bg: string;
  border: string;
  text: string;
  children: string[];
}

function buildRadialTemplate(
  rootTitle: string,
  rootDesc: string,
  branches: BranchSpec[],
): TemplateNodeSeed[] {
  const nodes: TemplateNodeSeed[] = [
    {
      temp_id: 'root',
      parent_temp_id: null,
      title: rootTitle,
      description: rootDesc,
      node_type: 'root',
      position_x: 0,
      position_y: 0,
      width: 230,
      height: 78,
      sort_order: 0,
      style: ROOT_STYLE,
    },
  ];

  const left = branches.filter((b) => b.side === 'left');
  const right = branches.filter((b) => b.side === 'right');

  const placeWing = (list: BranchSpec[], dir: -1 | 1) => {
    const gapY = 195;
    const startY = -((list.length - 1) * gapY) / 2;
    list.forEach((b, bi) => {
      const bId = `b_${dir === -1 ? 'l' : 'r'}_${bi}`;
      const bx = dir * 320;
      const by = Math.round(startY + bi * gapY);
      nodes.push({
        temp_id: bId,
        parent_temp_id: 'root',
        title: b.title,
        description: b.description,
        node_type: 'topic',
        position_x: bx,
        position_y: by,
        width: 196,
        height: 60,
        sort_order: bi,
        style: branchStyle(b.bg, b.border, b.text),
      });

      const childGapY = 66;
      const childStartY = by - ((b.children.length - 1) * childGapY) / 2;
      b.children.forEach((cTitle, ci) => {
        nodes.push({
          temp_id: `${bId}_c_${ci}`,
          parent_temp_id: bId,
          title: cTitle,
          node_type: 'subtopic',
          position_x: bx + dir * 265,
          position_y: Math.round(childStartY + ci * childGapY),
          width: 176,
          height: 46,
          sort_order: ci,
          style: leafStyle(b.border),
        });
      });
    });
  };

  placeWing(left, -1);
  placeWing(right, 1);
  return nodes;
}

export const MIND_MAP_TEMPLATES: MindMapTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Mind Map',
    category: 'Start Fresh',
    description: 'Start with a clean central node and build your own structure freely.',
    accent: '#3b82f6',
    defaultTitle: 'Untitled Mind Map',
    nodes: [
      {
        temp_id: 'root',
        parent_temp_id: null,
        title: 'Central Idea',
        description: 'Click to edit your main topic or press Tab to add a child branch',
        node_type: 'root',
        position_x: 0,
        position_y: 0,
        width: 228,
        height: 78,
        sort_order: 0,
        style: ROOT_STYLE,
      },
    ],
  },
  {
    id: 'project-planning',
    name: 'Project Planning',
    category: 'Execution',
    description: 'Organize project goals, milestones, tasks, resources, and risk mitigation.',
    accent: '#10b981',
    defaultTitle: 'Project Plan',
    nodes: buildRadialTemplate(
      'Project Plan',
      'End-to-end scope, deliverables & execution roadmap',
      [
        {
          title: 'Goals & Scope',
          description: 'Core objectives & deliverables',
          side: 'left',
          bg: '#ecfdf5',
          border: '#10b981',
          text: '#065f46',
          children: ['Primary Objective', 'Success Metrics', 'Out of Scope'],
        },
        {
          title: 'Timeline & Milestones',
          description: 'Key phases and target dates',
          side: 'left',
          bg: '#eff6ff',
          border: '#3b82f6',
          text: '#1e3a8a',
          children: ['Phase 1: Kickoff', 'Phase 2: Execution', 'Phase 3: Delivery'],
        },
        {
          title: 'Team & Resources',
          description: 'Owners, budget & tooling',
          side: 'right',
          bg: '#fff7ed',
          border: '#f97316',
          text: '#9a3412',
          children: ['Project Owner', 'Budget & Materials', 'External Vendors'],
        },
        {
          title: 'Risks & Blockers',
          description: 'Dependencies & fallback plans',
          side: 'right',
          bg: '#fff1f2',
          border: '#f43f5e',
          text: '#881337',
          children: ['Schedule Risks', 'Quality Checks', 'Mitigation Plan'],
        },
      ],
    ),
  },
  {
    id: 'brainstorming',
    name: 'Brainstorming',
    category: 'Ideation',
    description: 'Capture free-flowing ideas, quick wins, bold concepts, and next experiments.',
    accent: '#8b5cf6',
    defaultTitle: 'Brainstorming Session',
    nodes: buildRadialTemplate(
      'Core Challenge',
      'Explore every angle without limits',
      [
        {
          title: 'Quick Wins',
          description: 'Low effort, high impact',
          side: 'left',
          bg: '#ecfdf5',
          border: '#10b981',
          text: '#065f46',
          children: ['Fast Improvement 1', 'Fast Improvement 2'],
        },
        {
          title: 'Bold Ideas',
          description: 'Big bets & innovations',
          side: 'left',
          bg: '#f5f3ff',
          border: '#8b5cf6',
          text: '#4c1d95',
          children: ['Breakthrough Concept', 'Automation Opportunity'],
        },
        {
          title: 'Open Questions',
          description: 'Things to validate',
          side: 'right',
          bg: '#fffbeb',
          border: '#f59e0b',
          text: '#78350f',
          children: ['Customer Needs?', 'Cost vs. Value?'],
        },
        {
          title: 'Next Experiments',
          description: 'Small tests to run this week',
          side: 'right',
          bg: '#ecfeff',
          border: '#06b6d4',
          text: '#155e75',
          children: ['Prototype Test', 'Team Feedback'],
        },
      ],
    ),
  },
  {
    id: 'business-strategy',
    name: 'Business Strategy',
    category: 'Leadership',
    description: 'Map vision, target markets, revenue levers, operations, and KPIs.',
    accent: '#f97316',
    defaultTitle: 'Business Strategy',
    nodes: buildRadialTemplate(
      'Business Strategy',
      'Annual strategic growth blueprint',
      [
        {
          title: 'Vision & Positioning',
          side: 'left',
          bg: '#eff6ff',
          border: '#3b82f6',
          text: '#1e3a8a',
          children: ['Value Proposition', 'Competitive Edge'],
        },
        {
          title: 'Customers & Growth',
          side: 'left',
          bg: '#ecfdf5',
          border: '#10b981',
          text: '#065f46',
          children: ['Target Segments', 'Sales Channels', 'Retention Plan'],
        },
        {
          title: 'Operations & Quality',
          side: 'right',
          bg: '#fff7ed',
          border: '#f97316',
          text: '#9a3412',
          children: ['Production Capacity', 'Supply Chain', 'Cost Optimization'],
        },
        {
          title: 'Financial KPIs',
          side: 'right',
          bg: '#f5f3ff',
          border: '#8b5cf6',
          text: '#4c1d95',
          children: ['Revenue Target', 'Gross Margin', 'Cash Flow Health'],
        },
      ],
    ),
  },
  {
    id: 'study-notes',
    name: 'Study Notes',
    category: 'Learning',
    description: 'Structure key concepts, definitions, practical examples, and review questions.',
    accent: '#06b6d4',
    defaultTitle: 'Study Notes',
    nodes: buildRadialTemplate(
      'Main Subject',
      'Structured visual notes for fast recall',
      [
        {
          title: 'Core Concepts',
          side: 'left',
          bg: '#ecfeff',
          border: '#06b6d4',
          text: '#155e75',
          children: ['Fundamental Principle', 'Key Definitions'],
        },
        {
          title: 'Formulas & Rules',
          side: 'left',
          bg: '#f5f3ff',
          border: '#8b5cf6',
          text: '#4c1d95',
          children: ['Primary Formula', 'Edge Cases'],
        },
        {
          title: 'Real Examples',
          side: 'right',
          bg: '#ecfdf5',
          border: '#10b981',
          text: '#065f46',
          children: ['Worked Example 1', 'Common Mistake'],
        },
        {
          title: 'Review Questions',
          side: 'right',
          bg: '#fffbeb',
          border: '#f59e0b',
          text: '#78350f',
          children: ['Self-Check Q1', 'Summary Takeaway'],
        },
      ],
    ),
  },
  {
    id: 'meeting-planning',
    name: 'Meeting Planning',
    category: 'Collaboration',
    description: 'Plan agenda items, capture decisions, and assign clear action owners.',
    accent: '#f59e0b',
    defaultTitle: 'Meeting Plan',
    nodes: buildRadialTemplate(
      'Team Meeting',
      'Agenda, key decisions & follow-ups',
      [
        {
          title: 'Agenda Topics',
          side: 'left',
          bg: '#eff6ff',
          border: '#3b82f6',
          text: '#1e3a8a',
          children: ['Status Review', 'Key Priorities', 'Open Blockers'],
        },
        {
          title: 'Participants',
          side: 'left',
          bg: '#fffbeb',
          border: '#f59e0b',
          text: '#78350f',
          children: ['Facilitator', 'Department Leads'],
        },
        {
          title: 'Decisions Made',
          side: 'right',
          bg: '#ecfdf5',
          border: '#10b981',
          text: '#065f46',
          children: ['Approved Approach', 'Budget / Timeline'],
        },
        {
          title: 'Action Items',
          side: 'right',
          bg: '#fff1f2',
          border: '#f43f5e',
          text: '#881337',
          children: ['Owner & Due Date 1', 'Owner & Due Date 2'],
        },
      ],
    ),
  },
  {
    id: 'problem-solving',
    name: 'Problem Solving',
    category: 'Root Cause',
    description: 'Break down the problem, uncover root causes, weigh options, and execute fixes.',
    accent: '#f43f5e',
    defaultTitle: 'Problem Solving',
    nodes: buildRadialTemplate(
      'Problem Statement',
      'Systematic root-cause analysis & solution plan',
      [
        {
          title: 'Root Causes',
          description: '5 Whys breakdown',
          side: 'left',
          bg: '#fff1f2',
          border: '#f43f5e',
          text: '#881337',
          children: ['Process Factor', 'Equipment / Material', 'Human / Training'],
        },
        {
          title: 'Impact & Data',
          side: 'left',
          bg: '#fffbeb',
          border: '#f59e0b',
          text: '#78350f',
          children: ['Measured Symptoms', 'Cost / Delay Impact'],
        },
        {
          title: 'Possible Solutions',
          side: 'right',
          bg: '#eff6ff',
          border: '#3b82f6',
          text: '#1e3a8a',
          children: ['Immediate Containment', 'Permanent Corrective Action'],
        },
        {
          title: 'Verification Plan',
          side: 'right',
          bg: '#ecfdf5',
          border: '#10b981',
          text: '#065f46',
          children: ['Owner & Deadline', 'KPI Verification'],
        },
      ],
    ),
  },
];
