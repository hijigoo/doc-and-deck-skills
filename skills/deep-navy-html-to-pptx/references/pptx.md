# Deep Navy PowerPoint — 독립 포팅

동봉 `deck.html`, `scripts/`, `package.json`, `requirements.txt`만으로 작업한다.
준비 사항은 [guide.md](guide.md)를 따른다. 원래 레포나 다른 스킬은 필요하지 않다.
이것은 에이전트가 HTML을 측정하고 생성기를 작성하는 워크플로이며 범용 자동 변환기가 아니다.

## 1. 원본과 시트 측정

읽는 문서는 `.chapter .sheet .slide`를 같은 장의 `.note-body`와 대응시킨다.
발표 덱은 `.deck-stage > .slide`와 그 안의 `.slide-notes`를 확인한다.
장 수·순서·숨김 상태·제목·표 전체 행/열·원본 자산·출처·노트를 기록한다.
HTML·로컬 자산을 수정하지 말고 출력 폴더에 작업용 복사본을 둔다.

시트는 기본 1920×1080이다. 목차·웹 장 제목 바·버튼은 시트에 넣지 않는다.
반응형 화면에 축소된 `getBoundingClientRect()` 값을 그대로 쓰지 않는다.
원래 시트 크기에서 측정하거나 시트의 화면상 원점을 빼고 배율로 나눈다.
`document.fonts.ready`와 이미지 로딩을 기다린 뒤, 등장 전 상태가 아닌 최종 배치를 측정한다.
효과의 지연·지속시간·이동량은 애니메이션을 끄기 **전** 원본 CSS에서 별도로 기록한다.

| HTML 값 | PPTX 값 |
|---|---|
| 시트 좌표/너비/높이 | px ÷ 144 인치 |
| CSS 글꼴 크기/선 두께 | px ÷ 2 포인트 |
| 가로 이동량 | px ÷ 시트 너비 |
| 세로 이동량 | px ÷ 시트 높이 |

다른 종횡비면 입력 크기를 보존하는 커스텀 레이아웃과 동일 배율을 사용한다.
표준 WIDE 치수에 강제로 늘리거나 자르지 않는다. 글꼴 폭·줄바꿈·텍스트 상자 패딩과
글자 간격도 측정하며, 브라우저와 Office의 폰트 렌더 차이는 실제 렌더로 보정한다.

## 2. Deep Navy 시각 언어

입력 HTML의 실제 `:root` 및 계산된 스타일이 아래 기본값보다 우선이다.

| 역할 | 기본값 |
|---|---|
| 종이/보조 종이 | `F4F2ED` / `EAE7DF` |
| 네이비/보조 네이비 | `0E2340` / `14304F` |
| 코발트/부드러운 강조 | `2C6BED` / `7FA6F2` |
| 본문/보조 본문/선 | `0B1622` / `5A6A7D` / `D8D3C9` |
| 디스플레이/본문/코드 | Manrope / Pretendard Variable / IBM Plex Mono |

반투명 색은 해당 레이어의 실제 배경에 합성한다. 밝은 종이 위와 어두운 네이비 위에
같은 합성색을 쓰지 않는다. 둥근 모서리·경계·그림자·레이어는 원본을 따르며,
화이트 배경·각진 상자·`0F62FE`로 일괄 교체하지 않는다.
웹폰트 링크는 Office에 폰트를 설치하지 않는다. 설치된 폰트를 사용하고 대체 시 보고한다.

구성도는 포함 경계·화살표 방향·선 종류·범례를, 차트는 값·축·단위·비례를 유지한다.
원본 이미지·로고·아이콘은 그대로 사용한다. PPTX에서 재현하기 어려운 복합 SVG·그라데이션만
필요한 범위에서 이미지로 보존하고 그 부분의 편집성 한계를 밝힌다.
맞는 예제가 없어도 작업별 배치를 구현하며 정보를 몇 개의 카드로 줄이지 않는다.

## 3. 작업별 생성기와 동봉 예제

작업 폴더의 `make-deck.cjs`에서 스킬의 패키지를 사용하려면 아래처럼 로드한다.
신뢰할 수 없는 입력의 JavaScript를 생성기로 실행하지 않는다.

