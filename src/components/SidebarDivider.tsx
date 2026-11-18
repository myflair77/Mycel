import {useRef} from 'react';

type Props = {
  width: number;
  onResize: (width: number) => void;
  personal?: boolean;
};

export function SidebarDivider({width, onResize, personal = false}: Props) {
  const drag = useRef<{x: number; width: number} | null>(null);

  function resize(divider: HTMLElement, requested: number) {
    const sidebar = divider.previousElementSibling;
    const app = divider.closest('.app');
    if (!sidebar || !app) return;
    const available = app.getBoundingClientRect().right - sidebar.getBoundingClientRect().left;
    onResize(Math.round(Math.max(140, Math.min(600, available - 284, requested))));
  }

  return <div
    className={personal ? 'personal-separator' : 'list-resizer'}
    role="separator"
    aria-label="왼쪽 사이드패널 너비 조절"
    aria-orientation="vertical"
    aria-valuemin={140}
    aria-valuemax={600}
    aria-valuenow={width}
    title="드래그 또는 방향키로 너비 조절"
    tabIndex={0}
    onKeyDown={event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const divider = event.currentTarget;
      const actual = divider.previousElementSibling?.getBoundingClientRect().width ?? width;
      resize(divider, actual + (event.key === 'ArrowLeft' ? -10 : 10));
    }}
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault();
      const divider = event.currentTarget;
      drag.current = {x: event.clientX, width: divider.previousElementSibling?.getBoundingClientRect().width ?? width};
      divider.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      if (drag.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
        resize(event.currentTarget, drag.current.width + event.clientX - drag.current.x);
      }
    }}
    onLostPointerCapture={() => { drag.current = null; }}
  />;
}
