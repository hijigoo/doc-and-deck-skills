# Deep Navy PowerPoint — 독립 실행

`SKILL_DIR`은 이 스킬 폴더다. 동봉 `package.json`을 설치하면 다른 저장소나 스킬 없이
네이티브 생성기를 실행할 수 있다. 긴 본문·수치·표·노트의 의미는 에이전트가 원고에서
구성한다. 이 도구는 임의 Markdown/HTML의 자동 해석기가 아니다.

## 데이터 스펙 경로

작업 폴더에 신뢰할 수 있는 `deck.data.cjs`를 작성한다. 임의 다운로드한 JS를 실행하지 않는다.

```js
module.exports = {
  title: "업무 검토",
  cover: { title: "업무 검토", subtitle: "근거와 책임을 연결합니다", note: "도입 설명" },
  slides: [
    { kind: "cards", title: "두 가지 원칙",
      cards: [{ title: "근거", desc: "확인한 자료로 판단" },
              { title: "책임", desc: "다음 행동의 담당자 지정" }],
      note: "첫 문단\n둘째 줄\n\n다음 문단" },
    { kind: "table", title: "판단 기준", head: ["항목", "확인"],
      rows: [["자료", "출처와 갱신"], ["접근", "허용과 거부"]] }
  ]
};
```

```sh
npm install --prefix "$SKILL_DIR" --no-audit --no-fund
node "$SKILL_DIR/scripts/build_pptx.js" deck.data.cjs \
  --theme deep-navy --out output/deck.pptx --font "Apple SD Gothic Neo"
```

폰트는 실제 설치된 테마 폰트를 선택한다. 대체 폰트를 쓰면 밝히고 다시 렌더한다.
결과는 13.333×7.5인치의 편집 가능한 텍스트·도형·표와 원본 이미지로 구성된다.
이미지 경로는 데이터 스펙 위치를 기준으로 해석한다. notes는 문자열이며 여러 줄을 보존한다.

| `kind` | 필수 데이터 | 주의 |
|---|---|---|
| `cover` | `title` | `subtitle`, `meta`, `note` 가능 |
| `agenda` | `items: [{title, desc?}]` | 1–6개 |
| `divider` | `title` | `label`, `sub` 가능 |
| `cards` | `title`, `cards: [{title, desc?}]` | 1–6개, `cols: 1..3` |
| `numbered` | `title`, `items: [{title, desc?}]` | 1–6개 |
| `table` | `title`, `head`, `rows` | 1–8열, 본문 1–12행 |
| `flow` | `title`, `steps: [{title, desc?}]` | 1–6단계 |
| `stack` | `title`, `layers: [{title, desc?}]` | 1–7계층 |
| `twocol` | `title`, `left/right: {title, items: [text]}` | 각 1–6개 |
| `image` | `title`, `image` | 원본 비율 유지 |
| `quote` | `big` | `sub`, `cards` 0–3개 가능 |
| `bullets` | `title`, `bullets: [text]` | 1–6개 |

지원 `kind`는 생성기 한계이지 스킬의 레이아웃 한계가 아니다. **맞는 템플릿이 없으면
같은 스킨의 새 레이아웃을 만들어 사용한다.** 동봉 `deck.html`의 20종을 참고하고
구성도·시퀀스·차트·코드 설명을 단순 카드로 축약하지 않는다.

## 새 레이아웃과 HTML 포팅

작업별 생성기를 사용자의 출력 폴더에 작성한다. Node는 파일 위치를 기준으로 패키지를
찾으므로, 출력 폴더에도 필요한 표준 패키지를 설치하거나 스킬의 패키지를 명시적으로 찾는다.
두 방법 모두 원래 저장소나 형제 스킬은 필요하지 않다.

```js
const path = require("node:path");
const { createRequire } = require("node:module");
const load = createRequire(path.join(process.env.SKILL_DIR, "package.json"));
const pptxgen = load("pptxgenjs");
const deck = new pptxgen();
deck.layout = "LAYOUT_WIDE";
const slide = deck.addSlide();
slide.background = { color: "F4F2ED" };
slide.addText("검토 결과", {
  x: 0.8, y: 0.6, w: 11.7, h: 0.7, fontSize: 32,
  fontFace: "Apple SD Gothic Neo", color: "0E2340", margin: 0
});
slide.addNotes("원고의 상세와 스크립트를 이곳에 보존합니다.");
deck.writeFile({ fileName: "output/example.pptx" });
```

이 코드는 API 시작점일 뿐 완성 레이아웃 예제가 아니다. 실제 콘텐츠를 구성한 뒤 실행한다.
환경 변수를 읽는 생성기를 실행할 때는 `export SKILL_DIR`로 전달한다.
사용 가능한 `addShape`, `addText`, `addTable`, `addImage`, `addChart`, `addNotes`를 사용한다.
특정 버전 API가 불명확하면 설치한 PptxGenJS의 타입 정의·공식 문서로 확인한다.

HTML을 엄밀히 포팅할 때는 **시트만** 1920×1080에서 측정한다. 좌표는 `/144`인치,
CSS 폰트 크기는 `/2`포인트로 바꾼다. 실제 글꼴·줄바꿈·선·모서리·간격을 유지한다.
목차·웹 설명란·버튼을 PPTX 시트에 넣지 않고 `.note-body`는 발표자 노트로 옮긴다.
지원 가능한 도형과 텍스트는 편집 가능하게 만들며 복합 SVG/이미지는 그 한계를 밝힌다.
HTML 자체와 기본 네이티브 생성기가 픽셀 동일하다고 주장하지 않는다.

## 확인

전체 장 수·본문·표 값·원본 자산·노트와 생성기 오류를 확인한다.
PowerPoint 또는 LibreOffice에서 실제로 열어 잘림·한글·노트·차트를 검사한다.

```sh
soffice --headless --convert-to pdf --outdir output output/deck.pptx
pdftoppm -png -r 96 output/deck.pdf output/slide
```

모든 페이지 이미지를 확인한다. 대상 앱·폰트가 없으면 확인하지 못한 점을 밝힌다.
생성기에서 없는 `kind`를 조용히 다른 배치로 바꾸지 않는다. 기존 PPTX 입력이 있으면
이 신규 디자인 경로보다 원본 보존을 우선한다.