```js
const path = require("node:path");
const { createRequire } = require("node:module");
const load = createRequire(path.join(process.env.SKILL_DIR, "package.json"));
const pptxgen = load("pptxgenjs");
const px = value => value / 144;
const pt = value => value / 2;
```

동봉 `scripts/reference.cjs`는 편집 가능한 글자·도형·표·다중 행 노트와
매니페스트를 생성하는 **2장짜리 API 예제**다. `deck.html` 15장의 포팅본이 아니며
예문을 사용자 결과에 남기지 않는다. 실행·복사 후 입력의 측정값에 맞춰 구현한다.

```sh
export SKILL_DIR="/absolute/path/to/deep-navy-html-to-pptx"
npm install --prefix "$SKILL_DIR" --no-audit --no-fund
DECK_QA_DIR="$PWD/output/reference" \
DECK_SANS="Pretendard Variable" DECK_LATIN="Manrope" \
node "$SKILL_DIR/scripts/reference.cjs"
```

생성 파일은 `deep-navy-reference.pptx`, `anim-manifest.json`이다.
`DECK_PPTX`, `DECK_MANIFEST`로 경로를 지정할 수도 있다.
설치한 PptxGenJS의 타입 정의를 참고해 `addText`, `addShape`, `addTable`, `addImage`,
`addChart`를 사용한다. 생성 ZIP에는 동봉 `contract.js`의
`normalizeGeneratedContentTypes()`를 적용해 중복 콘텐츠 타입을 정리한다.
`ppt/presentation.xml`의 요소 순서를 스키마에 맞춘다는 이유로 재정렬하지 않는다.

## 4. 노트와 애니메이션

예제는 노트의 `\n`을 `\u2424` 센티널로 바꿔 PptxGenJS에 전달한다.
동봉 `fix_notes.py`가 이를 OOXML 줄바꿈으로 복원한다. 실제 U+2424 문자가 있는
원고라면 센티널 방식 대신 `contract.js`의 `notesXml()`로 본문을 직접 기록한다.
이미 올바르게 노트를 쓴 생성기에는 센티널 보정을 적용할 필요가 없다.

매니페스트는 **슬라이드 배열 안에 도형 배열**을 둔다. 생성된 슬라이드 XML의
`p:cNvPr` 문서 순서(시트 루트 그룹 ID 1 제외)에 맞춰 모든 도형을 한 번씩 기록한다.
도형 ID를 인덱스+2로 추측하지 않는다. 표·차트·그룹을 추가하면 최종 XML을 다시 대조한다.
한 HTML 블록이 여러 PPTX 도형이면 각 도형에 같은 효과를 기록한다.

```json
[
  [0, 1, {"d":160,"dur":620,"fx":"fade","axis":"y","off":0.0277777778}],
  [0, 0]
]
```

위 예시는 3개/2개 도형을 가진 두 슬라이드다. `0`은 정적 도형이며, `1`–`8`은
동봉 Deep Navy의 `.reveal.r1`–`.reveal.r8` 약식이다. 커스텀 CSS라면 명시적 객체로 기록한다.
예제 파일의 실제 도형 개수와 혼동하지 않는다.

| 원본 효과 | 지연(ms) | 지속(ms) | 효과/이동 |
|---|---|---|---|
| `.reveal.r1`–`.r8` | 60, 160, 260, 360, 460, 560, 660, 760 | 620 | fade + y 30/1080 |
| `.stagger > *` 1–10번째 이후 | 180, 260, 340, 420, 500, 580, 660, 740, 820, 900 | 580 | fade + y 26/1080 |
| `.cv1`–`.cv7` | 100, 260, 420, 620, 740, 860, 1000 | 950 | fade + y 38/1080 |
| `.cover-rule` | 500 | 900 | 왼쪽에서 wipe |

