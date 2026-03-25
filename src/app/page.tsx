"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { QUESTIONS, BLOCKS } from "@/lib/questions";
import s from "./interview.module.css";

interface TweakedQuestion {
  number: number;
  question: string;
  focus: string;
}

interface ChatMessage {
  id: string;
  type: "bot" | "user" | "wordsmith" | "block-divider" | "system" | "milestone" | "word-count";
  content: string;
  questionNumber?: number;
  focus?: string;
  label?: string;
  soundbiteWords?: number;
  polishedWords?: number;
}

interface CompletedAnswer {
  number: number;
  question: string;
  answer: string;
}

type AppState = "topic-entry" | "loading-questions" | "interviewing" | "complete";
type QuestionState = "waiting-for-answer" | "wordsmithing" | "reviewing" | "refining";

interface SpeechRecognitionResult { transcript: string; }
interface SpeechRecognitionEvent { results: { [i: number]: { [j: number]: SpeechRecognitionResult } }; }
interface SpeechRecognitionInstance {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void;
}

// Block milestone messages
const BLOCK_MILESTONES: Record<number, { title: string; emoji: string; message: string }> = {
  5: { title: "Block 1 Complete", emoji: "🧠", message: "You've mapped how your buyers see the problem. That's the foundation everything else builds on." },
  10: { title: "Block 2 Complete", emoji: "💡", message: "Your contrarian beliefs and unique thinking are captured. This is where the real differentiation lives." },
  15: { title: "Block 3 Complete", emoji: "⚙️", message: "Process and methodology locked in. Buyers can now see exactly how you operate differently." },
  18: { title: "Block 4 Complete", emoji: "🎯", message: "Ideal fit and investment picture are clear. Now for the final stretch." },
};

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Confetti effect
function fireConfetti() {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;z-index:9999;pointer-events:none;";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  const colors = ["#7612fa", "#c109af", "#ff6221", "#10b981", "#eab308", "#fff"];
  const particles: { x: number; y: number; vx: number; vy: number; size: number; color: string; rotation: number; spin: number; life: number }[] = [];

  for (let i = 0; i < 80; i++) {
    particles.push({
      x: canvas.width * 0.5 + (Math.random() - 0.5) * 200,
      y: canvas.height * 0.4,
      vx: (Math.random() - 0.5) * 12,
      vy: Math.random() * -14 - 4,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      spin: (Math.random() - 0.5) * 10,
      life: 1,
    });
  }

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35;
      p.vx *= 0.99;
      p.rotation += p.spin;
      p.life -= 0.012;
      if (p.life <= 0) continue;
      alive = true;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    frame++;
    if (alive && frame < 180) requestAnimationFrame(animate);
    else canvas.remove();
  }
  requestAnimationFrame(animate);
}

