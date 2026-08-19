import { useCallback, useEffect, useRef, useState } from "react";

import { apiRequest } from "./api.js";
import "./privateStickyAccessibility.css";

const EDGE_MARGIN = 14;
const UNDO_LANE_RESERVE = 104;
const MINIMIZED_WIDTH = 236;
const MINIMIZED_HEIGHT = 38;
const MIN_WIDTH = 300;
const MIN_HEIGHT = 260;
const MOBILE_QUERY = "(max-width: 680px)";

function viewportSize() {
  return {
    width: Math.max(document.documentElement.clientWidth, window.innerWidth || 0),
    height: Math.max(document.documentElement.clientHeight, window.innerHeight || 0),
  };
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function defaultExpandedFrame() {
  const viewport = viewportSize();
  const availableHeight = Math.max(0, viewport.height - UNDO_LANE_RESERVE);
  const width = Math.min(440, viewport.width - EDGE_MARGIN * 2);
  const height = Math.min(460, Math.max(0, availableHeight - EDGE_MARGIN * 2));
  return {
    width,
    height,
    x: Math.max(EDGE_MARGIN, viewport.width - width - EDGE_MARGIN),
    y: Math.max(EDGE_MARGIN, availableHeight - height - EDGE_MARGIN),
  };
}

function bottomRightPosition() {
  const viewport = viewportSize();
  const width = Math.min(MINIMIZED_WIDTH, viewport.width - EDGE_MARGIN * 2);
  return {
    x: Math.max(EDGE_MARGIN, viewport.width - width - EDGE_MARGIN),
    y: Math.max(EDGE_MARGIN, viewport.height - MINIMIZED_HEIGHT - EDGE_MARGIN - UNDO_LANE_RESERVE),
  };
}

function constrainFrame(frame) {
  const viewport = viewportSize();
  const availableHeight = Math.max(0, viewport.height - UNDO_LANE_RESERVE);
  const width = clamp(frame.width, Math.min(MIN_WIDTH, viewport.width), viewport.width);
  const height = clamp(frame.height, Math.min(MIN_HEIGHT, availableHeight), availableHeight);
  return {
    width,
    height,
    x: clamp(frame.x, 0, viewport.width - width),
    y: clamp(frame.y, 0, availableHeight - height),
  };
}

function constrainMinimized(position) {
  const viewport = viewportSize();
  const width = Math.min(MINIMIZED_WIDTH, viewport.width - EDGE_MARGIN * 2);
  const availableHeight = Math.max(0, viewport.height - UNDO_LANE_RESERVE);
  return {
    x: clamp(position.x, 0, viewport.width - width),
    y: clamp(position.y, 0, availableHeight - MINIMIZED_HEIGHT),
  };
}

export default function PrivateSticky({ staffToken }) {
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState("loading");
  const [minimized, setMinimized] = useState(true);
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  const [frame, setFrame] = useState(defaultExpandedFrame);
  const [minimizedPosition, setMinimizedPosition] = useState(bottomRightPosition);
  const latestContent = useRef("");
  const persistedContent = useRef("");
  const saving = useRef(false);
  const active = useRef(true);
  const interaction = useRef(null);
  const textArea = useRef(null);

  useEffect(() => {
    active.current = true;
    let cancelled = false;
    async function load() {
      try {
        const payload = await apiRequest("/api/staff/private-note/", { staffToken });
        if (cancelled) return;
        const value = typeof payload.content === "string" ? payload.content : "";
        latestContent.current = value;
        persistedContent.current = value;
        setContent(value);
        setSaveStatus("saved");
      } catch {
        if (!cancelled) {
          setError("Private note could not be loaded.");
          setSaveStatus("error");
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    load();
    return () => {
      cancelled = true;
      active.current = false;
    };
  }, [staffToken]);

  const flush = useCallback(async () => {
    if (!loaded || saving.current || latestContent.current === persistedContent.current) return;
    saving.current = true;
    setSaveStatus("saving");
    try {
      while (active.current && latestContent.current !== persistedContent.current) {
        const value = latestContent.current;
        await apiRequest("/api/staff/private-note/", {
          method: "PATCH",
          data: { content: value },
          staffToken,
        });
        persistedContent.current = value;
      }
      if (active.current) {
        setError(null);
        setSaveStatus("saved");
      }
    } catch {
      if (active.current) {
        setError("Private note could not be saved. Keep this page open and try again.");
        setSaveStatus("error");
      }
    } finally {
      saving.current = false;
    }
  }, [loaded, staffToken]);

  useEffect(() => {
    if (!loaded || content === persistedContent.current) return undefined;
    const timer = window.setTimeout(flush, 450);
    return () => window.clearTimeout(timer);
  }, [content, flush, loaded]);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const onMediaChange = (event) => setMobile(event.matches);
    const onResize = () => {
      setFrame((current) => constrainFrame(current));
      setMinimizedPosition((current) => constrainMinimized(current));
    };
    media.addEventListener("change", onMediaChange);
    window.addEventListener("resize", onResize);
    return () => {
      media.removeEventListener("change", onMediaChange);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    if (!minimized) textArea.current?.focus();
  }, [minimized]);

  function updateContent(event) {
    latestContent.current = event.target.value;
    setContent(event.target.value);
    setError(null);
    setSaveStatus("saving");
  }

  function minimize() {
    flush();
    setMinimizedPosition(bottomRightPosition());
    setMinimized(true);
  }

  function maximize() {
    setFrame((current) => constrainFrame(current));
    setMinimized(false);
  }

  function resetLayout() {
    setFrame(defaultExpandedFrame());
    setMinimizedPosition(bottomRightPosition());
  }

  function moveWithKeyboard(event) {
    if (event.target.closest("button") || mobile || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 30 : 10;
    const deltaX = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const deltaY = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    if (minimized) {
      setMinimizedPosition((current) => constrainMinimized({ x: current.x + deltaX, y: current.y + deltaY }));
    } else {
      setFrame((current) => constrainFrame({ ...current, x: current.x + deltaX, y: current.y + deltaY }));
    }
  }

  function resizeWithKeyboard(event) {
    if (mobile || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 30 : 10;
    const deltaWidth = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const deltaHeight = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    setFrame((current) => constrainFrame({
      ...current,
      width: current.width + deltaWidth,
      height: current.height + deltaHeight,
    }));
  }

  function beginDrag(event) {
    if (
      event.button !== 0
      || event.target.closest("button")
      || (mobile && !minimized)
    ) return;
    const origin = minimized
      ? {
          ...minimizedPosition,
          width: Math.min(
            MINIMIZED_WIDTH,
            viewportSize().width - EDGE_MARGIN * 2,
          ),
          height: MINIMIZED_HEIGHT,
        }
      : frame;
    interaction.current = {
      kind: "drag",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function beginResize(event) {
    if (event.button !== 0 || mobile) return;
    interaction.current = {
      kind: "resize",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: frame,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function moveInteraction(event) {
    const current = interaction.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - current.startX;
    const deltaY = event.clientY - current.startY;
    const viewport = viewportSize();
    const availableHeight = Math.max(0, viewport.height - UNDO_LANE_RESERVE);
    if (current.kind === "drag") {
      const next = {
        x: clamp(current.origin.x + deltaX, 0, viewport.width - current.origin.width),
        y: clamp(current.origin.y + deltaY, 0, availableHeight - current.origin.height),
      };
      if (minimized) setMinimizedPosition(next);
      else setFrame((value) => ({ ...value, ...next }));
      return;
    }
    setFrame({
      ...current.origin,
      width: clamp(
        current.origin.width + deltaX,
        Math.min(MIN_WIDTH, viewport.width - current.origin.x),
        viewport.width - current.origin.x,
      ),
      height: clamp(
        current.origin.height + deltaY,
        Math.min(MIN_HEIGHT, availableHeight - current.origin.y),
        availableHeight - current.origin.y,
      ),
    });
  }

  function endInteraction(event) {
    if (interaction.current?.pointerId !== event.pointerId) return;
    interaction.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const minimizedWidth = Math.min(MINIMIZED_WIDTH, viewportSize().width - EDGE_MARGIN * 2);
  const statusText = !loaded ? "Loading…" : saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Not saved" : "Saved";
  const style = minimized
    ? {
        left: minimizedPosition.x,
        top: minimizedPosition.y,
        width: minimizedWidth,
        height: MINIMIZED_HEIGHT,
      }
    : mobile
      ? undefined
      : {
          left: frame.x,
          top: frame.y,
          width: frame.width,
          height: frame.height,
        };

  if (minimized) {
    return (
      <aside className="private-sticky private-sticky--minimized" style={style} aria-label="Private note">
        <div
          className="private-sticky__bar"
          tabIndex={mobile ? undefined : 0}
          aria-label={mobile ? undefined : "Move private note with the arrow keys. Hold Shift for larger steps."}
          aria-keyshortcuts={mobile ? undefined : "ArrowLeft ArrowRight ArrowUp ArrowDown"}
          onPointerDown={beginDrag}
          onPointerMove={moveInteraction}
          onPointerUp={endInteraction}
          onPointerCancel={endInteraction}
          onKeyDown={moveWithKeyboard}
        >
          <span className="private-sticky__preview">Private note</span>
          <span className="private-sticky__header-actions">
            {!mobile && <button className="private-sticky__reset" type="button" onClick={resetLayout} aria-label="Reset private note position and size">Reset</button>}
            <button type="button" onClick={maximize} aria-label="Maximize private note">□</button>
          </span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="private-sticky private-sticky--open" style={style} aria-label="Private note">
      <header
        className="private-sticky__header"
        tabIndex={mobile ? undefined : 0}
        aria-label={mobile ? undefined : "Move private note with the arrow keys. Hold Shift for larger steps."}
        aria-keyshortcuts={mobile ? undefined : "ArrowLeft ArrowRight ArrowUp ArrowDown"}
        onPointerDown={beginDrag}
        onPointerMove={moveInteraction}
        onPointerUp={endInteraction}
        onPointerCancel={endInteraction}
        onKeyDown={moveWithKeyboard}
      >
        <span className="private-sticky__title">Private note <small aria-live="polite" aria-atomic="true">{statusText}</small></span>
        <span className="private-sticky__header-actions">
          {!mobile && <button className="private-sticky__reset" type="button" onClick={resetLayout} aria-label="Reset private note position and size">Reset</button>}
          <button type="button" onClick={minimize} aria-label="Minimize private note">—</button>
        </span>
      </header>
      <textarea
        ref={textArea}
        value={content}
        onChange={updateContent}
        onBlur={flush}
        disabled={!loaded}
        aria-label="Private note text"
        spellCheck="true"
      />
      {error && <p className="private-sticky__error" role="alert">{error}</p>}
      {!mobile && (
        <button
          className="private-sticky__resize"
          type="button"
          aria-label="Resize private note with the arrow keys. Hold Shift for larger steps."
          aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
          onPointerDown={beginResize}
          onPointerMove={moveInteraction}
          onPointerUp={endInteraction}
          onPointerCancel={endInteraction}
          onKeyDown={resizeWithKeyboard}
        />
      )}
    </aside>
  );
}
