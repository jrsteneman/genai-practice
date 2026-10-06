import { type ReactNode, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import {
  AlertTriangle, ArrowDownRight, BadgeCheck, CalendarDays, Check,
  ChevronDown, ChevronRight, CircleHelp, Clock3, Info, Layers3,
  Pencil, RotateCcw, Send, ShieldCheck, Sparkles, Users, Wrench, X,
} from 'lucide-react';

type DisruptionType = 'labor' | 'equipment' | 'other';
type ScheduleTask = {
  id: string; name: string; duration: number; startDay: number; dependencies: string[];
  crew: string; equipment: string; criticality: 'critical' | 'normal'; status: string;
};
type Project = { id: string; name: string; start: string; milestone: string; tasks: ScheduleTask[]; scenario: string; event: string };
type Recommendation = {
  summary: string; actions: { taskId: string; text: string }[]; beforeFinish: number;
  afterFinish: number; daysSaved: number; affectedTaskIds: string[]; confidence: number;
  disclaimer: string; kind: 'plan' | 'no-impact' | 'unsupported';
};
type ChatEntry = { who: 'user' | 'assistant'; text: string };

const initialProjects: Project[] = [
  {
    id: 'labor', name: 'Cedar Ridge Clinic', start: 'Mon, May 12', milestone: 'Dry-in · Day 8',
    scenario: 'North framing crew is down two carpenters today. Reassign the available interior crew to protect the dry-in milestone.',
    event: 'North framing crew is down two carpenters today. Reassign the available interior crew to protect the dry-in milestone.',
    tasks: [
      { id: 'layout', name: 'Survey & layout', duration: 1, startDay: 1, dependencies: [], crew: 'Survey team', equipment: 'Total station', criticality: 'critical', status: 'Ready' },
      { id: 'footings', name: 'Footings & foundation forms', duration: 2, startDay: 2, dependencies: ['layout'], crew: 'Concrete crew A', equipment: 'Mini excavator', criticality: 'critical', status: 'Ready' },
      { id: 'frame', name: 'North wing framing', duration: 3, startDay: 4, dependencies: ['footings'], crew: 'Framing crew North', equipment: 'Telehandler', criticality: 'critical', status: 'At risk' },
      { id: 'interior', name: 'Interior wall framing', duration: 2, startDay: 4, dependencies: ['footings'], crew: 'Interior crew', equipment: 'Scissor lift', criticality: 'normal', status: 'Ready' },
      { id: 'sheath', name: 'Roof sheathing & dry-in', duration: 2, startDay: 7, dependencies: ['frame'], crew: 'Roof crew', equipment: 'Telehandler', criticality: 'critical', status: 'Milestone path' },
      { id: 'roughin', name: 'MEP rough-in · north wing', duration: 3, startDay: 9, dependencies: ['frame'], crew: 'MEP team', equipment: 'Material lift', criticality: 'normal', status: 'Ready' },
    ],
  },
  {
    id: 'equipment', name: 'Harbor Point Residences', start: 'Tue, May 20', milestone: 'Level 4 pour · Day 9',
    scenario: 'The tower crane is down for inspection through tomorrow. Shift dependent material moves and find a practical workaround.',
    event: 'Tower crane is down for inspection through tomorrow. Shift dependent material moves and find a practical workaround.',
    tasks: [
      { id: 'deck', name: 'Level 3 deck strip & reshoring', duration: 1, startDay: 1, dependencies: [], crew: 'Form crew B', equipment: 'Forklift', criticality: 'normal', status: 'Ready' },
      { id: 'deliver', name: 'Level 4 rebar & form delivery', duration: 1, startDay: 2, dependencies: ['deck'], crew: 'Material team', equipment: 'Tower crane', criticality: 'critical', status: 'At risk' },
      { id: 'forms', name: 'Level 4 edge forms', duration: 2, startDay: 3, dependencies: ['deliver'], crew: 'Form crew A', equipment: 'Tower crane', criticality: 'critical', status: 'Ready' },
      { id: 'rebar', name: 'Level 4 rebar placement', duration: 2, startDay: 5, dependencies: ['forms'], crew: 'Ironworkers', equipment: 'Tower crane', criticality: 'critical', status: 'Milestone path' },
      { id: 'pour', name: 'Level 4 slab pour', duration: 1, startDay: 8, dependencies: ['rebar'], crew: 'Concrete crew', equipment: 'Concrete pump', criticality: 'critical', status: 'Milestone path' },
      { id: 'masonry', name: 'Level 2 masonry punch', duration: 2, startDay: 2, dependencies: [], crew: 'Masonry crew', equipment: 'Scissor lift', criticality: 'normal', status: 'Ready' },
    ],
  },
  {
    id: 'coffee', name: 'Juniper Street Library', start: 'Wed, Jun 04', milestone: 'Envelope complete · Day 11',
    scenario: 'The break-room coffee delivery is delayed until noon. Check whether this affects the work plan.',
    event: 'Break-room coffee delivery is delayed until noon.',
    tasks: [
      { id: 'excavate', name: 'Utility trench excavation', duration: 2, startDay: 1, dependencies: [], crew: 'Earthworks crew', equipment: 'Excavator 320', criticality: 'critical', status: 'Ready' },
      { id: 'underground', name: 'Underground utilities', duration: 2, startDay: 3, dependencies: ['excavate'], crew: 'Utility crew', equipment: 'Trencher', criticality: 'critical', status: 'Ready' },
      { id: 'slab', name: 'Slab-on-grade pour', duration: 1, startDay: 5, dependencies: ['underground'], crew: 'Concrete crew', equipment: 'Concrete pump', criticality: 'critical', status: 'Milestone path' },
      { id: 'masonry', name: 'Exterior masonry walls', duration: 4, startDay: 6, dependencies: ['slab'], crew: 'Masonry crew', equipment: 'Mast climber', criticality: 'critical', status: 'Ready' },
      { id: 'windows', name: 'Window setting & envelope', duration: 3, startDay: 10, dependencies: ['masonry'], crew: 'Glazing crew', equipment: 'Material lift', criticality: 'critical', status: 'Milestone path' },
    ],
  },
];

const dayLabel = (day: number) => `Day ${day}`;
const finishDay = (tasks: ScheduleTask[]) => tasks.reduce((max, task) => Math.max(max, task.startDay + task.duration - 1), 0);

const normalizeWords = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const containsPhrase = (text: string, phrase: string) => {
  const haystack = ` ${normalizeWords(text)} `;
  const needle = ` ${normalizeWords(phrase)} `;
  return needle.trim().length > 0 && haystack.includes(needle);
};

const equipmentFamilies = [
  { label: 'crane', terms: ['tower crane', 'mobile crane', 'crane'], taskTerms: ['crane'] },
  { label: 'forklift', terms: ['forklift', 'fork truck'], taskTerms: ['forklift', 'fork truck'] },
  { label: 'lift', terms: ['scissor lift', 'material lift', 'man lift', 'boom lift', 'telehandler', 'lift'], taskTerms: ['scissor lift', 'material lift', 'man lift', 'boom lift', 'telehandler', 'lift'] },
  { label: 'excavator', terms: ['mini excavator', 'excavator', 'digger'], taskTerms: ['excavator'] },
  { label: 'pump', terms: ['concrete pump', 'pump'], taskTerms: ['pump'] },
  { label: 'truck', terms: ['dump truck', 'flatbed', 'truck'], taskTerms: ['truck', 'flatbed'] },
  { label: 'trencher', terms: ['trencher'], taskTerms: ['trencher'] },
  { label: 'mast climber', terms: ['mast climber'], taskTerms: ['mast climber'] },
  { label: 'total station', terms: ['total station'], taskTerms: ['total station'] },
];

function findEquipmentTasks(project: Project, event: string) {
  const equipmentNames = [...new Set(project.tasks.map(task => task.equipment))];
  const exactNames = equipmentNames.filter(name => containsPhrase(event, name));
  const mentionedTerms = equipmentFamilies
    .flatMap(family => family.terms)
    .filter(term => containsPhrase(event, term))
    .sort((a, b) => b.length - a.length);

  if (exactNames.length) {
    return {
      tasks: project.tasks.filter(task => exactNames.includes(task.equipment)),
      label: exactNames.join(' / '),
      exact: true,
    };
  }

  const matchingFamilies = equipmentFamilies.filter(family => family.terms.some(term => containsPhrase(event, term)));
  const tasks = project.tasks.filter(task =>
    matchingFamilies.some(family => family.taskTerms.some(term => containsPhrase(task.equipment, term))),
  );
  const matchedNames = [...new Set(tasks.map(task => task.equipment))];
  const eventTerm = mentionedTerms[0];
  return {
    tasks,
    label: matchedNames.length === 1
      ? matchedNames[0]
      : matchedNames.length > 1
        ? eventTerm ?? matchedNames.join(' / ')
        : eventTerm
          ? eventTerm.replace(/\b\w/g, letter => letter.toUpperCase())
          : 'the named equipment',
    exact: false,
  };
}

function getAffectedTasks(project: Project, rootTasks: ScheduleTask[]) {
  const affectedIds = new Set(rootTasks.map(task => task.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const task of project.tasks) {
      if (!affectedIds.has(task.id) && task.dependencies.some(id => affectedIds.has(id))) {
        affectedIds.add(task.id);
        changed = true;
      }
    }
  }
  return project.tasks.filter(task => affectedIds.has(task.id));
}

const laborStopWords = new Set([
  'crew', 'team', 'worker', 'workers', 'labor', 'labour', 'personnel', 'staff',
  'down', 'out', 'short', 'shortage', 'sick', 'absent', 'unavailable', 'available',
  'today', 'tomorrow', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'with',
  'two', 'one', 'three', 'four', 'from', 'to', 'for', 'on', 'at', 'shift',
  'move', 'reassign', 'assign', 'protect', 'milestone', 'until', 'day',
]);

function findLaborTasks(project: Project, event: string) {
  const eventTerms = new Set(normalizeWords(event).split(' ').filter(term => term && !laborStopWords.has(term)));
  const aliases = [
    { trigger: ['carpenter', 'carpenters'], target: ['framing'] },
    { trigger: ['ironworker', 'ironworkers'], target: ['rebar'] },
    { trigger: ['roofer', 'roofers'], target: ['roof', 'sheathing'] },
    { trigger: ['mason', 'masons'], target: ['masonry'] },
    { trigger: ['electrician', 'electricians', 'plumber', 'plumbers'], target: ['mep', 'roughin'] },
    { trigger: ['surveyor', 'surveyors'], target: ['survey', 'layout'] },
  ];
  for (const alias of aliases) {
    if (alias.trigger.some(term => eventTerms.has(term))) alias.target.forEach(term => eventTerms.add(term));
  }

  const scores = project.tasks.map(task => {
    const taskTerms = new Set(normalizeWords(`${task.name} ${task.crew}`).split(' '));
    return { task, score: [...eventTerms].filter(term => taskTerms.has(term)).length };
  });
  const bestScore = Math.max(0, ...scores.map(item => item.score));
  return bestScore === 0 ? [] : scores.filter(item => item.score === bestScore).map(item => item.task);
}

const classify = (text: string): DisruptionType => {
  const t = normalizeWords(text);
  const equipmentMentioned = equipmentFamilies.some(family => family.terms.some(term => containsPhrase(t, term)))
    || /\b(equipment|machine|tool)\b/.test(t);
  const equipmentFailure = /\b(down|out|broken|broke|failed|failure|unavailable|inspection|repair|maintenance|offline|outage)\b/.test(t);
  if (equipmentMentioned && equipmentFailure) return 'equipment';
  if (/\b(crew|worker|labor|labour|carpenter|operator|sick|absent|short|staff|personnel|electrician|ironworker|roofer|mason)\b/.test(t)) return 'labor';
  if (equipmentMentioned) return 'equipment';
  return 'other';
};

function buildRecommendation(project: Project, event: string): Recommendation {
  const type = classify(event);
  const before = finishDay(project.tasks);
  const common = { beforeFinish: before, disclaimer: 'Simulated planning suggestion. Confirm crew availability, site conditions, safety requirements, and dependencies with the foreman before acting.' };
  if (/coffee|break.?room|lunch|catering|snack|delivery of food/.test(event.toLowerCase())) {
    return { ...common, summary: 'No schedule impact found', actions: [], afterFinish: before, daysSaved: 0, affectedTaskIds: [], confidence: 99, kind: 'no-impact' };
  }
  if (type === 'other') {
    return { ...common, summary: 'This event needs a schedule connection', actions: [], afterFinish: before, daysSaved: 0, affectedTaskIds: [], confidence: 0, kind: 'unsupported' };
  }

  if (type === 'equipment') {
    const equipment = findEquipmentTasks(project, event);
    if (!equipment.tasks.length) {
      return {
        ...common,
        summary: `No scheduled task lists ${equipment.label}`,
        actions: [],
        afterFinish: before,
        daysSaved: 0,
        affectedTaskIds: [],
        confidence: 0,
        disclaimer: `${equipment.label} does not match equipment assigned to a task in this schedule. Add it to a task or name a listed machine before estimating its impact.`,
        kind: 'unsupported',
      };
    }

    const affected = getAffectedTasks(project, equipment.tasks);
    const directIds = new Set(equipment.tasks.map(task => task.id));
    const downstream = affected.filter(task => !directIds.has(task.id));
    const firstAffectedDay = Math.min(...equipment.tasks.map(task => task.startDay));
    const availableTask = project.tasks
      .filter(task => !affected.some(item => item.id === task.id) && task.status === 'Ready' && task.startDay >= firstAffectedDay)
      .sort((a, b) => a.startDay - b.startDay)[0];
    const criticalWorkAffected = affected.some(task => task.criticality === 'critical');
    const durationMatch = event.match(/\b(\d{1,2})\s+days?\b/i);
    const modeledHold = durationMatch ? Math.min(5, Math.max(1, Number(durationMatch[1]))) : 1;
    const after = before + (criticalWorkAffected ? modeledHold : 0);
    const directTaskNames = equipment.tasks.map(task => task.name).join('; ');
    const dependentNames = downstream.slice(0, 2).map(task => task.name).join(' and ');
    const actions = [
      {
        taskId: equipment.tasks[0].id,
        text: `Hold or resequence ${directTaskNames} while the ${equipment.label} is unavailable. Confirm the repair window and whether an approved alternate can safely do this work.`,
      },
      ...(availableTask ? [{
        taskId: availableTask.id,
        text: `Use the downtime to advance ${availableTask.name} with its listed ${availableTask.equipment}, if that crew and access are available.`,
      }] : []),
      {
        taskId: downstream[0]?.id ?? equipment.tasks[0].id,
        text: downstream.length
          ? `After the ${equipment.label} is cleared, restart ${dependentNames} in dependency order and recheck ${project.milestone} against the modeled ${modeledHold}-day hold.`
          : `This equipment is not on a listed critical-path task. Recheck ${project.milestone} after it is restored; no finish-date slip is modeled.`,
      },
    ];
    return {
      ...common,
      summary: `Resequence work affected by the ${equipment.label} outage`,
      actions,
      afterFinish: after,
      daysSaved: 0,
      affectedTaskIds: affected.map(task => task.id),
      confidence: equipment.exact ? 72 : 58,
      kind: 'plan',
    };
  }

  if (project.id === 'labor' && type === 'labor' && /north framing|two carpenters|carpenter/.test(event.toLowerCase())) {
    return { ...common, summary: 'Rebalance framing crews to hold dry-in', actions: [
      { taskId: 'frame', text: 'Move two available carpenters from interior wall framing to North wing framing for the first shift.' },
      { taskId: 'interior', text: 'Start interior walls on Day 6 with the remaining interior crew; keep its material lift reservation.' },
      { taskId: 'sheath', text: 'Keep roof sheathing staged for Day 7; dry-in remains on the current milestone path.' },
    ], afterFinish: before, daysSaved: 2, affectedTaskIds: ['frame', 'interior', 'sheath'], confidence: 86, kind: 'plan' };
  }

  const matchedCrewTasks = findLaborTasks(project, event);
  const targetTasks = matchedCrewTasks.length
    ? matchedCrewTasks
    : [project.tasks.find(task => task.status === 'At risk') ?? project.tasks.find(task => task.criticality === 'critical') ?? project.tasks[0]];
  const affected = getAffectedTasks(project, targetTasks);
  const targetIds = new Set(targetTasks.map(task => task.id));
  const downstream = affected.filter(task => !targetIds.has(task.id));
  const availableTask = project.tasks.find(task => !affected.some(item => item.id === task.id) && task.status === 'Ready');
  const crewNames = [...new Set(targetTasks.map(task => task.crew))].join(' / ');
  const taskNames = targetTasks.map(task => task.name).join('; ');
  const criticalWorkAffected = affected.some(task => task.criticality === 'critical');
  const after = before + (criticalWorkAffected ? 1 : 0);
  const uncertainCrew = matchedCrewTasks.length === 0;
  return {
    ...common,
    summary: uncertainCrew ? `Check labor coverage on ${taskNames}` : `Resequence work for the ${crewNames} staffing change`,
    actions: [
      {
        taskId: targetTasks[0].id,
        text: uncertainCrew
          ? `The event does not name a crew. ${taskNames} is the schedule's current at-risk work; confirm which crew is affected before changing assignments.`
          : `Confirm the ${crewNames} headcount for ${taskNames}; hold or resequence it if qualified workers are not available.`,
      },
      ...(availableTask ? [{
        taskId: availableTask.id,
        text: `Keep ${availableTask.name} moving with its listed ${availableTask.crew}, if that crew is available; do not assume workers can transfer trades.`,
      }] : []),
      {
        taskId: downstream[0]?.id ?? targetTasks[0].id,
        text: downstream.length
          ? `Recheck ${downstream.slice(0, 2).map(task => task.name).join(' and ')} after the staffing gap is resolved; those tasks depend on this work.`
          : `No downstream task is listed as dependent on this activity. Recheck the ${project.milestone} after staffing is confirmed.`,
      },
    ],
    afterFinish: after,
    daysSaved: 0,
    affectedTaskIds: affected.map(task => task.id),
    confidence: uncertainCrew ? 36 : 62,
    disclaimer: uncertainCrew
      ? 'The event does not identify a crew, so the preview uses the schedule’s current at-risk task as a prompt for review. This is not a verified staffing plan.'
      : common.disclaimer,
    kind: 'plan',
  };
}

function answerQuestion(question: string, project: Project, event: string, recommendation: Recommendation | null) {
  const q = question.toLowerCase();
  const affected = recommendation?.affectedTaskIds.map(id => project.tasks.find(t => t.id === id)).filter((task): task is ScheduleTask => Boolean(task)) ?? [];
  if (/unrelated|coffee|break.?room|lunch|snack|food/.test(q) && /coffee|break.?room|lunch|snack|food/.test(event.toLowerCase())) {
    return 'The current event is a delayed break-room delivery, not a work resource or dependency in this schedule. No tasks or milestones are changed.';
  }
  if (/affect|which task|what task|resource|crew|equipment|who|impact/.test(q)) {
    if (affected.length) return `The modeled impact is on ${affected.map(t => `${t.name} (${t.crew}; ${t.equipment})`).join('; ')}. ${recommendation?.kind === 'no-impact' ? 'No schedule resources are implicated.' : 'Confirm the listed resource availability on site.'}`;
    const resources = project.tasks.filter(t => /crew|worker|labor|person|equipment|crane|machine|down|broken/.test(event.toLowerCase()) && (event.toLowerCase().includes(t.crew.toLowerCase()) || event.toLowerCase().includes(t.equipment.toLowerCase())));
    return resources.length ? `The event text matches ${resources.map(t => `${t.name} (${t.crew}, ${t.equipment})`).join('; ')}. Run an analysis to model schedule changes.` : 'I can only identify impacts represented in the active schedule. No affected task is currently established; try naming the unavailable crew or machine.';
  }
  if (/why|suggest|reason|recommend/.test(q)) {
    if (recommendation?.kind === 'no-impact') return 'The event does not map to a scheduled crew, piece of equipment, or task dependency, so the simulated plan makes no schedule changes.';
    return recommendation?.actions.length ? `The proposed sequence targets the event’s resource constraint while keeping dependent work in view. ${recommendation.summary}. These are rule-based demo suggestions, not verified field instructions.` : 'Run an event analysis first. Suggestions are based only on the active schedule fields and a small set of deterministic demo rules.';
  }
  if (/milestone|finish|date|slip|delay|completion/.test(q)) {
    if (recommendation) return recommendation.kind === 'no-impact'
      ? `No milestone movement is modeled. ${project.milestone} remains ${dayLabel(recommendation.beforeFinish)}.`
      : `The baseline finish is ${dayLabel(recommendation.beforeFinish)}; the simulated finish is ${dayLabel(recommendation.afterFinish)}. The protected milestone is ${project.milestone}. Verify actual dates and float before committing.`;
    return `The active schedule’s current finish is ${dayLabel(finishDay(project.tasks))}. Analyze an event to see a modeled milestone comparison.`;
  }
  if (/compare|alternative|option|instead|trade.?off/.test(q)) {
    if (project.id === 'labor') return 'Option A (shown): lend two interior carpenters to North framing, then start interior walls Day 6; keeps dry-in on Day 8. Option B: hold both crews as-is; the framing handoff may slip about two days. The demo has not validated overtime or trade stacking.';
    if (project.id === 'equipment') return 'Option A (shown): use the rated site forklift only for suitable staged loads, then resume crane-dependent work after inspection. Option B: wait for the tower crane for all picks; this is simpler but may push the Level 4 pour. Confirm lift plans and capacity before choosing.';
    return 'The current scenario has no schedule impact, so there is no recovery alternative to compare. Select a labor or equipment scenario to explore alternatives.';
  }
  return 'I can answer about affected tasks and resources, why a change is suggested, milestone movement, or recovery alternatives. Ask one of those about the active schedule; I will not infer details outside it.';
}

function Home() {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [activeId, setActiveId] = useState('labor');
  const [event, setEvent] = useState(initialProjects[0].event);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [affectedOpen, setAffectedOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const project = projects.find(p => p.id === activeId) ?? projects[0];
  const disruptionType = classify(event);
  const currentFinish = finishDay(project.tasks);
  const analysisVersion = useMemo(() => recommendation?.summary, [recommendation]);

  const selectProject = (id: string) => {
    const next = projects.find(p => p.id === id);
    if (!next) return;
    setActiveId(id); setEvent(next.event); setRecommendation(null); setApplied(false); setAffectedOpen(false); setChat([]);
  };
  const runAnalysis = () => {
    if (!event.trim()) {
      setRecommendation({ summary: 'Add a short event description to continue', actions: [], beforeFinish: currentFinish, afterFinish: currentFinish, daysSaved: 0, affectedTaskIds: [], confidence: 0, disclaimer: 'Enter what changed on site, then request an analysis.', kind: 'unsupported' });
      return;
    }
    setBusy(true); setRecommendation(null); setApplied(false);
    window.setTimeout(() => {
      setRecommendation(buildRecommendation(project, event));
      setAffectedOpen(false); setBusy(false);
    }, 560);
  };
  const changeTask = (taskId: string, field: 'name' | 'duration' | 'startDay', value: string) => {
    setProjects(prev => prev.map(item => item.id !== activeId ? item : {
      ...item, tasks: item.tasks.map(task => task.id !== taskId ? task : {
        ...task, [field]: field === 'duration' || field === 'startDay' ? Math.max(1, Number(value) || 1) : value,
      }),
    }));
  };
  const submitQuestion = (value = question) => {
    if (!value.trim()) return;
    const answer = answerQuestion(value, project, event, recommendation);
    setChat(prev => [...prev, { who: 'user', text: value.trim() }, { who: 'assistant', text: answer }]);
    setQuestion('');
  };
  const taskById = (id: string) => project.tasks.find(task => task.id === id);

  return (
    <div className="app-shell">
      <aside className="rail">
        <div className="brand">
          <div><div className="brand-name">SlipLess</div><div className="brand-caption">Field schedule recovery</div></div>
        </div>
        <div className="rail-label">Demo projects</div>
        <nav className="project-list" aria-label="Sample projects">
          {projects.map(item => <button key={item.id} data-testid={`project-select-${item.id}`} className={`project-choice ${item.id === activeId ? 'active' : ''}`} onClick={() => selectProject(item.id)}>
            <span className="rail-dot" /><span>{item.name}</span>
          </button>)}
        </nav>
        <div className="rail-bottom">
          <div className="prototype-status"><span className="status-live" /><span>Local demo logic<br />No schedule data leaves this page</span></div>
          <p className="rail-footnote">A working foreman stays in control. Recommendations are simulated, not instructions.</p>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumb"><span>Operations</span><ChevronRight size={13} /><span className="crumb-current">Schedule recovery</span></div>
          <div className="top-actions"><div className="offline-pill"><span className="status-live" /> Local prototype</div></div>
        </header>

        <section className="page-intro">
          <div>
            <div className="eyebrow">Field planning / disruption desk</div>
            <h1>Get the work moving again.</h1>
            <p>Model a setback. See what can shift without losing sight of the next milestone.</p>
          </div>
          <div className="project-meta">
            <span className="meta-chip"><Layers3 size={13} /><strong>{project.name}</strong></span>
            <span className="meta-chip"><CalendarDays size={13} /> Starts {project.start}</span>
            <span className="meta-chip"><ShieldCheck size={13} /> {project.milestone}</span>
          </div>
        </section>

        <div className="main-grid">
          <div className="column-stack">
            <section className="panel" data-testid="panel-active-schedule">
              <div className="panel-head">
                <div><div className="panel-kicker">01 / Active schedule</div><h2 className="panel-title">Work in the sequence</h2><p className="panel-subtitle">Dependencies and field resources at a glance.</p></div>
                <span className="section-tag">{project.tasks.length} tasks · {dayLabel(currentFinish)} finish</span>
              </div>
              <div className="panel-body">
                <div className="schedule-overview">
                  <div><div className="stat-label">Project start</div><div className="stat-value">{project.start}</div></div>
                  <div><div className="stat-label">Baseline finish</div><div className="stat-value">{dayLabel(currentFinish)}</div></div>
                  <div><div className="stat-label">Key milestone</div><div className="stat-value">{project.milestone.split(' · ')[0]}</div></div>
                </div>
                <div className="task-list">
                  {project.tasks.map((task, index) => <div className={`task-row ${task.criticality === 'critical' ? 'critical' : ''}`} key={task.id} data-testid={`task-row-${task.id}`}>
                    <div className="task-index">{String(index + 1).padStart(2, '0')}</div>
                    <div>
                      <div className="task-name">{task.name}{task.criticality === 'critical' && <span className="critical-flag"><ArrowDownRight size={10} /> path</span>}</div>
                      <div className="task-detail"><Users size={10} /> {task.crew} <span aria-hidden="true"> · </span><Wrench size={10} /> {task.equipment}{task.dependencies.length > 0 && <span> · after {task.dependencies.map(dep => project.tasks.find(t => t.id === dep)?.name).filter(Boolean).join(', ')}</span>} <span className={`task-status ${task.status === 'At risk' ? 'at-risk' : ''}`}>{task.status}</span></div>
                    </div>
                    <div className="task-day">{dayLabel(task.startDay)}–{dayLabel(task.startDay + task.duration - 1)}</div>
                  </div>)}
                </div>
              </div>
            </section>

            <section className="panel event-panel" data-testid="panel-disruption">
              <div className="panel-head">
                <div><div className="panel-kicker">02 / What changed?</div><h2 className="panel-title">Describe the disruption</h2><p className="panel-subtitle">Plain language is fine. Be specific about the crew or equipment.</p></div>
                <span className="section-tag">Editable</span>
              </div>
              <div className="panel-body">
                <textarea className="event-text" data-testid="input-disruption" value={event} onChange={e => { setEvent(e.target.value); setRecommendation(null); setApplied(false); }} placeholder="Example: Our lift is down until Thursday morning..." />
                <div className="event-footer">
                  <div className="classify"><Info size={13} /> Detected type: <b>{disruptionType === 'other' ? 'other / checking relevance' : disruptionType}</b></div>
                  <button className="button button-primary" data-testid="button-analyze" disabled={busy} onClick={runAnalysis}>
                    {busy ? <><RotateCcw size={14} className="animate-spin" /> Checking the sequence…</> : <><Sparkles size={14} /> Build recovery plan</>}
                  </button>
                </div>
                <div className="demo-cases">
                  <div className="demo-caption">Load a runnable scenario</div>
                  {projects.map(item => <button key={item.id} data-testid={`scenario-load-${item.id}`} onClick={() => selectProject(item.id)} className={`case-chip ${item.id === activeId ? 'selected' : ''}`}>{item.id === 'labor' ? 'Crew shortfall' : item.id === 'equipment' ? 'Crane downtime' : 'Coffee delivery'}</button>)}
                </div>
              </div>
            </section>

            <section className="panel edit-panel" data-testid="panel-edit-schedule">
              <button className="edit-toggle" data-testid="button-toggle-schedule-editor" onClick={() => setEditOpen(v => !v)} aria-expanded={editOpen}>
                <span className="edit-toggle-label"><Pencil size={14} /> Edit this demo schedule</span>{editOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </button>
              {editOpen && <div className="edit-content">
                <div className="edit-note">Adjust task timing or names to test another sequence. Changes stay in this page only. Use the event box above to edit the disruption.</div>
                <div className="edit-label">TASK / DURATION (DAYS) / START</div>
                <div className="edit-grid">
                  {project.tasks.map(task => <div className="edit-task" key={task.id}>
                    <input aria-label={`${task.name} task name`} data-testid={`edit-task-name-${task.id}`} value={task.name} onChange={e => changeTask(task.id, 'name', e.target.value)} />
                    <input aria-label={`${task.name} duration`} data-testid={`edit-task-duration-${task.id}`} type="number" min="1" value={task.duration} onChange={e => changeTask(task.id, 'duration', e.target.value)} />
                    <input aria-label={`${task.name} start day`} data-testid={`edit-task-start-${task.id}`} type="number" min="1" value={task.startDay} onChange={e => changeTask(task.id, 'startDay', e.target.value)} />
                  </div>)}
                </div>
                <div className="edit-actions"><span className="classify"><Clock3 size={12} /> Current modeled finish: {dayLabel(finishDay(project.tasks))}</span><button className="text-button" data-testid="button-reset-demo" onClick={() => { setProjects(initialProjects); setEvent(initialProjects.find(p => p.id === activeId)?.event ?? ''); setRecommendation(null); setApplied(false); }}><RotateCcw size={12} /> Reset demo data</button></div>
              </div>}
            </section>
          </div>

          <div className="column-stack right">
            <section className="panel result-panel" data-testid="panel-recommendation">
              <div className="panel-head">
                <div><div className="panel-kicker">03 / Review the move</div><h2 className="panel-title">Recovery plan</h2><p className="panel-subtitle">Nothing changes until you choose what to do.</p></div>
                {recommendation && recommendation.kind === 'plan' && <span className="section-tag">Simulated</span>}
              </div>
              {busy ? <div className="panel-body"><div className="result-empty"><div><div className="empty-mark loading-sheen"><RotateCcw size={18} /></div><h3>Checking the schedule</h3><p>Comparing the event with task timing, resources, and the milestone path.</p></div></div></div>
              : !recommendation ? <div className="panel-body"><div className="result-empty" data-testid="status-analysis-empty"><div><div className="empty-mark"><Layers3 size={19} /></div><h3>Ready when you are</h3><p>Describe what changed, then build a plan to see a simulated schedule impact.</p></div></div></div>
              : <div className="fade-in" key={analysisVersion}>
                <div className={`result-banner ${recommendation.kind !== 'plan' ? 'warning' : ''} ${applied ? 'applied' : ''}`}>
                  <div>
                    <div className="result-status">{applied ? <><BadgeCheck size={14} /> Applied to this demo</> : recommendation.kind === 'no-impact' ? <><Check size={14} /> No schedule impact</> : recommendation.kind === 'unsupported' ? <><AlertTriangle size={14} /> Needs a clearer event</> : <><Sparkles size={14} /> Simulated recommendation</>}</div>
                    <h3 className="result-title">{recommendation.summary}</h3>
                    <p className="result-summary">{recommendation.kind === 'no-impact' ? `This event is not represented in the schedule. ${project.milestone} stays on its current path.` : recommendation.kind === 'unsupported' ? recommendation.disclaimer : `A possible sequence for ${project.name}. Review the field conditions before acting.`}</p>
                  </div>
                  {recommendation.kind === 'plan' && <div className="confidence">{recommendation.confidence}%<br />fit</div>}
                </div>
                {recommendation.kind === 'plan' && <div className="result-content">
                  <div className="impact-stats">
                    <div className="impact-cell"><div className="stat-label">Baseline finish</div><div className="stat-value">{dayLabel(recommendation.beforeFinish)} <small>project day</small></div></div>
                    <div className="impact-cell"><div className="stat-label">{recommendation.afterFinish <= recommendation.beforeFinish ? 'With this sequence' : 'Possible finish'}</div><div className="stat-value">{dayLabel(recommendation.afterFinish)} <small>{recommendation.daysSaved > 0 ? `· ${recommendation.daysSaved}d protected` : recommendation.afterFinish > recommendation.beforeFinish ? '· +1d modeled' : '· held'}</small></div></div>
                  </div>
                  <div className="change-title">Suggested sequence</div>
                  <div className="action-list">{recommendation.actions.map((action, i) => <div className="action-item" key={`${action.taskId}-${i}`}><div className="action-number">{i + 1}</div><div className="action-copy"><strong>{taskById(action.taskId)?.name ?? 'Schedule check'}:</strong> {action.text}</div></div>)}</div>
                  <button className="affected-toggle" data-testid="button-toggle-affected-tasks" onClick={() => setAffectedOpen(v => !v)}>{affectedOpen ? 'Hide' : 'Inspect'} {recommendation.affectedTaskIds.length} affected tasks {affectedOpen ? '−' : '+'}</button>
                  {affectedOpen && <div className="affected-list" data-testid="list-affected-tasks">{recommendation.affectedTaskIds.map(id => {
                    const task = taskById(id);
                    return task ? <div className="affected-task" key={id}><span>{task.name} · {task.crew}</span><span>{dayLabel(task.startDay)} / {task.duration}d</span></div> : null;
                  })}</div>}
                  <div className="disclaimer"><ShieldCheck size={14} /><span>{recommendation.disclaimer}</span></div>
                  <div className="result-controls">
                  {!applied ? <><button className="button button-primary button-mini" data-testid="button-apply-plan" onClick={() => {
                    setApplied(true);
                    setProjects(prev => prev.map(p => p.id !== activeId ? p : {
                      ...p, tasks: p.tasks.map(t => {
                        if (p.id === 'labor' && t.id === 'frame') return { ...t, crew: 'Framing + 2 carpenters', status: 'Adjusted in demo' };
                        if (p.id === 'labor' && t.id === 'interior') return { ...t, startDay: 6, status: 'Resequenced in demo' };
                        if (p.id === 'equipment' && t.id === 'deliver') return { ...t, equipment: 'Site forklift · verify capacity', status: 'Workaround in demo' };
                        if (p.id === 'equipment' && t.id === 'forms') return { ...t, startDay: 4, status: 'Resequenced in demo' };
                        if (recommendation.affectedTaskIds.includes(t.id)) return { ...t, status: 'Review with foreman' };
                        return t;
                      }),
                    }));
                  }}><Check size={13} /> Accept & apply</button><button className="button button-quiet button-mini" data-testid="button-dismiss-plan" onClick={() => { setRecommendation(null); setApplied(false); }}><X size={13} /> Dismiss</button></> : <button className="button button-secondary button-mini" data-testid="button-revise-plan" onClick={() => { setApplied(false); setRecommendation(null); }}><Pencil size={13} /> Revise plan</button>}
                  </div>
                </div>}
                {recommendation.kind === 'no-impact' && <div className="result-content">
                  <div className="impact-stats"><div className="impact-cell"><div className="stat-label">Schedule changes</div><div className="stat-value">None <small>recommended</small></div></div><div className="impact-cell"><div className="stat-label">Finish date</div><div className="stat-value">{dayLabel(recommendation.beforeFinish)} <small>unchanged</small></div></div></div>
                  <div className="disclaimer"><Info size={14} /><span>This is an explicit no-impact result. If the event affects work in practice, add that resource or dependency to the schedule and analyze again.</span></div>
                  <div className="result-controls"><button className="button button-quiet button-mini" data-testid="button-dismiss-plan" onClick={() => setRecommendation(null)}><X size={13} /> Clear result</button></div>
                </div>}
                {recommendation.kind === 'unsupported' && <div className="result-content"><div className="disclaimer"><CircleHelp size={14} /><span>Try describing a crew shortage, machine outage, or delayed task. This local demo only models those schedule-related events.</span></div><div className="result-controls"><button className="button button-quiet button-mini" data-testid="button-dismiss-plan" onClick={() => setRecommendation(null)}><X size={13} /> Clear result</button></div></div>}
              </div>}
            </section>

            <section className="panel conversation" data-testid="panel-ask">
              <div className="panel-head">
                <div><div className="panel-kicker">04 / Ask the schedule</div><h2 className="panel-title">Talk through the plan</h2><p className="panel-subtitle">Answers are deterministic and limited to this schedule.</p></div>
                <span className="section-tag">Local Q&A</span>
              </div>
              <div className="panel-body">
                <div className="question-examples">
                  {['Which tasks and resources are affected?', 'Why is this change suggested?', 'What happens to the milestone?', 'Compare the alternatives'].map((prompt, i) => <button className="question-chip" data-testid={`prompt-question-${i + 1}`} key={prompt} onClick={() => submitQuestion(prompt)}>{prompt}</button>)}
                </div>
                {chat.length > 0 && <div className="chat-feed" data-testid="conversation-history">
                  {chat.map((entry, i) => <div className={`chat-message ${entry.who}`} key={`${entry.who}-${i}`} data-testid={`chat-message-${i}`}><span className="chat-label">{entry.who === 'user' ? 'You asked' : 'Schedule note'}</span>{entry.text}</div>)}
                </div>}
                <form className="chat-form" onSubmit={e => { e.preventDefault(); submitQuestion(); }}>
                  <input className="chat-input" data-testid="input-schedule-question" value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask about tasks, resources, milestones…" />
                  <button className="chat-send" type="submit" data-testid="button-send-question" aria-label="Send question"><Send size={15} /></button>
                </form>
              </div>
            </section>
          </div>
        </div>
        <footer className="boundary" data-testid="text-operational-boundaries">
          <Info size={14} /><span><strong>Prototype limits:</strong> all recommendations and Q&amp;A are simulated local demo logic and must be verified by a foreman. Handwritten schedule parsing and connections to scheduling software are not implemented. No data is sent to a service or persisted.</span>
        </footer>
      </main>
    </div>
  );
}

const queryClient = new QueryClient();
function Router() {
  return <Switch><Route path="/" component={Home} /><Route component={NotFound} /></Switch>;
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><RoutedErrorBoundary><Router /></RoutedErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
