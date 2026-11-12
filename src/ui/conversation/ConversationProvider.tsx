"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AssistantError,
  type AssistantImage,
  type AssistantReply,
  type PermissionName,
  type QuickActionId,
  type RequestSource,
  type VoiceInputSession,
} from "@/contracts";
import { useServices } from "@/integration/ServicesProvider";
import { useAnnounce } from "../a11y/LiveAnnouncer";
import { buzz } from "../a11y/haptics";
import { useSettings } from "../settings/SettingsProvider";
import {
  ASSISTANT_ERRORS,
  CANCELLED,
  MIC_EXPLAINER,
  SPEECH_FAILED,
  VOICE_ERRORS,
  VOICE_UNSUPPORTED,
} from "./copy";
import { preparePhoto } from "./photo";
import { clearSavedConversations, loadConversations, saveConversations } from "./history-storage";
import { INITIAL_ID, activeConversation, initState, reducer } from "./reducer";
import {
  QUICK_ACTIONS,
  newId,
  type ActionCard,
  type ChatMessage,
  type Conversation,
  type Phase,
} from "./types";

/** What a photo says when the person doesn't add their own question. */
export const PHOTO_DEFAULT_QUESTION = "Can you look at this photo and help me with it?";

/** How long to wait for the assistant before giving up. */
export const REQUEST_TIMEOUT_MS = 45_000;
/** How many earlier turns are sent to the assistant for context. */
export const HISTORY_TURNS = 12;

export interface ConversationApi {
  phase: Phase;
  interim: string;
  level: number;
  /** Reply text arriving so far, if the assistant streams it. */
  partial: string;
  speakingId: string | null;
  /** null until the device has been asked. */
  voiceInputSupported: boolean | null;
  voiceOutputSupported: boolean;
  messages: ChatMessage[];
  /** Every conversation that has something in it, newest first. */
  history: Conversation[];
  activeId: string;

  /** The microphone button: does the obvious next thing for the current phase. */
  pressMic: () => void;
  sendText: (text: string) => void;
  sendQuickAction: (id: QuickActionId) => void;
  /** "Show me": send a photo from the camera or Photos, with an optional question. */
  sendPhoto: (file: Blob, question?: string) => void;
  cancel: () => void;
  readAloud: (messageId: string) => void;
  /** Read Companion's latest reply aloud again, stopping anything being spoken now. */
  repeatLast: () => void;
  stopSpeaking: () => void;
  runAction: (messageId: string, actionId: string) => void;
  dismissAction: (messageId: string, actionId: string) => void;
  allowPermission: (name: PermissionName, messageId: string, actionId?: string) => void;
  retry: (messageId: string) => void;
  dismissMessage: (messageId: string) => void;
  /** Stop listening, speaking and waiting. Used when leaving the screen. */
  interrupt: () => void;

  newConversation: () => void;
  openConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  /** Erase every saved conversation, here and on the device. */
  eraseHistory: () => void;
}

const ConversationContext = createContext<ConversationApi | null>(null);

function languageTag(): string {
  return (typeof navigator !== "undefined" && navigator.language) || "en-US";
}