export default function Home() {
  const [appState, setAppState] = useState<AppState>("topic-entry");
  const [topic, setTopic] = useState("");
  const [tweakedQuestions, setTweakedQuestions] = useState<TweakedQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [questionState, setQuestionState] = useState<QuestionState>("waiting-for-answer");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [completedAnswers, setCompletedAnswers] = useState<CompletedAnswer[]>([]);
  const [currentWordsmith, setCurrentWordsmith] = useState("");
  const [currentSoundbite, setCurrentSoundbite] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Gamification state
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [firstTakeCount, setFirstTakeCount] = useState(0);
  const [refinementCount, setRefinementCount] = useState(0); // per-question refinements

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [inputValue]);

  function addMessage(msg: Omit<ChatMessage, "id">) {
    const newMsg = { ...msg, id: crypto.randomUUID() };
    setMessages((prev) => [...prev, newMsg]);
    return newMsg;
  }

  // Progress percentage (starts at 5% so it never feels like zero)
  const progressPercent = appState === "topic-entry" ? 0 : Math.min(100, 5 + (completedAnswers.length / 20) * 95);
  const completedCount = completedAnswers.length;

  // Current block info
  const currentBlockNum = currentQuestion < 20 ? QUESTIONS[currentQuestion].blockNumber : 5;
  const currentBlockName = BLOCKS[currentBlockNum - 1] || "";

  async function handleTopicSubmit() {
    if (!topic.trim()) return;
    setAppState("loading-questions");
    addMessage({ type: "system", content: `Starting interview session for "${topic}"...` });
    try {
      const res = await fetch("/api/tweak-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
      });
      const data = await res.json();
      if (data.tweaked?.length > 0) {
        setTweakedQuestions(data.tweaked);
        setAppState("interviewing");
        setCurrentQuestion(0);
        setQuestionState("waiting-for-answer");
        addMessage({ type: "block-divider", content: BLOCKS[0] });
        addMessage({ type: "bot", content: data.tweaked[0].question, questionNumber: 1, focus: data.tweaked[0].focus, label: "Question 1" });
      } else {
        addMessage({ type: "system", content: "Error preparing questions. Please try again." });
        setAppState("topic-entry");
      }
    } catch {
      addMessage({ type: "system", content: "Error connecting to API. Please try again." });
      setAppState("topic-entry");
    }
  }

  async function handleSendSoundbite() {
    if (!inputValue.trim() || questionState !== "waiting-for-answer") return;
    const soundbite = inputValue.trim();
    setCurrentSoundbite(soundbite);
    setInputValue("");
    setRefinementCount(0);
    addMessage({ type: "user", content: soundbite });
    setQuestionState("wordsmithing");
    addMessage({ type: "system", content: "Wordsmithing your answer..." });
    try {
      const q = tweakedQuestions[currentQuestion];
      const res = await fetch("/api/wordsmith", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, question: q.question, focus: q.focus, soundbite }),
      });
      const data = await res.json();
      setMessages((prev) => prev.filter((m) => m.content !== "Wordsmithing your answer..."));
      setCurrentWordsmith(data.answer);
      setQuestionState("reviewing");
      // Word count message
      addMessage({
        type: "word-count",
        content: "",
        soundbiteWords: countWords(soundbite),
        polishedWords: countWords(data.answer),
      });
      addMessage({ type: "wordsmith", content: data.answer, questionNumber: currentQuestion + 1 });
    } catch {
      setMessages((prev) => prev.filter((m) => m.content !== "Wordsmithing your answer..."));
      addMessage({ type: "system", content: "Error wordsmithing. Please try again." });
      setQuestionState("waiting-for-answer");
    }
  }

  async function handleRefine() {
    if (!inputValue.trim() || questionState !== "reviewing") return;
    const feedback = inputValue.trim();
    setInputValue("");
    setRefinementCount((c) => c + 1);
    addMessage({ type: "user", content: `Refinement: ${feedback}` });
    setQuestionState("refining");
    addMessage({ type: "system", content: "Refining your answer..." });
    try {
      const q = tweakedQuestions[currentQuestion];
      const res = await fetch("/api/wordsmith", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, question: q.question, focus: q.focus, soundbite: currentSoundbite, feedback, previousAnswer: currentWordsmith }),
      });
      const data = await res.json();
      setMessages((prev) => prev.filter((m) => m.content !== "Refining your answer..."));
      setCurrentWordsmith(data.answer);
      setQuestionState("reviewing");
      addMessage({ type: "wordsmith", content: data.answer, questionNumber: currentQuestion + 1 });
    } catch {
      setMessages((prev) => prev.filter((m) => m.content !== "Refining your answer..."));
      addMessage({ type: "system", content: "Error refining. Please try again." });
      setQuestionState("reviewing");
    }
  }

  function handleApprove() {
    fireConfetti();

    const q = tweakedQuestions[currentQuestion];
    const newCompleted = [...completedAnswers, { number: currentQuestion + 1, question: q.question, answer: currentWordsmith }];
    setCompletedAnswers(newCompleted);

    // Streak tracking
    const isFirstTake = refinementCount === 0;
    if (isFirstTake) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      setFirstTakeCount((c) => c + 1);
      if (newStreak > bestStreak) setBestStreak(newStreak);
    } else {
      setStreak(0);
    }

    const nextQ = currentQuestion + 1;

    // Check for block milestone
    const milestoneData = BLOCK_MILESTONES[newCompleted.length];
    if (milestoneData) {
      addMessage({
        type: "milestone",
        content: milestoneData.message,
        label: `${milestoneData.emoji} ${milestoneData.title}`,
      });
    }

    if (nextQ >= 20) {
      setAppState("complete");
      addMessage({
        type: "milestone",
        content: `All 20 questions answered! ${firstTakeCount + (isFirstTake ? 1 : 0)} approved on first take. ${bestStreak > (isFirstTake ? streak + 1 : bestStreak) ? bestStreak : isFirstTake ? streak + 1 : bestStreak} best streak. Your expertise has been captured.`,
        label: "🏆 Interview Complete",
      });
      return;
    }

    setCurrentQuestion(nextQ);
    setQuestionState("waiting-for-answer");
    setCurrentWordsmith("");
    setCurrentSoundbite("");
    setRefinementCount(0);

    const prevBlock = QUESTIONS[currentQuestion].blockNumber;
    const nextBlock = QUESTIONS[nextQ].blockNumber;
    if (nextBlock !== prevBlock) {
      addMessage({ type: "block-divider", content: BLOCKS[nextBlock - 1] });
    }
    addMessage({
      type: "bot",
      content: tweakedQuestions[nextQ].question,
      questionNumber: nextQ + 1,
      focus: tweakedQuestions[nextQ].focus,
      label: `Question ${nextQ + 1}`,
    });
  }

  function exportCSV() {
    const header = "Question Number,Question,Answer\n";
    const rows = completedAnswers.map((a) => `${a.number},"${a.question.replace(/"/g, '""')}","${a.answer.replace(/"/g, '""')}"`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sme-interview-${topic.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function createRecognition(): SpeechRecognitionInstance | null {
    const SR = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition || (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition;
    if (!SR) return null;
    const r = new SR(); r.continuous = false; r.interimResults = false; r.lang = "en-US"; return r;
  }

  function toggleRecording() {
    if (isRecording) { recognitionRef.current?.stop(); setIsRecording(false); return; }
    const recognition = createRecognition();
    if (!recognition) { alert("Speech recognition is not supported in this browser."); return; }
    recognitionRef.current = recognition;
    recognition.onresult = (e: SpeechRecognitionEvent) => { setInputValue((prev) => (prev ? prev + " " + e.results[0][0].transcript : e.results[0][0].transcript)); setIsRecording(false); };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognition.start(); setIsRecording(true);
  }

  function handleSend() {
    if (appState === "topic-entry") handleTopicSubmit();
    else if (questionState === "waiting-for-answer") handleSendSoundbite();
    else if (questionState === "reviewing") handleRefine();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function getPlaceholder() {
    if (appState === "topic-entry") return "Enter a topic (e.g., Growth-Driven Design)...";
    if (questionState === "waiting-for-answer") return "Type your soundbite...";
    if (questionState === "reviewing") return "Type refinement feedback, or click approve...";
    return "Please wait...";
  }

  const isInputDisabled = appState === "loading-questions" || questionState === "wordsmithing" || questionState === "refining";

  return (
    <div className={s.container}>
      {sidebarOpen && <div className={s.overlay} onClick={() => setSidebarOpen(false)} />}

      {/* Left Sidebar */}
      <aside className={`${s.sidebar} ${sidebarOpen ? s.open : ""}`}>
        <div className={s.sidebarBrand}>
          <div className={s.brandLogo}>S</div>
          <div>
            <div className={s.brandName}>SME Studio</div>
            <div className={s.brandSub}>Interview Engine</div>
          </div>
        </div>
        <div className={s.sidebarSessions}>
          {topic && (
            <>
              <div className={s.sectionLabel}>Active</div>
              <div className={s.sessionItem}>
                <div className={s.sessionIcon}>🎤</div>
                <div style={{ minWidth: 0 }}>
                  <div className={s.sessionName}>{topic}</div>
                  <div className={s.sessionMeta}>In progress</div>
                </div>
              </div>
            </>
          )}
        </div>
        <div className={s.sidebarFooter}>
          <button className={s.newSessionBtn} onClick={() => {
            if (completedCount > 0 && !confirm("Start a new interview? Current progress will be lost.")) return;
            setAppState("topic-entry"); setTopic(""); setMessages([]); setCompletedAnswers([]);
            setTweakedQuestions([]); setCurrentQuestion(0); setCurrentWordsmith(""); setCurrentSoundbite("");
            setStreak(0); setBestStreak(0); setFirstTakeCount(0); setRefinementCount(0);
          }}>+ New Interview</button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className={s.main}>
        {/* Top bar with progress */}
        <div className={s.topbar}>
          <button className={s.menuBtn} onClick={() => setSidebarOpen(true)}>☰</button>
          <div className={s.topbarAvatar}>🎤</div>
          <div className={s.topbarInfo}>
            <div className={s.topbarTitle}>{topic || "SME Interview Studio"}</div>
            <div className={s.topbarSub}>
              {appState === "topic-entry" ? "Enter a topic to begin"
                : appState === "loading-questions" ? "Preparing your questions..."
                : appState === "complete" ? "Interview complete!"
                : currentBlockName}
            </div>
          </div>
          {/* Streak badge */}
          {streak >= 2 && appState === "interviewing" && (
            <div className={s.streakBadge}>🔥 {streak}</div>
          )}
          {completedCount > 0 && (
            <button className={s.csvBadge} onClick={exportCSV}>📥 CSV</button>
          )}
        </div>

        {/* Progress bar */}
        {appState !== "topic-entry" && (
          <div className={s.progressBarTrack}>
            <div className={s.progressBarFill} style={{ width: `${progressPercent}%` }} />
          </div>
        )}

        {/* Chat messages */}
        <div className={s.chatArea}>
          {appState === "topic-entry" && messages.length === 0 && (
            <div className={s.welcome}>
              <div className={s.welcomeInner}>
                <div className={s.welcomeIcon}>🎤</div>
                <h2 className={s.welcomeTitle}>SME Interview Studio</h2>
                <p className={s.welcomeDesc}>
                  Strategic questions to extract your unique positioning, point of view, and
                  differentiators. Enter a topic below to begin.
                </p>
                <div className={s.topicChips}>
                  {["Growth-Driven Design", "Revenue Operations", "Managed IT Security", "Cloud Migration"].map((t) => (
                    <button key={t} className={s.topicChip} onClick={() => setTopic(t)}>{t}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((msg) => {
            if (msg.type === "block-divider") {
              return <div key={msg.id} className={s.blockDivider}>{msg.content}</div>;
            }
            if (msg.type === "system") {
              return <div key={msg.id} className={s.systemMsg}>{msg.content}</div>;
            }
            if (msg.type === "milestone") {
              return (
                <div key={msg.id} className={s.milestoneCard}>
                  <div className={s.milestoneTitle}>{msg.label}</div>
                  <div className={s.milestoneMsg}>{msg.content}</div>
                </div>
              );
            }
            if (msg.type === "word-count") {
              return (
                <div key={msg.id} className={s.wordCountBubble}>
                  <span className={s.wordCountLabel}>Your soundbite:</span> {msg.soundbiteWords} words
                  <span className={s.wordCountArrow}>→</span>
                  <span className={s.wordCountLabel}>Polished:</span> {msg.polishedWords} words
                </div>
              );
            }
            if (msg.type === "user") {
              return (
                <div key={msg.id} className={`${s.msgGroup} ${s.msgGroupUser}`}>
                  <div className={`${s.msgAvatar} ${s.msgAvatarUser}`}>You</div>
                  <div className={s.msgContent}>
                    <div className={`${s.msgSender} ${s.msgSenderUser}`}>You</div>
                    <div className={`${s.msgBubble} ${s.msgBubbleUser}`}>{msg.content}</div>
                  </div>
                </div>
              );
            }
            if (msg.type === "bot") {
              return (
                <div key={msg.id} className={`${s.msgGroup} ${s.msgGroupBot}`}>
                  <div className={`${s.msgAvatar} ${s.msgAvatarBot}`}>🎤</div>
                  <div className={s.msgContent}>
                    <div className={s.msgSender}>Interviewer</div>
                    <div className={`${s.msgBubble} ${s.msgBubbleBot}`}>
                      {msg.label && <div className={s.qLabel}>{msg.label}</div>}
                      <div className={s.qText}>{msg.content}</div>
                      {msg.focus && <div className={s.qFocus}>{msg.focus}</div>}
                    </div>
                  </div>
                </div>
              );
            }
            if (msg.type === "wordsmith") {
              const isLatest = msg === [...messages].reverse().find((m) => m.type === "wordsmith");
              return (
                <div key={msg.id} className={`${s.msgGroup} ${s.msgGroupBot}`}>
                  <div className={`${s.msgAvatar} ${s.msgAvatarBot}`}>✨</div>
                  <div className={s.msgContent}>
                    <div className={s.msgSender}>Wordsmithed Answer</div>
                    <div className={`${s.msgBubble} ${s.msgBubbleWordsmith}`}>
                      <div className={s.wsLabel}>✨ Polished Answer</div>
                      <div className={s.wsText}>{msg.content}</div>
                      {isLatest && questionState === "reviewing" && (
                        <div className={s.actionButtons}>
                          <button className={s.btnGreat} onClick={handleApprove}>✅ It&apos;s Great!</button>
                          <button className={s.btnRefine} onClick={() => textareaRef.current?.focus()}>✏️ Refine</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })}

          {(questionState === "wordsmithing" || questionState === "refining" || appState === "loading-questions") && (
            <div className={s.loadingDots}>
              <div className={`${s.msgAvatar} ${s.msgAvatarBot}`}>✨</div>
              <div className={s.dotsContainer}>
                <div className={s.dot} /><div className={s.dot} /><div className={s.dot} />
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div className={s.inputArea}>
          {appState === "complete" ? (
            <div className={s.completeActions}>
              <button className={s.downloadBtn} onClick={exportCSV}>📥 Download CSV</button>
              <div className={s.finalStats}>
                <div className={s.statItem}>
                  <span className={s.statValue}>{firstTakeCount}</span>
                  <span className={s.statLabel}>First takes</span>
                </div>
                <div className={s.statItem}>
                  <span className={s.statValue}>{bestStreak}</span>
                  <span className={s.statLabel}>Best streak</span>
                </div>
                <div className={s.statItem}>
                  <span className={s.statValue}>20</span>
                  <span className={s.statLabel}>Answers</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className={s.inputRow}>
                <div className={s.inputBox}>
                  <textarea
                    ref={textareaRef} rows={1}
                    value={appState === "topic-entry" ? topic : inputValue}
                    onChange={(e) => appState === "topic-entry" ? setTopic(e.target.value) : setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={getPlaceholder()}
                    disabled={isInputDisabled}
                  />
                </div>
                {appState !== "topic-entry" && (
                  <button className={`${s.micBtn} ${isRecording ? s.micBtnRecording : ""}`} onClick={toggleRecording} disabled={isInputDisabled}>
                    {isRecording ? "⏹" : "🎙"}
                  </button>
                )}
                <button className={s.sendBtn} onClick={handleSend} disabled={isInputDisabled || (appState === "topic-entry" ? !topic.trim() : !inputValue.trim())}>➤</button>
              </div>
              <div className={s.inputHint}>
                Press Enter to send · Shift+Enter for new line
                {questionState === "reviewing" && " · Type feedback to refine, or click approve"}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Panel — Progress Ring (no question list) */}
      <aside className={s.rightPanel}>
        <div className={s.rpHeader}>
          <div className={s.rpTitle}>Progress</div>
        </div>

        <div className={s.rpBody}>
          {/* SVG Progress Ring */}
          <div className={s.ringContainer}>
            <svg viewBox="0 0 120 120" className={s.ringSvg}>
              <defs>
                <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7612fa" />
                  <stop offset="50%" stopColor="#c109af" />
                  <stop offset="100%" stopColor="#ff6221" />
                </linearGradient>
              </defs>
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
              <circle
                cx="60" cy="60" r="52" fill="none" stroke="url(#ringGrad)" strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 52}`}
                strokeDashoffset={`${2 * Math.PI * 52 * (1 - progressPercent / 100)}`}
                style={{ transition: "stroke-dashoffset 0.6s ease", transform: "rotate(-90deg)", transformOrigin: "center" }}
              />
            </svg>
            <div className={s.ringCenter}>
              <div className={s.ringPercent}>{Math.round(progressPercent)}%</div>
              <div className={s.ringBlockName}>{appState === "complete" ? "Done!" : currentBlockName}</div>
            </div>
          </div>

          {/* Stats */}
          <div className={s.rpStats}>
            <div className={s.rpStatRow}>
              <span className={s.rpStatIcon}>✅</span>
              <span className={s.rpStatText}>Answers completed</span>
              <span className={s.rpStatVal}>{completedCount}</span>
            </div>
            <div className={s.rpStatRow}>
              <span className={s.rpStatIcon}>🔥</span>
              <span className={s.rpStatText}>First-take streak</span>
              <span className={s.rpStatVal}>{streak}</span>
            </div>
            <div className={s.rpStatRow}>
              <span className={s.rpStatIcon}>⚡</span>
              <span className={s.rpStatText}>Best streak</span>
              <span className={s.rpStatVal}>{bestStreak}</span>
            </div>
            <div className={s.rpStatRow}>
              <span className={s.rpStatIcon}>🎯</span>
              <span className={s.rpStatText}>First takes</span>
              <span className={s.rpStatVal}>{firstTakeCount}/{completedCount || 0}</span>
            </div>
          </div>

          {/* Block progress */}
          <div className={s.rpBlocks}>
            <div className={s.rpBlocksTitle}>Blocks</div>
            {BLOCKS.map((block, i) => {
              const blockStart = [0, 5, 10, 15, 18][i];
              const blockEnd = [5, 10, 15, 18, 20][i];
              const blockDone = Math.min(Math.max(completedCount - blockStart, 0), blockEnd - blockStart);
              const blockTotal = blockEnd - blockStart;
              const isCurrentBlock = currentBlockNum === i + 1 && appState === "interviewing";
              const isComplete = blockDone === blockTotal;
              return (
                <div key={block} className={`${s.rpBlockItem} ${isCurrentBlock ? s.rpBlockItemActive : ""} ${isComplete ? s.rpBlockItemDone : ""}`}>
                  <div className={s.rpBlockTop}>
                    <span className={s.rpBlockIcon}>{isComplete ? "✅" : isCurrentBlock ? "▶" : "○"}</span>
                    <span className={s.rpBlockName}>{block}</span>
                  </div>
                  <div className={s.rpBlockBar}>
                    <div className={s.rpBlockBarFill} style={{ width: `${(blockDone / blockTotal) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={s.rpFooter}>
          <button className={s.exportBtn} onClick={exportCSV} disabled={completedCount === 0}>
            {completedCount < 20 ? "🔒 Export CSV" : "📥 Export CSV"}
          </button>
        </div>
      </aside>
    </div>
  );
}
