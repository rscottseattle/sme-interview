"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { QUESTIONS, BLOCKS } from "@/lib/questions";

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

// Speech recognition types
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
  // App state
  const [appState, setAppState] = useState<AppState>("topic-entry");
  const [topic, setTopic] = useState("");
  const [tweakedQuestions, setTweakedQuestions] = useState<TweakedQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [questionState, setQuestionState] = useState<QuestionState>("waiting-for-answer");

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [completedAnswers, setCompletedAnswers] = useState<CompletedAnswer[]>([]);
  const [currentWordsmith, setCurrentWordsmith] = useState("");
  const [currentSoundbite, setCurrentSoundbite] = useState("");

  // UI
  const [isRecording, setIsRecording] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-resize textarea
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

  // ===== TOPIC ENTRY =====
  async function handleTopicSubmit() {
    if (!topic.trim()) return;
    setAppState("loading-questions");

    addMessage({
      type: "system",
      content: `Starting interview session for "${topic}"...`,
    });

    try {
      const res = await fetch("/api/tweak-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
      });
      const data = await res.json();

      if (data.tweaked && data.tweaked.length > 0) {
        setTweakedQuestions(data.tweaked);
        setAppState("interviewing");
        setCurrentQuestion(0);
        setQuestionState("waiting-for-answer");

        // Add first block divider and question
        addMessage({ type: "block-divider", content: BLOCKS[0] });
        addMessage({
          type: "bot",
          content: data.tweaked[0].question,
          questionNumber: 1,
          focus: data.tweaked[0].focus,
          label: `Question 1`,
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

  // ===== SEND SOUNDBITE =====
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
        body: JSON.stringify({
          topic,
          question: q.question,
          focus: q.focus,
          soundbite,
        }),
      });
      const data = await res.json();

      // Remove the "wordsmithing" system message
      setMessages((prev) => prev.filter((m) => m.content !== "Wordsmithing your answer..."));

      setCurrentWordsmith(data.answer);
      setQuestionState("reviewing");

      addMessage({
        type: "wordsmith",
        content: data.answer,
        questionNumber: currentQuestion + 1,
      });
    } catch {
      setMessages((prev) => prev.filter((m) => m.content !== "Wordsmithing your answer..."));
      addMessage({ type: "system", content: "Error wordsmithing. Please try again." });
      setQuestionState("waiting-for-answer");
    }
  }

  // ===== REFINE =====
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
          topic,
          question: q.question,
          focus: q.focus,
          soundbite: currentSoundbite,
          feedback,
          previousAnswer: currentWordsmith,
        }),
      });
      const data = await res.json();

      setMessages((prev) => prev.filter((m) => m.content !== "Refining your answer..."));

      setCurrentWordsmith(data.answer);
      setQuestionState("reviewing");

      addMessage({
        type: "wordsmith",
        content: data.answer,
        questionNumber: currentQuestion + 1,
      });
    } catch {
      setMessages((prev) => prev.filter((m) => m.content !== "Refining your answer..."));
      addMessage({ type: "system", content: "Error refining. Please try again." });
      setQuestionState("reviewing");
    }
  }

  // ===== APPROVE ANSWER =====
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

    // Check if we're entering a new block
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

  // ===== CSV EXPORT =====
  function exportCSV() {
    const header = "Question Number,Question,Answer\n";
    const rows = completedAnswers
      .map(
        (a) =>
          `${a.number},"${a.question.replace(/"/g, '""')}","${a.answer.replace(/"/g, '""')}"`
      )
      .join("\n");
    const csv = header + rows;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sme-interview-${topic.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ===== SPEECH RECOGNITION =====
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
    if (!recognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    recognitionRef.current = recognition;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setInputValue((prev) => (prev ? prev + " " + transcript : transcript));
      setIsRecording(false);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognition.start();
    setIsRecording(true);
  }

  // ===== HANDLE SEND =====
  function handleSend() {
    if (appState === "topic-entry") {
      handleTopicSubmit();
    } else if (questionState === "waiting-for-answer") {
      handleSendSoundbite();
    } else if (questionState === "reviewing") {
      handleRefine();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Placeholder text
  function getPlaceholder() {
    if (appState === "topic-entry") return "Enter a topic (e.g., Growth-Driven Design)...";
    if (questionState === "waiting-for-answer") return "Type your soundbite...";
    if (questionState === "reviewing") return "Type refinement feedback, or click approve...";
    return "Please wait...";
  }

  const isInputDisabled =
    appState === "loading-questions" ||
    questionState === "wordsmithing" ||
    questionState === "refining";

  const completedCount = completedAnswers.length;

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* ===== MOBILE OVERLAY ===== */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ===== LEFT SIDEBAR ===== */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-[280px] flex flex-col
          bg-[var(--ll-darker)] border-r border-[var(--ll-border)]
          transform transition-transform duration-200 ease-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Brand */}
        <div className="p-5 border-b border-[var(--ll-border)] flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ background: "linear-gradient(135deg, #7612fa, #c109af, #ff6221)" }}
          >
            S
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-white">SME Studio</h1>
            <span className="text-[11px] text-[var(--ll-text-muted)]">Interview Engine</span>
          </div>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto p-2">
          {topic && (
            <>
              <div className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-[1.5px] text-[var(--ll-text-muted)] font-bold">
                Active
              </div>
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[rgba(118,18,250,0.12)]">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                  style={{ background: "linear-gradient(135deg, #7612fa, #ff6221)" }}
                >
                  🎤
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-white truncate">{topic}</div>
                  <div className="text-[11px] text-[var(--ll-text-muted)]">
                    {completedCount}/20 complete
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sidebar footer */}
        <div className="p-4 border-t border-[var(--ll-border)]">
          <button
            onClick={() => {
              if (completedCount > 0 && !confirm("Start a new interview? Current progress will be lost.")) return;
              setAppState("topic-entry");
              setTopic("");
              setMessages([]);
              setCompletedAnswers([]);
              setTweakedQuestions([]);
              setCurrentQuestion(0);
              setCurrentWordsmith("");
              setCurrentSoundbite("");
            }}
            className="w-full py-2.5 rounded-lg bg-[rgba(255,255,255,0.05)] border border-[var(--ll-border)] text-[var(--ll-text-secondary)] text-[13px] font-semibold cursor-pointer hover:bg-[rgba(255,255,255,0.08)] transition-colors"
          >
            + New Interview
          </button>
        </div>
      </aside>

      {/* ===== MAIN CHAT AREA ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="px-4 lg:px-5 py-3 bg-[var(--ll-surface)] border-b border-[var(--ll-border)] flex items-center gap-3 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-9 h-9 rounded-lg bg-[rgba(255,255,255,0.06)] border-none text-[var(--ll-text-secondary)] text-lg cursor-pointer flex items-center justify-center"
          >
            ☰
          </button>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
            style={{ background: "linear-gradient(135deg, #7612fa, #c109af, #ff6221)" }}
          >
            🎤
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold truncate">
              {topic || "SME Interview Studio"}
            </h3>
            <span className="text-[11px] text-[var(--ll-text-muted)]">
              {appState === "topic-entry"
                ? "Enter a topic to begin"
                : appState === "loading-questions"
                ? "Preparing your questions..."
                : appState === "complete"
                ? "Interview complete!"
                : `Question ${currentQuestion + 1} of 20`}
            </span>
          </div>
          {completedCount > 0 && (
            <button
              onClick={exportCSV}
              className="px-3 py-1.5 rounded-lg text-[12px] font-bold cursor-pointer border-none transition-colors"
              style={{
                background: "rgba(16, 185, 129, 0.12)",
                color: "var(--ll-green)",
                border: "1px solid rgba(16, 185, 129, 0.2)",
              }}
            >
              📥 CSV
            </button>
          )}
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-5 bg-[var(--ll-dark)] flex flex-col gap-2">
          {/* Welcome message when no topic yet */}
          {appState === "topic-entry" && messages.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <div
                  className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center text-3xl"
                  style={{ background: "linear-gradient(135deg, #7612fa, #c109af, #ff6221)" }}
                >
                  🎤
                </div>
                <h2 className="text-2xl font-bold mb-2 text-white">SME Interview Studio</h2>
                <p className="text-[var(--ll-text-secondary)] text-sm leading-relaxed mb-6">
                  20 strategic questions to extract your unique positioning, point of view, and
                  differentiators. Enter a topic below to begin.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {["Growth-Driven Design", "Revenue Operations", "Managed IT Security", "Cloud Migration"].map(
                    (t) => (
                      <button
                        key={t}
                        onClick={() => {
                          setTopic(t);
                          // Auto-submit after setting topic
                          setTimeout(() => {
                            setTopic(t);
                          }, 0);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                        style={{
                          background: "rgba(118, 18, 250, 0.1)",
                          color: "#a78bfa",
                          border: "1px solid rgba(118, 18, 250, 0.2)",
                        }}
                      >
                        {t}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => {
            if (msg.type === "block-divider") {
              return (
                <div
                  key={msg.id}
                  className="self-center text-[11px] text-[var(--ll-text-muted)] bg-[rgba(255,255,255,0.04)] px-4 py-1.5 rounded-full my-3"
                >
                  {msg.content}
                </div>
              );
            }

            if (msg.type === "system") {
              return (
                <div
                  key={msg.id}
                  className="self-center text-[12px] text-[var(--ll-text-muted)] italic my-1"
                >
                  {msg.content}
                </div>
              );
            }

            if (msg.type === "user") {
              return (
                <div key={msg.id} className="flex gap-2.5 max-w-[88%] lg:max-w-[75%] self-end flex-row-reverse animate-[fadeUp_0.25s_ease]">
                  <div className="w-8 h-8 rounded-full bg-[var(--ll-surface-light)] flex items-center justify-center text-[11px] text-[var(--ll-text-muted)] shrink-0 font-semibold mt-0.5">
                    You
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[12px] font-bold text-[var(--ll-text-secondary)] text-right">
                      You
                    </div>
                    <div
                      className="px-4 py-3 rounded-2xl rounded-br-sm text-sm leading-relaxed"
                      style={{ background: "linear-gradient(135deg, #7612fa, #c109af)" }}
                    >
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            }

            if (msg.type === "bot") {
              return (
                <div key={msg.id} className="flex gap-2.5 max-w-[88%] lg:max-w-[75%] self-start animate-[fadeUp_0.25s_ease]">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5"
                    style={{ background: "linear-gradient(135deg, #7612fa, #ff6221)" }}
                  >
                    🎤
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[12px] font-bold" style={{ color: "#a78bfa" }}>
                      Interviewer
                    </div>
                    <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-[var(--ll-surface)] text-sm leading-relaxed border border-[var(--ll-border)]">
                      {msg.label && (
                        <div
                          className="inline-block text-[10px] uppercase tracking-[1px] font-bold mb-1.5 px-2 py-0.5 rounded"
                          style={{ background: "rgba(118, 18, 250, 0.15)", color: "#a78bfa" }}
                        >
                          {msg.label}
                        </div>
                      )}
                      <div className="font-semibold">{msg.content}</div>
                      {msg.focus && (
                        <div className="text-[12px] text-[var(--ll-text-muted)] mt-2 italic">
                          {msg.focus}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            if (msg.type === "wordsmith") {
              const isLatest =
                msg === [...messages].reverse().find((m) => m.type === "wordsmith");

              return (
                <div key={msg.id} className="flex gap-2.5 max-w-[88%] lg:max-w-[80%] self-start animate-[fadeUp_0.25s_ease]">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5"
                    style={{ background: "linear-gradient(135deg, #7612fa, #ff6221)" }}
                  >
                    ✨
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[12px] font-bold" style={{ color: "#a78bfa" }}>
                      Wordsmithed Answer
                    </div>
                    <div
                      className="px-4 py-3 rounded-2xl rounded-bl-sm text-sm leading-relaxed border"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(118,18,250,0.08), rgba(193,9,175,0.08))",
                        borderColor: "rgba(118, 18, 250, 0.2)",
                      }}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>

                      {isLatest && questionState === "reviewing" && (
                        <div className="flex gap-2 mt-4 flex-wrap">
                          <button
                            onClick={handleApprove}
                            className="px-4 py-2 rounded-lg text-[13px] font-semibold cursor-pointer border-none transition-all hover:brightness-110"
                            style={{ background: "var(--ll-green)", color: "#fff" }}
                          >
                            ✅ It&apos;s Great!
                          </button>
                          <button
                            onClick={() => textareaRef.current?.focus()}
                            className="px-4 py-2 rounded-lg text-[13px] font-semibold cursor-pointer transition-colors"
                            style={{
                              background: "rgba(255,255,255,0.08)",
                              color: "var(--ll-text-secondary)",
                              border: "1px solid rgba(255,255,255,0.1)",
                            }}
                          >
                            ✏️ Refine
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            return null;
          })}

          {/* Loading dots */}
          {(questionState === "wordsmithing" || questionState === "refining" || appState === "loading-questions") && (
            <div className="flex gap-2.5 self-start animate-[fadeUp_0.25s_ease]">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                style={{ background: "linear-gradient(135deg, #7612fa, #ff6221)" }}
              >
                ✨
              </div>
              <div className="px-4 py-3 rounded-2xl bg-[var(--ll-surface)] border border-[var(--ll-border)]">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[var(--ll-text-muted)] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-[var(--ll-text-muted)] animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-[var(--ll-text-muted)] animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div className="px-4 lg:px-5 py-3 bg-[var(--ll-surface)] border-t border-[var(--ll-border)] shrink-0">
          {appState === "complete" ? (
            <div className="flex gap-3">
              <button
                onClick={exportCSV}
                className="flex-1 py-3 rounded-xl text-[15px] font-bold cursor-pointer border-none text-white transition-all hover:brightness-110"
                style={{ background: "linear-gradient(135deg, #7612fa, #c109af, #ff6221)" }}
              >
                📥 Download CSV
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2 items-end">
                <div
                  className="flex-1 flex items-center gap-2 rounded-xl px-3.5 py-2.5 border transition-colors"
                  style={{
                    background: "var(--ll-surface-light)",
                    borderColor: "var(--ll-border)",
                  }}
                >
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={appState === "topic-entry" ? topic : inputValue}
                    onChange={(e) =>
                      appState === "topic-entry"
                        ? setTopic(e.target.value)
                        : setInputValue(e.target.value)
                    }
                    onKeyDown={handleKeyDown}
                    placeholder={getPlaceholder()}
                    disabled={isInputDisabled}
                    className="flex-1 bg-transparent border-none text-[var(--ll-text)] text-sm resize-none outline-none leading-relaxed placeholder:text-[var(--ll-text-muted)] disabled:opacity-50 font-[inherit]"
                    style={{ maxHeight: "120px" }}
                  />
                </div>
                {appState !== "topic-entry" && (
                  <button
                    onClick={toggleRecording}
                    disabled={isInputDisabled}
                    className={`w-[42px] h-[42px] rounded-xl border-none text-white text-lg cursor-pointer shrink-0 flex items-center justify-center transition-all disabled:opacity-50 ${
                      isRecording ? "animate-pulse" : ""
                    }`}
                    style={{
                      background: isRecording
                        ? "#ef4444"
                        : "linear-gradient(135deg, #7612fa, #c109af)",
                      boxShadow: isRecording
                        ? "0 0 20px rgba(239,68,68,0.4)"
                        : "0 2px 10px rgba(118,18,250,0.3)",
                    }}
                  >
                    {isRecording ? "⏹" : "🎙"}
                  </button>
                )}
                <button
                  onClick={handleSend}
                  disabled={isInputDisabled || (appState === "topic-entry" ? !topic.trim() : !inputValue.trim())}
                  className="w-[42px] h-[42px] rounded-xl border-none text-white text-lg cursor-pointer shrink-0 flex items-center justify-center transition-all disabled:opacity-30"
                  style={{ background: "linear-gradient(135deg, #7612fa, #ff6221)" }}
                >
                  ➤
                </button>
              </div>
              <div className="text-[11px] text-[var(--ll-text-muted)] mt-1.5 pl-1 hidden lg:block">
                Press Enter to send · Shift+Enter for new line
                {questionState === "reviewing" && " · Type feedback to refine, or click approve"}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ===== RIGHT PANEL (Desktop only) ===== */}
      <aside className="hidden xl:flex w-[260px] flex-col bg-[var(--ll-darker)] border-l border-[var(--ll-border)] shrink-0">
        <div className="p-4 border-b border-[var(--ll-border)]">
          <h3 className="text-[13px] font-bold mb-3">Interview Progress</h3>
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-[13px] font-extrabold"
              style={{
                border: "3px solid rgba(255,255,255,0.06)",
                borderTopColor: "#7612fa",
                borderRightColor: completedCount > 5 ? "#7612fa" : "rgba(255,255,255,0.06)",
                borderBottomColor: completedCount > 10 ? "#c109af" : "rgba(255,255,255,0.06)",
                borderLeftColor: completedCount > 15 ? "#ff6221" : "rgba(255,255,255,0.06)",
                color: "#a78bfa",
              }}
            >
              {completedCount}
            </div>
            <div>
              <div className="text-[13px] font-semibold">of 20 questions</div>
              <div className="text-[11px] text-[var(--ll-text-muted)]">
                {appState === "complete"
                  ? "Complete!"
                  : `~${(20 - completedCount) * 2} min remaining`}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {BLOCKS.map((block, blockIdx) => (
            <div key={block}>
              <div className="px-2 pt-3 pb-1 text-[10px] uppercase tracking-[1px] text-[var(--ll-text-muted)] font-bold">
                {block}
              </div>
              {QUESTIONS.filter((q) => q.blockNumber === blockIdx + 1).map((q) => {
                const isDone = completedCount >= q.number;
                const isActive = currentQuestion === q.number - 1 && appState === "interviewing";
                const tweaked = tweakedQuestions[q.number - 1];

                return (
                  <div
                    key={q.number}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-[12px] cursor-default transition-colors ${
                      isDone
                        ? "text-[var(--ll-green)]"
                        : isActive
                        ? "text-white font-semibold"
                        : "text-[var(--ll-text-muted)]"
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        background: isDone
                          ? "var(--ll-green)"
                          : isActive
                          ? "#7612fa"
                          : "rgba(255,255,255,0.1)",
                        boxShadow: isActive ? "0 0 6px #7612fa" : "none",
                      }}
                    />
                    <span className="truncate">
                      {q.number}.{" "}
                      {tweaked
                        ? tweaked.question.slice(0, 35) + (tweaked.question.length > 35 ? "..." : "")
                        : q.template.slice(0, 35) + "..."}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-[var(--ll-border)]">
          <button
            onClick={exportCSV}
            disabled={completedCount === 0}
            className="w-full py-2.5 rounded-lg text-[12px] font-bold cursor-pointer uppercase tracking-[1px] transition-colors disabled:opacity-30 border"
            style={{
              background: "rgba(16, 185, 129, 0.12)",
              color: "var(--ll-green)",
              borderColor: "rgba(16, 185, 129, 0.2)",
            }}
          >
            📥 Export CSV
          </button>
        </div>
      </aside>

      {/* fadeUp animation */}
      <style jsx global>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