export function ConversationProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const services = useServices();
  const announce = useAnnounce();

  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const [voiceInputSupported, setVoiceInputSupported] = useState<boolean | null>(null);
  const [voiceOutputSupported, setVoiceOutputSupported] = useState(false);

  // Latest values for use inside long-running async work, without re-creating callbacks.
  const settingsRef = useRef(settings);
  const stateRef = useRef(state);
  const servicesRef = useRef(services);
  const announceRef = useRef(announce);
  useEffect(() => {
    settingsRef.current = settings;
    stateRef.current = state;
    servicesRef.current = services;
    announceRef.current = announce;
  });

  const requestAbort = useRef<AbortController | null>(null);
  const listenId = useRef(0);
  const session = useRef<VoiceInputSession | null>(null);
  const speechToken = useRef(0);

  // What can this device do? Asked after mount so server and client markup match.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading device capabilities after mount
    setVoiceInputSupported(services.voiceInput.isSupported());
    setVoiceOutputSupported(services.voiceOutput.isSupported());
  }, [services]);

  // Bring back saved conversations once.
  useEffect(() => {
    dispatch({ type: "hydrate", saved: loadConversations() });
  }, []);

  // Save after changes, only if the person allows it.
  useEffect(() => {
    if (!state.hydrated) return;
    if (settings.saveHistory) saveConversations(state.conversations);
  }, [state.conversations, state.hydrated, settings.saveHistory]);

  const say = useCallback((text: string, urgent = false) => {
    announceRef.current(text, urgent ? "assertive" : "polite");
  }, []);

  const addNotice = useCallback((text: string, extra: Partial<ChatMessage> = {}) => {
    dispatch({
      type: "add",
      message: { id: newId(), role: "notice", text, createdAt: Date.now(), ...extra },
    });
    say(text, true);
  }, [say]);

  // ---------- speaking ----------

  const cancelSpeech = useCallback(() => {
    speechToken.current += 1;
    servicesRef.current.voiceOutput.cancel();
    dispatch({ type: "speaking", id: null });
    if (stateRef.current.phase === "speaking") dispatch({ type: "phase", phase: "idle" });
  }, []);

  const speak = useCallback(
    async (messageId: string, text: string) => {
      const s = settingsRef.current;
      const out = servicesRef.current.voiceOutput;
      if (!out.isSupported() || !text.trim()) {
        if (stateRef.current.phase === "thinking") dispatch({ type: "phase", phase: "idle" });
        return;
      }
      const token = ++speechToken.current;
      dispatch({ type: "speaking", id: messageId });
      dispatch({ type: "phase", phase: "speaking" });
      try {
        await out.speak(text, {
          rate: s.speechRate,
          volume: s.volume,
          voiceId: s.voiceId,
          language: languageTag(),
        });
      } catch {
        if (token === speechToken.current) addNotice(SPEECH_FAILED);
      } finally {
        if (token === speechToken.current) {
          dispatch({ type: "speaking", id: null });
          dispatch({ type: "phase", phase: "idle" });
        }
      }
    },
    [addNotice],
  );

  // ---------- actions ----------

  const runAction = useCallback(
    async (messageId: string, actionId: string, known?: ActionCard) => {
      // `known` is passed when the reply was added in this same tick and is not in state yet.
      const message = activeConversation(stateRef.current).messages.find((m) => m.id === messageId);
      const card = message?.actions?.find((c) => c.action.id === actionId) ?? known;
      if (!card || (card.status !== "proposed" && card.status !== "failed")) return;

      dispatch({ type: "card", messageId, actionId, patch: { status: "running", resultMessage: undefined, needsPermission: undefined } });
      say("Working on it.");
      const result = await servicesRef.current.actions.execute(card.action);

      if (result.ok) {
        dispatch({ type: "card", messageId, actionId, patch: { status: "done", resultMessage: result.message } });
        say(result.message);
        buzz(settingsRef.current.haptics, [30, 40, 30]);
        if (settingsRef.current.speakReplies) void speak(messageId, result.message);
      } else {
        dispatch({
          type: "card",
          messageId,
          actionId,
          patch: { status: "failed", resultMessage: result.message, needsPermission: result.needsPermission },
        });
        say(result.message, true);
      }
    },
    [say, speak],
  );

  const dismissAction = useCallback((messageId: string, actionId: string) => {
    dispatch({ type: "card", messageId, actionId, patch: { status: "dismissed" } });
    say("Okay, I won't do that.");
  }, [say]);

  // ---------- asking the assistant ----------

  const submit = useCallback(
    async (text: string, source: RequestSource, quickActionId?: QuickActionId, photo?: { image: AssistantImage; thumb: string }) => {
      const clean = text.trim();
      if (!clean || stateRef.current.phase === "thinking") return;

      cancelSpeech();
      const conversation = activeConversation(stateRef.current);
      const history = conversation.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-HISTORY_TURNS)
        .map((m) => ({ role: m.role as "user" | "assistant", text: m.text }));

      // The first message in a blank conversation gives it a real id and start time.
      if (stateRef.current.activeId === INITIAL_ID) dispatch({ type: "claim", id: newId(), now: Date.now() });
      dispatch({
        type: "add",
        message: { id: newId(), role: "user", text: clean, createdAt: Date.now(), source, ...(photo ? { image: photo.thumb } : {}) },
      });
      dispatch({ type: "phase", phase: "thinking" });
      dispatch({ type: "partial", text: "" });
      say("Thinking.");

      const controller = new AbortController();
      requestAbort.current = controller;
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, REQUEST_TIMEOUT_MS);

      try {
        const s = settingsRef.current;
        const svc = servicesRef.current;
        const willSpeak = s.speakReplies && svc.voiceOutput.isSupported();
        const reply: AssistantReply = await svc.assistant.send(
          {
            text: clean,
            source,
            quickActionId,
            ...(photo ? { image: photo.image } : {}),
            history,
            language: languageTag(),
            hints: { plainLanguage: true, willBeSpoken: willSpeak },
          },
          {
            signal: controller.signal,
            onPartialText: (t) => {
              if (!controller.signal.aborted) dispatch({ type: "partial", text: t });
            },
          },
        );
        if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");

        const messageId = reply.id || newId();
        const cards: ActionCard[] = (reply.proposedActions ?? []).map((action) => ({
          action,
          status: svc.actions.supports(action.kind) ? "proposed" : "unsupported",
        }));
        dispatch({
          type: "add",
          message: {
            id: messageId,
            role: "assistant",
            text: reply.text,
            spokenText: reply.spokenText,
            actions: cards,
            suggestions: reply.suggestions?.slice(0, 3),
            createdAt: Date.now(),
          },
        });
        dispatch({ type: "partial", text: "" });
        say(reply.text);
        buzz(s.haptics, 15);

        // Low-risk actions may run without asking, only if the person turned asking off.
        if (!s.confirmActions) {
          for (const card of cards) {
            if (card.status === "proposed" && card.action.risk === "low") void runAction(messageId, card.action.id, card);
          }
        }

        if (willSpeak) await speak(messageId, reply.spokenText ?? reply.text);
        else dispatch({ type: "phase", phase: "idle" });
      } catch (err) {
        dispatch({ type: "partial", text: "" });
        if (controller.signal.aborted && !timedOut) {
          dispatch({ type: "phase", phase: "idle" });
          say(CANCELLED);
          return;
        }
        const code = timedOut ? "timeout" : err instanceof AssistantError ? err.code : "unknown";
        const message = ASSISTANT_ERRORS[code];
        dispatch({
          type: "add",
          message: {
            id: newId(),
            role: "error",
            text: message,
            createdAt: Date.now(),
            retry: { text: clean, source, quickActionId, ...(photo ? { image: photo.image, thumb: photo.thumb } : {}) },
          },
        });
        dispatch({ type: "phase", phase: "idle" });
        say(message, true);
      } finally {
        clearTimeout(timer);
        if (requestAbort.current === controller) requestAbort.current = null;
      }
    },
    [cancelSpeech, runAction, say, speak],
  );

  // ---------- listening ----------

  const endListening = useCallback(() => {
    listenId.current += 1; // ignore any late callbacks from the old session
    session.current?.abort();
    session.current = null;
    dispatch({ type: "interim", text: "" });
    dispatch({ type: "level", level: 0 });
  }, []);

  const startListening = useCallback(() => {
    const svc = servicesRef.current;
    const id = ++listenId.current;
    let finalText = "";
    let failure: keyof typeof VOICE_ERRORS | null = null;

    dispatch({ type: "phase", phase: "listening" });
    dispatch({ type: "interim", text: "" });
    buzz(settingsRef.current.haptics, 20);
    say("Listening.");

    try {
      session.current = svc.voiceInput.start(
        {
          onInterim: (t) => id === listenId.current && dispatch({ type: "interim", text: t }),
          onLevel: (l) => id === listenId.current && dispatch({ type: "level", level: l }),
          onFinal: (t) => {
            if (id === listenId.current) finalText = t;
          },
          onError: (e) => {
            if (id === listenId.current) failure = e.code;
          },
          onEnd: () => {
            if (id !== listenId.current) return;
            session.current = null;
            dispatch({ type: "interim", text: "" });
            dispatch({ type: "level", level: 0 });
            dispatch({ type: "phase", phase: "idle" });
            buzz(settingsRef.current.haptics, 10);
            if (finalText.trim()) void submit(finalText, "voice");
            else addNotice(VOICE_ERRORS[failure ?? "no-speech"]);
          },
        },
        { language: languageTag() },
      );
    } catch {
      session.current = null;
      dispatch({ type: "phase", phase: "idle" });
      addNotice(VOICE_ERRORS.unknown);
    }
  }, [addNotice, say, submit]);

  const pressMic = useCallback(() => {
    const phase = stateRef.current.phase;
    if (phase === "listening") {
      session.current?.stop(); // delivers what was heard, then onEnd
      return;
    }
    if (phase === "thinking") {
      requestAbort.current?.abort();
      return;
    }
    if (phase === "speaking") {
      cancelSpeech();
      return;
    }

    const svc = servicesRef.current;
    if (!svc.voiceInput.isSupported()) {
      addNotice(VOICE_UNSUPPORTED);
      return;
    }
    void (async () => {
      let permission: Awaited<ReturnType<typeof svc.permissions.check>> = "unsupported";
      try {
        permission = await svc.permissions.check("microphone");
      } catch {
        /* treat as unknown and let the voice service ask */
      }
      if (permission === "denied") {
        addNotice(VOICE_ERRORS["permission-denied"]);
      } else if (permission === "prompt") {
        // Explain first, ask only when the person agrees. Never a surprise pop-up.
        addNotice(MIC_EXPLAINER, { permission: "microphone" });
      } else {
        startListening();
      }
    })();
  }, [addNotice, cancelSpeech, startListening]);

  const allowPermission = useCallback(
    (name: PermissionName, messageId: string, actionId?: string) => {
      void (async () => {
        const result = await servicesRef.current.permissions.request(name);
        if (result === "granted") {
          dispatch({ type: "remove", id: messageId });
          if (actionId) void runAction(messageId, actionId);
          else if (name === "microphone") startListening();
        } else if (result === "denied") {
          dispatch({ type: "remove", id: messageId });
          addNotice(name === "microphone" ? VOICE_ERRORS["permission-denied"] : "That permission is turned off. You can turn it on in your phone's Settings.");
        } else {
          addNotice("That isn't available on this device.");
        }
      })();
    },
    [addNotice, runAction, startListening],
  );

  // ---------- the rest of the public API ----------

  const interrupt = useCallback(() => {
    endListening();
    requestAbort.current?.abort();
    cancelSpeech();
    if (stateRef.current.phase !== "idle") dispatch({ type: "phase", phase: "idle" });
  }, [cancelSpeech, endListening]);

  // Never leave the microphone open or the speaker talking if this unmounts.
  useEffect(
    () => () => {
      listenId.current += 1;
      session.current?.abort();
      requestAbort.current?.abort();
      servicesRef.current.voiceOutput.cancel();
    },
    [],
  );

  const retry = useCallback(
    (messageId: string) => {
      const message = activeConversation(stateRef.current).messages.find((m) => m.id === messageId);
      if (!message?.retry) return;
      const { text, source, quickActionId, image, thumb } = message.retry;
      dispatch({ type: "remove", id: messageId });
      void submit(text, source, quickActionId, image && thumb ? { image, thumb } : undefined);
    },
    [submit],
  );

  const sendPhoto = useCallback(
    (file: Blob, question?: string) => {
      void (async () => {
        let photo;
        try {
          photo = await preparePhoto(file);
        } catch {
          addNotice("I couldn't open that photo. Please try taking it again.");
          return;
        }
        const q = question?.trim();
        void submit(q ? q : PHOTO_DEFAULT_QUESTION, "photo", undefined, photo);
      })();
    },
    [addNotice, submit],
  );

  const sendQuickAction = useCallback(
    (id: QuickActionId) => {
      const qa = QUICK_ACTIONS.find((q) => q.id === id);
      if (qa) void submit(qa.sentence, "quick-action", id);
    },
    [submit],
  );

  const readAloud = useCallback(
    (messageId: string) => {
      const m = activeConversation(stateRef.current).messages.find((x) => x.id === messageId);
      if (m) void speak(messageId, m.spokenText ?? m.text);
    },
    [speak],
  );

  const repeatLast = useCallback(() => {
    const last = [...activeConversation(stateRef.current).messages].reverse().find((m) => m.role === "assistant");
    if (!last) return;
    servicesRef.current.voiceOutput.cancel();
    readAloud(last.id);
  }, [readAloud]);

  const eraseHistory = useCallback(() => {
    clearSavedConversations();
    dispatch({ type: "clear" });
    say("Your saved conversations have been erased.");
  }, [say]);

  const value = useMemo<ConversationApi>(() => {
    const active = activeConversation(state);
    return {
      phase: state.phase,
      interim: state.interim,
      level: state.level,
      partial: state.partial,
      speakingId: state.speakingId,
      voiceInputSupported,
      voiceOutputSupported,
      messages: active.messages,
      history: state.conversations
        .filter((c) => c.messages.some((m) => m.role === "user" || m.role === "assistant"))
        .sort((a, b) => b.updatedAt - a.updatedAt),
      activeId: state.activeId,

      pressMic,
      sendText: (text) => void submit(text, "text"),
      sendQuickAction,
      sendPhoto,
      cancel: () => requestAbort.current?.abort(),
      readAloud,
      repeatLast,
      stopSpeaking: cancelSpeech,
      runAction: (m, a) => void runAction(m, a),
      dismissAction,
      allowPermission,
      retry,
      dismissMessage: (id) => dispatch({ type: "remove", id }),
      interrupt,

      newConversation: () => {
        interrupt();
        dispatch({ type: "new" });
      },
      openConversation: (id) => {
        interrupt();
        dispatch({ type: "open", id });
      },
      deleteConversation: (id) => dispatch({ type: "delete", id }),
      eraseHistory,
    };
  }, [
    state,
    voiceInputSupported,
    voiceOutputSupported,
    pressMic,
    submit,
    sendQuickAction,
    sendPhoto,
    readAloud,
    repeatLast,
    cancelSpeech,
    runAction,
    dismissAction,
    allowPermission,
    retry,
    interrupt,
    eraseHistory,
  ]);

  return <ConversationContext.Provider value={value}>{children}</ConversationContext.Provider>;
}

export function useConversation(): ConversationApi {
  const ctx = useContext(ConversationContext);
  if (!ctx) throw new Error("useConversation must be used inside <ConversationProvider>");
  return ctx;
}
