"use client";

import { FormEvent, KeyboardEvent, useRef, useState } from "react";
import styles from "./qa.module.css";
import { BrandHomeLink } from "../components/BrandHomeLink";

const QA_API_URL = process.env.NEXT_PUBLIC_MSV_QA_API_URL ?? "/api/qa";
const MAX_QUESTION_CHARS = 600;

const suggestedQuestions = [
  "这门课适合多大的孩子？",
  "一次 90 分钟课堂怎么进行？",
  "孩子最终会完成什么作品？",
  "PDMO 四类导师怎样支持孩子？",
  "课程里怎么使用 AI？",
  "如何保护未成年学员的隐私？",
] as const;

type Source = {
  id: string;
  number: number;
  category: string;
  title: string;
  label: string;
  section: string;
  url?: string;
};

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  model?: string;
  knowledgeGap?: boolean;
  knowledgeGapRecorded?: boolean;
};

type QaApiResponse =
  | {
    ok: true;
    data: {
      answer: string;
      sources: Source[];
      model: string;
      knowledgeGap: boolean;
      knowledgeGapRecorded: boolean;
    };
  }
  | { ok: false; error: { code: string; message: string } };

const initialMessage: ChatMessage = {
  id: 1,
  role: "assistant",
  content:
    "您好，我是 Mini Silicon Valley 家长问答助手。\n\n您可以问我课程适龄、五步流程、学习产出、四类导师分工、AI 使用和隐私安全。我只会根据已确认的课程资料回答；未覆盖的问题会进入待补充清单，由课程 DM 或导师核实后再入库。",
};