`fade`의 순수 페이드는 `off:0`, `wipe`는 `fx:"wipe"`로 기록한다.
효과는 슬라이드 진입 시 자동 실행한다. 원본이 정적이면 전부 `0`이며 타이밍을 넣지 않는다.
CSS easing과 PowerPoint 모션은 완전히 같지 않다. 클릭·반복·복합 회전·영상·웹 인터랙션은
이 도구가 지원하지 않으며 임의의 fade로 대체하지 않는다. 변환 범위를 사용자와 결정한다.
`grpId`만 넣고 대응하는 `p:bldLst`를 생략하지 않는다.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r "$SKILL_DIR/requirements.txt"
.venv/bin/python "$SKILL_DIR/scripts/fix_notes.py" output/reference/deep-navy-reference.pptx
.venv/bin/python "$SKILL_DIR/scripts/add_animations.py" \
  output/reference/deep-navy-reference.pptx output/reference/anim-manifest.json
.venv/bin/python "$SKILL_DIR/scripts/check_pptx.py" output/reference/deep-navy-reference.pptx
```

타이밍 주입은 **새로 생성한 작업용 PPTX에 한 번만** 실행한다. 다시 적용하려면 생성기부터 실행한다.
슬라이드/도형 수 불일치, 잘못된 효과, 기존 타이밍은 오류로 중단하며 성공으로 취급하지 않는다.
`--no-anim`은 명시적으로 정적 출력을 허용할 때만 사용한다.

## 5. 재조판을 명시적으로 허용한 경우

동봉 `build_pptx.js`는 기존 Deep Navy 계열 네이티브 재조판 생성기다.
`contract.js`의 네이티브 팔레트와 배치는 HTML의 `:root`와 다르므로
**HTML 보존 경로의 기본 생성기나 색상 기준으로 사용하지 않는다.**

```js
module.exports = {
  title: "검토",
  slides: [
    { kind: "cards", title: "검토 기준",
      cards: [{ title: "근거", desc: "자료의 출처 확인" }],
      note: "첫 문단\n둘째 줄\n\n다음 문단" }
  ]
};
```

```sh
node "$SKILL_DIR/scripts/build_pptx.js" deck.data.cjs \
  --theme deep-navy --out output/reflow.pptx --font "Apple SD Gothic Neo"
```

지원 종류는 `cover`, `agenda`, `divider`, `cards`, `numbered`, `table`, `flow`,
`stack`, `twocol`, `image`, `quote`, `bullets`다. 필드·개수 제약은 `scripts/contract.js`를
따른다. 이미지 경로는 스펙 파일 위치 기준이다. 이 생성기는 노트 줄바꿈을 직접 기록하지만
HTML 효과를 추출하거나 애니메이션 매니페스트를 만들지는 않는다.

## 6. 확인과 전달

`check_pptx.py`는 XML·관계·도형 ID·타이밍 참조의 **구조 검사**다.
전체 ISO XSD나 PowerPoint 열기·재생 검사를 대신하지 않는다.
원문과 장 수·순서·문구·표 값·자산·노트·타이밍을 대조한다.

```sh
soffice --headless --convert-to pdf --outdir output output/deck.pptx
pdftoppm -png -r 96 output/deck.pdf output/slide
```

전 장을 원본 HTML의 최종 화면과 비교해 한글·폰트·줄바꿈·겹침·잘림·색·배치를 확인한다.
PDF에서 한글만 사라지면 성공으로 보지 않는다. 렌더 앱의 폰트 탐색 설정과 실제 사용한
폰트를 확인하고, 필요한 경우 올바른 Fontconfig 설정과 명시적 대체 폰트로 재렌더한다.
PowerPoint에서 복구 대화상자 없이 열리는지, Animation Pane의 대상·순서·지연이 맞는지,
슬라이드 쇼에서 실제로 재생되는지도 확인한다. LibreOffice의 정적 렌더는 재생 증거가 아니다.
앱이나 폰트가 없어 실행하지 못한 검사는 미확인으로 보고한다.
PPTX와 생성기·매니페스트·필요 자산을 전달하며 재조판·이미지 처리·대체 폰트·미지원 효과를
명시한다. 구조 검사만 성공한 결과를 시각적 동일성까지 검증됐다고 표현하지 않는다.

도구 변경 시 동봉 회귀 검사를 실행한다. 이 검사는 CSS 타이밍 계약·실제 도형 ID 대응·
정적 슬라이드·잘못된 매니페스트 거부·노트 줄바꿈을 검사하며 실제 앱 검사를 대신하지 않는다.

```sh
PYTHONDONTWRITEBYTECODE=1 python3 "$SKILL_DIR/scripts/test_animations.py"
```
