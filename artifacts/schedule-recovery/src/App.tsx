import { useRef, useState } from "react";
import {
  analyzeSchedule,
  askSchedule,
  type ScheduleAnalysis,
  type AnalysisInput,
} from "@workspace/api-client-react";
import { initialProjects, type Task } from "./projects";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Info,
  Layers3,
  Pencil,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { applyProposal } from "./proposal";
import { taskFinish } from "@workspace/api-zod";

type ChatEntry = {
  who: "user" | "assistant";
  text: string;
  modeDetail?: string;
};
const day = (n: number) => `Day ${n}`;
const finish = (tasks: Task[]) => Math.max(...tasks.map(taskFinish));
const errorText = (e: unknown) => {
  const data = (e as { data?: { error?: string } })?.data;
  return `${data?.error ?? "The backend request failed."} This failed request made no schedule changes. Check the input or connection and retry.`;
};

export default function App() {
  const [projects, setProjects] = useState(initialProjects);
  const [activeId, setActiveId] = useState("labor");
  const [event, setEvent] = useState(initialProjects[0].event);
  const [recommendation, setRecommendation] = useState<ScheduleAnalysis | null>(
    null,
  );
  const [busy, setBusy] = useState(false),
    [asking, setAsking] = useState(false);
  const [applied, setApplied] = useState(false),
    [editOpen, setEditOpen] = useState(false),
    [affectedOpen, setAffectedOpen] = useState(false);
  const [error, setError] = useState(""),
    [question, setQuestion] = useState(""),
    [chat, setChat] = useState<ChatEntry[]>([]);
  const [start, setStart] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const revision = useRef(0),
    analysisLock = useRef(false),
    questionLock = useRef(false),
    appliedLock = useRef(false);
  const proposalContext = useRef("");
  const project = projects.find((p) => p.id === activeId)!;
  const context: AnalysisInput = {
    schedule: { tasks: project.tasks, milestone: project.milestone },
    disruption: event,
    ...(confirmed
      ? { confirmedTiming: { startDay: Number(start), confirmed: true } }
      : {}),
  };
  const contextKey = JSON.stringify(context);
  function invalidate() {
    revision.current++;
    proposalContext.current = "";
    appliedLock.current = false;
    analysisLock.current = false;
    questionLock.current = false;
    setRecommendation(null);
    setApplied(false);
    setChat([]);
    setError("");
    setBusy(false);
    setAsking(false);
    setAffectedOpen(false);
  }
  function selectProject(id: string) {
    invalidate();
    setActiveId(id);
    setEvent(projects.find((p) => p.id === id)!.event);
    setStart("");
    setConfirmed(false);
    setQuestion("");
  }
  async function runAnalysis() {
    if (analysisLock.current) return;
    invalidate();
    const version = revision.current;
    analysisLock.current = true;
    setBusy(true);
    try {
      const result = await analyzeSchedule(context);
      if (version !== revision.current) return;
      proposalContext.current = contextKey;
      setRecommendation(result);
    } catch (e) {
      if (version === revision.current) setError(errorText(e));
    } finally {
      if (version === revision.current) {
        analysisLock.current = false;
        setBusy(false);
      }
    }
  }
  async function submitQuestion(value = question) {
    if (!value.trim() || questionLock.current || analysisLock.current) return;
    const version = revision.current;
    questionLock.current = true;
    setAsking(true);
    setError("");
    setQuestion("");
    setChat((prev) => [...prev, { who: "user", text: value }]);
    try {
      const result = await askSchedule({
        context,
        question: value,
        recentQuestions: chat
          .filter((c) => c.who === "user")
          .slice(-4)
          .map((c) => c.text),
      });
      if (version === revision.current)
        setChat((prev) => [
          ...prev,
          {
            who: "assistant",
            text: result.answer,
            modeDetail: result.modeDetail,
          },
        ]);
    } catch (e) {
      if (version === revision.current) {
        setError(errorText(e));
        setQuestion(value);
      }
    } finally {
      if (version === revision.current) {
        questionLock.current = false;
        setAsking(false);
      }
    }
  }
  function changeTask(
    id: string,
    field: "name" | "startDay" | "duration",
    value: string,
  ) {
    invalidate();
    setProjects((prev) =>
      prev.map((p) =>
        p.id !== activeId
          ? p
          : {
              ...p,
              tasks: p.tasks.map((t) =>
                t.id !== id
                  ? t
                  : { ...t, [field]: field === "name" ? value : Number(value) },
              ),
            },
      ),
    );
  }
  function apply() {
    if (
      !recommendation ||
      appliedLock.current ||
      proposalContext.current !== contextKey
    )
      return;
    try {
      const tasks = applyProposal(project.tasks, recommendation);
      appliedLock.current = true;
      revision.current++;
      questionLock.current = false;
      setAsking(false);
      setChat([]);
      setApplied(true);
      proposalContext.current = "";
      setProjects((prev) =>
        prev.map((p) => (p.id !== activeId ? p : { ...p, tasks })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Proposal cannot be applied.");
    }
  }
  const milestoneCompletion = Math.max(
    ...project.milestone.taskIds.map((id) => {
      const t = project.tasks.find((t) => t.id === id)!;
      return taskFinish(t);
    }),
  );
  return (
    <div className="app-shell">
      <aside className="rail">
        <div className="brand">
          <div>
            <div className="brand-name">SlipLess</div>
            <div className="brand-caption">Field schedule recovery</div>
          </div>
        </div>
        <div className="rail-label">Demo projects</div>
        <nav className="project-list" aria-label="Sample projects">
          {projects.map((p) => (
            <button
              key={p.id}
              data-testid={`project-select-${p.id}`}
              className={`project-choice ${p.id === activeId ? "active" : ""}`}
              onClick={() => selectProject(p.id)}
            >
              <span className="rail-dot" />
              <span>{p.name}</span>
            </button>
          ))}
        </nav>
        <div className="rail-bottom">
          <div className="prototype-status">
            Rules-based backend
            <br />
            Live AI deferred
          </div>
          <p className="rail-footnote">
            Schedules are sent to the backend on submission. No permanent
            storage. Foreman review is required.
          </p>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Operations <ChevronRight size={13} />
            <span className="crumb-current">Schedule recovery</span>
          </div>
          <div className="offline-pill">Rules-based · AI deferred</div>
        </header>
        <section className="page-intro">
          <div>
            <div className="eyebrow">Field planning / disruption desk</div>
            <h1>Get the work moving again.</h1>
            <p>
              Model a setback. Review actual task, milestone, and finish
              movement.
            </p>
          </div>
          <div className="project-meta">
            <span className="meta-chip">
              <Layers3 size={13} />
              {project.name}
            </span>
            <span className="meta-chip">
              <ShieldCheck size={13} />
              {project.milestone.name} · target{" "}
              {day(project.milestone.targetDay)}
            </span>
          </div>
        </section>
        <div className="main-grid">
          <div className="column-stack">
            <section className="panel" data-testid="panel-active-schedule">
              <div className="panel-head">
                <div>
                  <div className="panel-kicker">01 / Active schedule</div>
                  <h2 className="panel-title">Work in the sequence</h2>
                  <p className="panel-subtitle">
                    Inclusive project days; no calendar-date inference.
                  </p>
                </div>
                <span className="section-tag">
                  {project.tasks.length} tasks · {day(finish(project.tasks))}{" "}
                  finish
                </span>
              </div>
              <div className="panel-body">
                <div className="schedule-overview">
                  <div>
                    <div className="stat-label">Project start</div>
                    <div className="stat-value">Day 1</div>
                  </div>
                  <div>
                    <div className="stat-label">Current finish</div>
                    <div className="stat-value">
                      {day(finish(project.tasks))}
                    </div>
                  </div>
                  <div>
                    <div className="stat-label">Milestone completion</div>
                    <div className="stat-value">{day(milestoneCompletion)}</div>
                  </div>
                </div>
                <div className="task-list">
                  {project.tasks.map((t, i) => (
                    <div
                      className="task-row"
                      key={t.id}
                      data-testid={`task-row-${t.id}`}
                    >
                      <div className="task-index">{i + 1}</div>
                      <div>
                        <div className="task-name">{t.name}</div>
                        <div className="task-detail">
                          <Users size={10} /> {t.crew} · <Wrench size={10} />{" "}
                          {t.equipment}
                          {t.dependencies.length > 0 && (
                            <span>
                              {" "}
                              · after{" "}
                              {t.dependencies
                                .map(
                                  (id) =>
                                    project.tasks.find((t) => t.id === id)
                                      ?.name,
                                )
                                .join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="task-day">
                        {day(t.startDay)}–{day(taskFinish(t))}
                        {!!t.interruptions?.length && (
                          <div>
                            {t.duration} work days · paused{" "}
                            {t.interruptions
                              .map((w) => `${w.startDay}–${w.endDay}`)
                              .join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
            <section
              className="panel event-panel"
              data-testid="panel-disruption"
            >
              <div className="panel-head">
                <div>
                  <div className="panel-kicker">02 / What changed?</div>
                  <h2 className="panel-title">Describe the disruption</h2>
                  <p className="panel-subtitle">
                    Name a task, crew, or equipment and an earliest-start day or
                    project-day outage window.
                  </p>
                </div>
              </div>
              <div className="panel-body">
                <textarea
                  className="event-text"
                  data-testid="input-disruption"
                  value={event}
                  maxLength={2000}
                  onChange={(e) => {
                    // Capture and store the draft before clearing derived UI.
                    // Never read a live DOM value after scheduling those resets.
                    const nextEvent = e.currentTarget.value;
                    setEvent(nextEvent);
                    invalidate();
                    setConfirmed(false);
                  }}
                  placeholder="Telehandler unavailable for 2 days starting Day 4"
                />
                <div className="timing-confirm">
                  <label>
                    Hold start, if omitted from text{" "}
                    <input
                      data-testid="input-hold-start"
                      aria-label="Hold start project day"
                      type="number"
                      min="1"
                      max="10000"
                      value={start}
                      onChange={(e) => {
                        invalidate();
                        setStart(e.target.value);
                        setConfirmed(false);
                      }}
                    />
                  </label>
                  <label>
                    <input
                      data-testid="confirm-hold-start"
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => {
                        invalidate();
                        setConfirmed(e.target.checked);
                      }}
                    />{" "}
                    I confirm this project-day start for all holds missing a
                    start.
                  </label>
                  <p>
                    No start is assumed. “Cannot start until Day 4” permits a
                    start on Day 4; no hold duration is needed. Days 4–5 outages
                    release at the start of Day 6. An outage today is not
                    automatically moved to future work.
                  </p>
                </div>
                <div className="event-footer">
                  <span className="classify">
                    <Info size={13} /> Analysis never changes the active
                    schedule.
                  </span>
                  <button
                    className="button button-primary"
                    data-testid="button-analyze"
                    disabled={busy || asking || !event.trim()}
                    onClick={runAnalysis}
                  >
                    {busy ? <RotateCcw size={14} /> : <Sparkles size={14} />}{" "}
                    {busy ? "Checking the sequence…" : "Build recovery plan"}
                  </button>
                </div>
                <div className="demo-cases">
                  <div className="demo-caption">Load a runnable scenario</div>
                  {projects.map((p) => (
                    <button
                      className="case-chip"
                      key={p.id}
                      data-testid={`scenario-load-${p.id}`}
                      onClick={() => selectProject(p.id)}
                    >
                      {p.id === "labor"
                        ? "Telehandler hold"
                        : p.id === "equipment"
                          ? "Crane downtime"
                          : "Coffee delivery"}
                    </button>
                  ))}
                </div>
              </div>
            </section>
            <section className="panel edit-panel">
              <button
                className="edit-toggle"
                data-testid="button-toggle-schedule-editor"
                onClick={() => setEditOpen((v) => !v)}
              >
                <span className="edit-toggle-label">
                  <Pencil size={14} /> Edit this demo schedule
                </span>
              </button>
              {editOpen && (
                <div className="edit-content">
                  <p className="edit-note">
                    Changes invalidate analysis and chat. Invalid dependencies
                    or dates are rejected by the backend. Edits and applied
                    proposals are lost on reload.
                  </p>
                  <div className="edit-label">
                    TASK / WORKING DAYS / START PROJECT DAY
                  </div>
                  <div className="edit-grid">
                    {project.tasks.map((t) => (
                      <div className="edit-task" key={t.id}>
                        <input
                          aria-label={`${t.name} task name`}
                          data-testid={`edit-task-name-${t.id}`}
                          value={t.name}
                          onChange={(e) =>
                            changeTask(t.id, "name", e.target.value)
                          }
                        />
                        <input
                          aria-label={`${t.name} duration`}
                          data-testid={`edit-task-duration-${t.id}`}
                          type="number"
                          min="1"
                          value={t.duration}
                          onChange={(e) =>
                            changeTask(t.id, "duration", e.target.value)
                          }
                        />
                        <input
                          aria-label={`${t.name} start day`}
                          data-testid={`edit-task-start-${t.id}`}
                          type="number"
                          min="1"
                          value={t.startDay}
                          onChange={(e) =>
                            changeTask(t.id, "startDay", e.target.value)
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    className="text-button"
                    data-testid="button-reset-demo"
                    onClick={() => {
                      invalidate();
                      setProjects(initialProjects);
                      setEvent(
                        initialProjects.find((p) => p.id === activeId)!.event,
                      );
                      setStart("");
                      setConfirmed(false);
                    }}
                  >
                    Reset demo data
                  </button>
                </div>
              )}
            </section>
          </div>
          <div className="column-stack right">
            <section
              className="panel result-panel"
              data-testid="panel-recommendation"
            >
              <div className="panel-head">
                <div>
                  <div className="panel-kicker">03 / Review the move</div>
                  <h2 className="panel-title">Recovery plan</h2>
                  <p className="panel-subtitle">
                    Nothing changes until explicit acceptance.
                  </p>
                </div>
              </div>
              {error && (
                <div className="request-error" role="alert">
                  {error}{" "}
                  <button className="text-button" onClick={runAnalysis}>
                    Retry analysis
                  </button>
                </div>
              )}
              {busy ? (
                <div className="result-empty">Checking schedule…</div>
              ) : !recommendation ? (
                <div
                  className="result-empty"
                  data-testid="status-analysis-empty"
                >
                  Describe a disruption and submit to calculate changes.
                </div>
              ) : (
                <>
                  <div
                    className={`result-banner ${recommendation.status === "clarification" ? "warning" : ""} ${applied ? "applied" : ""}`}
                  >
                    <div>
                      <div className="result-status">
                        {applied
                          ? "Applied once to this demo"
                          : recommendation.status === "clarification"
                            ? "Clarification required"
                            : "Rules-based analysis"}
                      </div>
                      <h3 className="result-title">{recommendation.summary}</h3>
                    </div>
                  </div>
                  <div className="result-content">
                    <p className="result-summary">
                      {recommendation.modeDetail}
                    </p>
                    {recommendation.clarifications.map((c) => (
                      <p className="disclaimer" key={c}>
                        {c}
                      </p>
                    ))}
                    {recommendation.assumptions.map((a) => (
                      <p className="disclaimer" key={a}>
                        {a}
                      </p>
                    ))}
                    {recommendation.constraints.map((c, i) => (
                      <div className="disclaimer" key={i}>
                        <CalendarDays size={14} />
                        <span>
                          {c.target}:{" "}
                          {c.restriction === "start-not-before"
                            ? `earliest start Day ${c.earliestStartDay} (inclusive). Starts only; not an interruption or added work.`
                            : `${c.duration}-day hold. ${
                                c.startDay === null
                                  ? "Start unconfirmed"
                                  : `Days ${c.startDay}–${c.endDay}; release Day ${c.releaseDay}.`
                              }`}
                        </span>
                      </div>
                    ))}
                    {recommendation.status !== "clarification" && (
                      <div className="impact-stats">
                        <div className="impact-cell">
                          <div className="stat-label">
                            {recommendation.milestoneName} completion
                          </div>
                          <div className="stat-value">
                            {day(recommendation.beforeMilestone)} →{" "}
                            {day(recommendation.afterMilestone!)}{" "}
                            <small>
                              target {day(recommendation.milestoneTarget)}
                            </small>
                          </div>
                        </div>
                        <div className="impact-cell">
                          <div className="stat-label">Overall finish</div>
                          <div className="stat-value">
                            {day(recommendation.beforeFinish)} →{" "}
                            {day(recommendation.afterFinish!)}{" "}
                            <small>
                              +
                              {recommendation.afterFinish! -
                                recommendation.beforeFinish}
                              d
                            </small>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="action-list">
                      {recommendation.changes.map((c) => (
                        <div className="action-item" key={c.taskId}>
                          <div className="action-number">→</div>
                          <div className="action-copy">
                            <strong>{c.name}</strong>
                            <br />
                            Days {c.beforeStart}–{c.beforeFinish} → Days{" "}
                            {c.afterStart}–{c.afterFinish} · start +
                            {c.afterStart - c.beforeStart}d; finish +
                            {c.afterFinish - c.beforeFinish}d
                            {!!c.afterInterruptions.length && (
                              <div>
                                {c.afterDuration} working days; pauses on
                                project Days{" "}
                                {c.afterInterruptions
                                  .map((w) => `${w.startDay}–${w.endDay}`)
                                  .join(", ")}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      className="affected-toggle"
                      data-testid="button-toggle-affected-tasks"
                      onClick={() => setAffectedOpen((v) => !v)}
                    >
                      {affectedOpen ? "Hide" : "Inspect"}{" "}
                      {recommendation.affectedTaskIds.length} affected /{" "}
                      {recommendation.changedTaskIds.length} changed tasks
                    </button>
                    {affectedOpen && (
                      <div
                        className="affected-list"
                        data-testid="list-affected-tasks"
                      >
                        {recommendation.affectedTaskIds.map((id) => (
                          <div className="affected-task" key={id}>
                            {project.tasks.find((t) => t.id === id)?.name} ·{" "}
                            {recommendation.changedTaskIds.includes(id)
                              ? "dates changed"
                              : "dates unchanged; float retained"}
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="disclaimer">{recommendation.convention}</p>
                    <p className="disclaimer">
                      <ShieldCheck size={14} /> Foreman must verify resources,
                      site conditions, and safety before accepting. No equipment
                      substitutions or crew transfers are proposed.
                    </p>
                    <div className="result-controls">
                      {recommendation.status === "ready" && !applied && (
                        <button
                          className="button button-primary button-mini"
                          data-testid="button-apply-plan"
                          onClick={apply}
                        >
                          <Check size={13} /> Accept & apply
                        </button>
                      )}
                      {applied && (
                        <span className="classify">
                          Applied. Analyze again for a new proposal.
                        </span>
                      )}
                      <button
                        className="button button-quiet button-mini"
                        data-testid="button-dismiss-plan"
                        onClick={invalidate}
                      >
                        <X size={13} /> Clear result
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>
            <section className="panel conversation" data-testid="panel-ask">
              <div className="panel-head">
                <div>
                  <div className="panel-kicker">04 / Ask the schedule</div>
                  <h2 className="panel-title">Talk through the plan</h2>
                  <p className="panel-subtitle">
                    Rules-based backend answers · live AI deferred.
                  </p>
                </div>
              </div>
              <div className="panel-body">
                <div className="question-examples">
                  {[
                    "Does anything move?",
                    "Does the plan change?",
                    "What happens to the milestone?",
                    "Compare the alternatives",
                  ].map((p, i) => (
                    <button
                      className="question-chip"
                      key={p}
                      disabled={asking || busy}
                      data-testid={`prompt-question-${i + 1}`}
                      onClick={() => submitQuestion(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div className="chat-feed" data-testid="conversation-history">
                  {chat.map((c, i) => (
                    <div
                      className={`chat-message ${c.who}`}
                      data-testid={`chat-message-${i}`}
                      key={i}
                    >
                      <span className="chat-label">
                        {c.who === "user"
                          ? "You asked"
                          : "Rules-based schedule answer"}
                      </span>
                      {c.text}
                      {c.modeDetail && (
                        <p className="disclaimer">{c.modeDetail}</p>
                      )}
                    </div>
                  ))}
                </div>
                {asking && (
                  <p className="classify" role="status">
                    Checking the current schedule…
                  </p>
                )}
                <form
                  className="chat-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitQuestion();
                  }}
                >
                  <input
                    className="chat-input"
                    data-testid="input-schedule-question"
                    maxLength={500}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask about movement or milestones…"
                  />
                  <button
                    className="chat-send"
                    data-testid="button-send-question"
                    type="submit"
                    disabled={asking || busy || !question.trim()}
                    aria-label="Send question"
                  >
                    <Send size={15} />
                  </button>
                </form>
              </div>
            </section>
          </div>
        </div>
        <footer className="boundary">
          <Info size={14} />
          <span>
            <strong>Prototype limits:</strong> backend rules calculate dates;
            live AI was not implemented at this time and is deferred because
            managed provisioning is unavailable. No AI token usage; credit cost
            unverified. Data is sent to the backend only on explicit analysis or
            question submissions, not typing or applying. Nothing is permanently
            stored. No calendar inference, capacity leveling, or autonomous
            field approval.
          </span>
        </footer>
      </main>
    </div>
  );
}