export function QaClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [question, setQuestion] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(2);
  const conversationEnd = useRef<HTMLDivElement | null>(null);

  async function sendQuestion(rawQuestion: string) {
    const trimmed = rawQuestion.trim();
    if (!trimmed || isSending) return;

    const userMessage: ChatMessage = { id: nextId.current++, role: "user", content: trimmed };
    const priorMessages = messages
      .filter((message) => message.id !== initialMessage.id)
      .slice(-6)
      .map(({ role, content }) => ({ role, content }));

    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setError(null);
    setIsSending(true);
    requestAnimationFrame(() => conversationEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" }));

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 58_000);
    try {
      const response = await fetch(QA_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, history: priorMessages }),
        signal: controller.signal,
      });
      const payload = await response.json() as QaApiResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "问答服务暂时不可用。" : payload.error.message);
      }
      setMessages((current) => [...current, {
        id: nextId.current++,
        role: "assistant",
        content: payload.data.answer,
        sources: payload.data.sources,
        model: payload.data.model,
        knowledgeGap: payload.data.knowledgeGap,
        knowledgeGapRecorded: payload.data.knowledgeGapRecorded,
      }]);
    } catch (caught) {
      const message = caught instanceof DOMException && caught.name === "AbortError"
        ? "这次回答等待超时了，请稍后再试。"
        : caught instanceof Error
          ? caught.message
          : "问答服务暂时不可用，请稍后再试。";
      setError(message);
    } finally {
      window.clearTimeout(timeout);
      setIsSending(false);
      requestAnimationFrame(() => conversationEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendQuestion(question);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void sendQuestion(question);
    }
  }

  return (
    <main className={styles.page}>
      <a className={styles.skipLink} href="#qa-composer">跳到提问框</a>

      <header className={styles.topbar}>
        <BrandHomeLink className={styles.brand} subtitle="PARENT DESK · 家长服务台" />
        <div className={styles.onlineBadge}><span aria-hidden="true" />知识库在线</div>
      </header>

      <section className={styles.hero} aria-labelledby="qa-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>COURSE INTELLIGENCE · 课程答疑</p>
          <h1 id="qa-title">关于孩子在<br /><em>Mini Silicon Valley</em><br />如何学习，您可以直接问。</h1>
          <p className={styles.heroLead}>
            回答以课程大纲、导师手册与安全规则为依据，由 DeepSeek 组织成更易理解的家长答复。
          </p>
          <div className={styles.heroLinks}>
            <a href="/framework/">查看课程结构 <span aria-hidden="true">↗</span></a>
            <a href={process.env.NEXT_PUBLIC_MSV_WORLD_URL ?? "/world/"}>探索历史世界 <span aria-hidden="true">↗</span></a>
            <a href={process.env.NEXT_PUBLIC_MSV_CLASSROOM_URL ?? "/classroom/"}>进入协作课堂 <span aria-hidden="true">↗</span></a>
          </div>
        </div>

        <aside className={styles.promiseCard} aria-label="回答承诺">
          <span className={styles.cardNumber}>01 / EVIDENCE</span>
          <h2>有据可查，<br />不猜测。</h2>
          <ul>
            <li><span>01</span>只用已确认的课程资料</li>
            <li><span>02</span>回答后列出依据来源</li>
            <li><span>03</span>未确认的信息明确说明</li>
          </ul>
        </aside>
      </section>

      <section className={styles.workspace} aria-label="家长问答工作台">
        <aside className={styles.suggestions}>
          <div className={styles.sectionLabel}><span>QUICK ASK</span><b>想问什么？</b></div>
          <div className={styles.suggestionGrid}>
            {suggestedQuestions.map((suggestion, index) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => void sendQuestion(suggestion)}
                disabled={isSending}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                {suggestion}
                <b aria-hidden="true">↗</b>
              </button>
            ))}
          </div>
          <div className={styles.privacyNote}>
            <span aria-hidden="true">!</span>
            <p><strong>请勿输入孩子的真实姓名、电话、学校或住址。</strong>问答只需要课程相关问题。</p>
          </div>
        </aside>

        <section className={styles.chatPanel} aria-label="对话">
          <div className={styles.chatHeader}>
            <div>
              <span className={styles.avatar} aria-hidden="true">MSV</span>
              <p><strong>家长问答助手</strong><small>基于课程知识库</small></p>
            </div>
            <span className={styles.secureLabel}>服务端安全调用</span>
          </div>

          <div className={styles.conversation} aria-live="polite" aria-busy={isSending}>
            {messages.map((message) => (
              <article key={message.id} className={`${styles.message} ${styles[message.role]}`}>
                <span className={styles.messageRole}>{message.role === "assistant" ? "MSV" : "您"}</span>
                <div className={styles.messageBody}>
                  <p>{message.content}</p>
                  {message.knowledgeGap ? (
                    <div className={styles.gapNotice}>
                      <strong>{message.knowledgeGapRecorded ? "已加入待补充清单" : "知识库暂未覆盖"}</strong>
                      <span>仅记录问题；需要课程 DM 或导师核实资料后，才会正式入库。</span>
                    </div>
                  ) : null}
                  {message.sources && message.sources.length > 0 ? (
                    <details className={styles.sources}>
                      <summary>查看 {message.sources.length} 条课程依据</summary>
                      <ol>
                        {message.sources.map((source) => (
                          <li key={source.id}>
                            <span>[资料{source.number}]</span>
                            <div>
                              <strong>{source.title}</strong>
                              <small>{source.label} · {source.section}</small>
                            </div>
                            {source.url ? <a href={source.url} aria-label={`查看来源：${source.title}`}>↗</a> : null}
                          </li>
                        ))}
                      </ol>
                    </details>
                  ) : null}
                  {message.model ? <small className={styles.modelNote}>由 DeepSeek 生成 · 请以所列课程依据为准</small> : null}
                </div>
              </article>
            ))}

            {isSending ? (
              <article className={`${styles.message} ${styles.assistant}`}>
                <span className={styles.messageRole}>MSV</span>
                <div className={`${styles.messageBody} ${styles.thinking}`}>
                  <span /><span /><span />
                  <p>正在检索课程资料…</p>
                </div>
              </article>
            ) : null}
            <div ref={conversationEnd} />
          </div>

          <form id="qa-composer" className={styles.composer} onSubmit={submit}>
            <label htmlFor="parent-question">请输入您的问题</label>
            <textarea
              id="parent-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value.slice(0, MAX_QUESTION_CHARS))}
              onKeyDown={handleKeyDown}
              maxLength={MAX_QUESTION_CHARS}
              rows={3}
              placeholder="例如：孩子不擅长当众表达，在这门课里会怎么参与？"
              disabled={isSending}
              aria-describedby="composer-help composer-error"
            />
            <div className={styles.composerFooter}>
              <span id="composer-help">Enter 发送 · Shift + Enter 换行 · {question.length}/{MAX_QUESTION_CHARS}</span>
              <button type="submit" disabled={isSending || !question.trim()}>
                <span>{isSending ? "正在查找" : "发送问题"}</span><b aria-hidden="true">→</b>
              </button>
            </div>
            <p id="composer-error" className={styles.error} role="alert">{error}</p>
          </form>
        </section>
      </section>

      <footer className={styles.footer}>
        <p><strong>MINI SILICON VALLEY</strong><span>真实科技史 × 协作决策 × 现实创业实践</span></p>
        <p>回答不构成招生、价格或录取承诺</p>
      </footer>
    </main>
  );
}
