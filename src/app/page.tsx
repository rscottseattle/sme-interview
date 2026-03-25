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
  type: "bot" | "user" | "wordsmith" | "block-divider" | "system";
  content: string;
  questionNumber?: number;
  focus?: string;
  label?: string;
}

interface CompletedAnswer {
  number: number;
  question: string;
  answer: string;
}

type AppState = "topic-entry" | "loading-questions" | "interviewing" | "complete";
type QuestionState = "waiting-for-answer" | "wordsmithing" | "reviewing" | "refining";

interface SpeechRecognitionResult {
  transcript: string;
}

interface SpeechRecognitionEvent {
  results: { [index: number]: { [index: number]: SpeechRecognitionResult } };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
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
        addMessage({
          type: "bot",
          content: data.tweaked[0].question,
          questionNumber: 1,
          focus: data.tweaked[0].focus,
          label: "Question 1",
        });
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
    addMessage({ type: "user", content: `Refinement: ${feedback}` });
    setQuestionState("refining");
    addMessage({ type: "system", content: "Refining your answer..." });

    try {
      const q = tweakedQuestions[currentQuestion];
      const res = await fetch("/api/wordsmith", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic, question: q.question, focus: q.focus,
          soundbite: currentSoundbite, feedback, previousAnswer: currentWordsmith,
        }),
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
    const q = tweakedQuestions[currentQuestion];
    setCompletedAnswers((prev) => [
      ...prev,
      { number: currentQuestion + 1, question: q.question, answer: currentWordsmith },
    ]);
    const nextQ = currentQuestion + 1;
    if (nextQ >= 20) {
      setAppState("complete");
      addMessage({ type: "system", content: "Interview complete! All 20 questions answered." });
      return;
    }
    setCurrentQuestion(nextQ);
    setQuestionState("waiting-for-answer");
    setCurrentWordsmith("");
    setCurrentSoundbite("");
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
    const rows = completedAnswers
      .map((a) => `${a.number},"${a.question.replace(/"/g, '""')}","${a.answer.replace(/"/g, '""')}"`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sme-interview-${topic.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function createRecognition(): SpeechRecognitionInstance | null {
    const SR =
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance })
        .webkitSpeechRecognition ||
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance })
        .SpeechRecognition;
    if (!SR) return null;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    return recognition;
  }

  function toggleRecording() {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const recognition = createRecognition();
    if (!recognition) { alert("Speech recognition is not supported in this browser."); return; }
    recognitionRef.current = recognition;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      setInputValue((prev) => (prev ? prev + " " + event.results[0][0].transcript : event.results[0][0].transcript));
      setIsRecording(false);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognition.start();
    setIsRecording(true);
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
  const completedCount = completedAnswers.length;

  return (
    <div className={s.container}>
      {/* Mobile overlay */}
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
                  <div className={s.sessionMeta}>{completedCount}/20 complete</div>
                </div>
              </div>
            </>
          )}
        </div>
        <div className={s.sidebarFooter}>
          <button
            className={s.newSessionBtn}
            onClick={() => {
              if (completedCount > 0 && !confirm("Start a new interview? Current progress will be lost.")) return;
              setAppState("topic-entry"); setTopic(""); setMessages([]); setCompletedAnswers([]);
              setTweakedQuestions([]); setCurrentQuestion(0); setCurrentWordsmith(""); setCurrentSoundbite("");
            }}
          >
            + New Interview
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className={s.main}>
        {/* Top bar */}
        <div className={s.topbar}>
          <button className={s.menuBtn} onClick={() => setSidebarOpen(true)}>☰</button>
          <div className={s.topbarAvatar}>🎤</div>
          <div className={s.topbarInfo}>
            <div className={s.topbarTitle}>{topic || "SME Interview Studio"}</div>
            <div className={s.topbarSub}>
              {appState === "topic-entry" ? "Enter a topic to begin"
                : appState === "loading-questions" ? "Preparing your questions..."
                : appState === "complete" ? "Interview complete!"
                : `Question ${currentQuestion + 1} of 20`}
            </div>
          </div>
          {completedCount > 0 && (
            <button className={s.csvBadge} onClick={exportCSV}>📥 CSV</button>
          )}
        </div>

        {/* Chat messages */}
        <div className={s.chatArea}>
          {appState === "topic-entry" && messages.length === 0 && (
            <div className={s.welcome}>
              <div className={s.welcomeInner}>
                <div className={s.welcomeIcon}>🎤</div>
                <h2 className={s.welcomeTitle}>SME Interview Studio</h2>
                <p className={s.welcomeDesc}>
                  20 strategic questions to extract your unique positioning, point of view, and
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
                <div className={s.dot} />
                <div className={s.dot} />
                <div className={s.dot} />
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div className={s.inputArea}>
          {appState === "complete" ? (
            <button className={s.downloadBtn} onClick={exportCSV}>📥 Download CSV</button>
          ) : (
            <>
              <div className={s.inputRow}>
                <div className={s.inputBox}>
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={appState === "topic-entry" ? topic : inputValue}
                    onChange={(e) => appState === "topic-entry" ? setTopic(e.target.value) : setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={getPlaceholder()}
                    disabled={isInputDisabled}
                  />
                </div>
                {appState !== "topic-entry" && (
                  <button
                    className={`${s.micBtn} ${isRecording ? s.micBtnRecording : ""}`}
                    onClick={toggleRecording}
                    disabled={isInputDisabled}
                  >
                    {isRecording ? "⏹" : "🎙"}
                  </button>
                )}
                <button
                  className={s.sendBtn}
                  onClick={handleSend}
                  disabled={isInputDisabled || (appState === "topic-entry" ? !topic.trim() : !inputValue.trim())}
                >
                  ➤
                </button>
              </div>
              <div className={s.inputHint}>
                Press Enter to send · Shift+Enter for new line
                {questionState === "reviewing" && " · Type feedback to refine, or click approve"}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <aside className={s.rightPanel}>
        <div className={s.rpHeader}>
          <div className={s.rpTitle}>Interview Progress</div>
          <div className={s.progressRing}>
            <div
              className={s.ringVisual}
              style={{
                border: "3px solid rgba(255,255,255,0.06)",
                borderTopColor: "#7612fa",
                borderRightColor: completedCount > 5 ? "#7612fa" : "rgba(255,255,255,0.06)",
                borderBottomColor: completedCount > 10 ? "#c109af" : "rgba(255,255,255,0.06)",
                borderLeftColor: completedCount > 15 ? "#ff6221" : "rgba(255,255,255,0.06)",
              }}
            >
              {completedCount}
            </div>
            <div>
              <div className={s.ringLabel}>of 20 questions</div>
              <div className={s.ringSub}>
                {appState === "complete" ? "Complete!" : `~${(20 - completedCount) * 2} min remaining`}
              </div>
            </div>
          </div>
        </div>

        <div className={s.rpQuestions}>
          {BLOCKS.map((block, blockIdx) => (
            <div key={block}>
              <div className={s.rpBlockLabel}>{block}</div>
              {QUESTIONS.filter((q) => q.blockNumber === blockIdx + 1).map((q) => {
                const isDone = completedCount >= q.number;
                const isActive = currentQuestion === q.number - 1 && appState === "interviewing";
                const tweaked = tweakedQuestions[q.number - 1];
                return (
                  <div
                    key={q.number}
                    className={`${s.rpQuestion} ${isDone ? s.rpQuestionDone : ""} ${isActive ? s.rpQuestionActive : ""}`}
                  >
                    <span className={`${s.rpDot} ${isDone ? s.rpDotDone : ""} ${isActive ? s.rpDotActive : ""}`} />
                    <span className={s.rpQText}>
                      {q.number}. {tweaked ? tweaked.question.slice(0, 40) + (tweaked.question.length > 40 ? "..." : "") : q.template.slice(0, 40) + "..."}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className={s.rpFooter}>
          <button className={s.exportBtn} onClick={exportCSV} disabled={completedCount === 0}>
            📥 Export CSV
          </button>
        </div>
      </aside>
    </div>
  );
}
