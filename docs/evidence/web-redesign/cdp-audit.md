# CDP audit — web redesign (F015/F008/F007)

Ngay: 2026-09-10T04:28:48.194Z | WEB=http://localhost:3100 | API=http://localhost:3000 | admin=hoang.anh@vinacons.vn

## Cach do
- Playwright (Chromium, CDP) + `DOM.querySelector` / `CSS.getComputedStyleForNode`:
  padding o `td`, `getBoundingClientRect().height` moi hang `tbody tr`;
  `data-fullbleed` doc tu `.bf-shell`; inspector `display` tu computed style;
  scroll route detail/new: so `scrollHeight` vs `clientHeight` + `scrollTop` sau khi keo xuong day.
- Login that qua `/api/v1/auth/login`, seed `buildflow.auth.v1` vao localStorage (giong web client).

## Ket qua so lieu

```json
{
  "rowHeights1440": {
    "n": 5,
    "min": 44,
    "p50": 44,
    "max": 44
  },
  "tdPadding": "padding=6px 8px 6px 8px",
  "rowHeights1440InspectorOpen": {
    "n": 5,
    "min": 59,
    "max": 74
  },
  "inspectorDisplay1440": "flex",
  "inspectorDisplay1279": "none",
  "mainMarginLeft900": "0px"
}
```

## Steps

- [x] auth — login ok, projects=5
- [x] fullbleed-/projects — data-fullbleed=true
- [x] row-44-48 — {"n":5,"min":44,"p50":44,"max":44}
- [x] cdp-td-padding — padding=6px 8px 6px 8px
- [x] inspector-select — click row -> inspector, khong reload
- [x] inspector-visible-1440 — display=flex
- [x] shot-1440 — after/_projects_1440x900.png
- [x] detail-old-layout — fullbleed=false scroll={"scrollHeight":3314,"clientHeight":900,"scrolled":2414}
- [x] new-old-layout — fullbleed=false form=true scroll={"scrollHeight":921,"clientHeight":900,"scrolled":21}
- [x] inspector-hidden-1279 — display=none
- [x] shot-1279 — after/_projects_1279x900.png
- [x] drawer-900-margin — margin-left=0px
- [x] shot-900 — after/_projects_900x900.png

Ket luan: ALL-PASS
