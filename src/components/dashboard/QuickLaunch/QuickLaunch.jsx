import "./QuickLaunch.css";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { services } from "../../../data/services";

const DRAG_THRESHOLD = 6; // px of movement before a pointer press counts as a drag

function QuickLaunch() {
  const trackRef = useRef(null);
  const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: false });
  const [dragging, setDragging] = useState(false);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft < max - 8);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = trackRef.current;
    if (!el) return;

    let raf = 0;
    const onScrollOrResize = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        updateArrows();
      });
    };

    el.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      el.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [updateArrows]);

  const scrollByPage = useCallback((direction) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector(".launch-card");
    const step = card ? card.offsetWidth + 18 : Math.max(260, el.clientWidth * 0.8);
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  }, []);

  /* ---- pointer drag (mouse only) ----
     Touch/trackpad scrolling is handled natively by the browser so phones
     and tablets get real momentum, rubber-banding and scroll-snap. The JS
     drag below only takes over for mouse pointers. */

  const onPointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const el = trackRef.current;
    if (!el) return;

    const isMouse = e.pointerType === "mouse";
    drag.current = {
      active: true,
      isMouse,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      moved: false,
    };

    if (isMouse) {
      setDragging(true);
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* capture is a nicety — ignore when unsupported */
      }
    }
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    const el = trackRef.current;
    if (!d.active || !el) return;

    if (!d.isMouse) {
      // Native scrolling already moves el.scrollLeft; just record whether
      // the gesture actually scrolled so the trailing click is swallowed.
      if (Math.abs(el.scrollLeft - d.startScroll) > DRAG_THRESHOLD) d.moved = true;
      return;
    }

    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > DRAG_THRESHOLD) d.moved = true;
    el.scrollLeft = d.startScroll - dx;
  };

  const endDrag = () => {
    const d = drag.current;
    const el = trackRef.current;
    if (!d.active) return;
    // Touch swipes may not fire pointermove once the browser takes over
    // native scrolling — check the scroll position directly.
    if (!d.isMouse && el && Math.abs(el.scrollLeft - d.startScroll) > DRAG_THRESHOLD) {
      d.moved = true;
    }
    d.active = false;
    setDragging(false);
  };

  // Swallow the click that follows a real drag/swipe so cards are not
  // opened when the user was actually scrolling.
  const onClickCapture = (e) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  };

  /* ---- keyboard navigation ---- */

  const onKeyDown = (e) => {
    const el = trackRef.current;
    if (!el) return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollByPage(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollByPage(1);
    } else if (e.key === "Home") {
      e.preventDefault();
      el.scrollTo({ left: 0, behavior: "smooth" });
    } else if (e.key === "End") {
      e.preventDefault();
      el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
    }
  };

  return (
    <section className="quick-launch fade-up">
      <div className="section-header">
        <h2>Quick Launch</h2>

        <div className="launch-controls">
          <span className="launch-count">{services.length} Services</span>

          <div className="launch-arrows">
            <button
              type="button"
              className="launch-arrow"
              onClick={() => scrollByPage(-1)}
              disabled={!canLeft}
              aria-label="Scroll apps left"
              title="Scroll left"
            >
              <ChevronLeft size={18} />
            </button>

            <button
              type="button"
              className="launch-arrow"
              onClick={() => scrollByPage(1)}
              disabled={!canRight}
              aria-label="Scroll apps right"
              title="Scroll right"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={trackRef}
        className={`launch-track ${dragging ? "dragging" : ""}`}
        role="region"
        aria-label="Quick Launch apps — scroll horizontally, arrow keys or buttons to move"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={onClickCapture}
        onKeyDown={onKeyDown}
      >
        {services.map((service) => {
          const Icon = service.icon;

          return (
            <a
              key={service.id}
              href={service.url}
              target="_blank"
              rel="noreferrer"
              draggable={false}
              className="launch-card"
            >
              <div
                className="launch-icon"
                style={{ background: service.color }}
              >
                <Icon size={26} color="white" />
              </div>

              <span className="launch-title">
                {service.name}
              </span>
            </a>
          );
        })}
      </div>
    </section>
  );
}

export default memo(QuickLaunch);
