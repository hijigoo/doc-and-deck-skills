# White Cobalt PowerPoint — 독립 포팅

동봉 `deck.html`, 이 지침, `scripts/`와 `package.json`만 사용한다.
다른 레포나 `pptx` 스킬은 필수가 아니다. Node.js/Python·필요 패키지·렌더 앱은
동봉 `guide.md`의 준비 사항을 따른다.

## 기본 경로

1. Markdown 입력은 동봉 15종 또는 같은 룩앤필의 새 배치로 읽는 HTML을 작성한다.
2. HTML 입력은 원래 시트 디자인을 보존한다. 목차 등 페이지 UI는 포팅 대상이 아니다.
3. `.sheet .slide`의 1920×1080 좌표·글꼴·줄바꿈·색·도형·표·이미지를 측정한다.
4. 작업별 PptxGenJS 생성기를 작성해 편집 가능한 글자·도형·표를 만든다.
   원본 이미지·아이콘은 그대로 복사한다. `.note-body`는 발표자 노트로 옮긴다.
5. 등장 효과가 있다면 실제 타이밍과 도형 대응을 기록해 동봉 후처리 도구로 적용한다.
6. 원문·배치·자산·노트·타이밍을 대조하고 대상 PowerPoint에서 열어 확인한다.

**적합한 템플릿이 없으면 같은 스킨의 새 레이아웃을 만들어 사용한다.**
생성기 지원이 없다는 이유로 아키텍처·시퀀스·차트·코드 설명을 카드 몇 개로 바꾸지 않는다.
순백 `FFFFFF`, 니어블랙 `0E0E0E`, 코발트 `0F62FE`, 각진 블록·가는 선과
IBM Plex Sans KR/Archivo를 유지한다. 없는 폰트를 대체하면 밝히고 다시 확인한다.

## 독립 작업용 생성기

사용자 작업 폴더에 `make-deck.cjs`를 작성하고 스킬의 표준 패키지를 찾도록 설정할 수 있다.

```js
const path = require("node:path");
const { createRequire } = require("node:module");
const load = createRequire(path.join(process.env.SKILL_DIR, "package.json"));
const pptxgen = load("pptxgenjs");
const deck = new pptxgen();
deck.layout = "LAYOUT_WIDE";
const px = value => value / 144;
const pt = value => value / 2;
const slide = deck.addSlide();
slide.background = { color: "FFFFFF" };
slide.addText("기술 검토", {
  x: px(120), y: px(180), w: px(1680), h: px(90),
  fontFace: "IBM Plex Sans KR", fontSize: pt(64), color: "0E0E0E", margin: 0
});
slide.addNotes("해당 시트의 설명과 스크립트");
deck.writeFile({ fileName: "output/technical.pptx" });
```

```sh
export SKILL_DIR="/absolute/path/to/the-skill"
npm install --prefix "$SKILL_DIR" --no-audit --no-fund
node make-deck.cjs
```

위 코드는 API 시작점이다. 실제 메시지·도식·표를 채워 완성한다.
`addShape`, `addText`, `addTable`, `addImage`, `addChart`, `addNotes`의 설치 버전
타입 정의와 공식 API를 참고한다. 텍스트 상자 패딩과 줄바꿈을 포함해 원본을 측정한다.
차트 값·축·표·비례 길이, 시퀀스의 요청/응답 방향, 코드 행/주석을 함께 유지한다.

## 동봉 네이티브 예제

`scripts/reference.cjs`는 원래 White Cobalt 스타일의 **6장짜리 작업 예제**다.
임의 HTML/Markdown을 자동 변환하는 도구가 아니며 예문의 내용을 사용자 결과에 재사용하지 않는다.
원래 네이티브 도형·타이밍 작성법을 참고할 때 실행할 수 있다.

```sh
DECK_QA_DIR="$PWD/output/reference" \
DECK_SANS="IBM Plex Sans KR" DECK_LATIN="Archivo" \
node "$SKILL_DIR/scripts/reference.cjs"
```

결과 파일 경로는 명령 출력과 지정한 폴더에서 확인한다. `DECK_PPTX`, `DECK_MANIFEST`로
출력을 지정할 수도 있다. 기본 예제의 센티널 노트 줄바꿈과 애니메이션은 아래 명령으로 처리한다.
원고별 생성기가 이미 올바른 노트 줄바꿈을 썼다면 센티널 보정은 필요하지 않다.

```sh
.venv/bin/python "$SKILL_DIR/scripts/fix_notes.py" output/deck.pptx
.venv/bin/python "$SKILL_DIR/scripts/add_animations.py" output/deck.pptx output/manifest.json
.venv/bin/python "$SKILL_DIR/scripts/check_pptx.py" output/deck.pptx
```

경로는 실제 생성 파일명으로 바꾼다. 매니페스트는 동봉 예제가 생성한 형식을 참고한다.
슬라이드별 도형 순서에 대응해 정적 도형은 `0`, 등장 도형은 지연·시간·효과를 기록한다.
예: `{"d":80,"dur":700,"fx":"fade","axis":"y","off":0.02778}`.
실제 HTML의 지연·시간과 도형을 맞추지 않고 임의 효과를 넣어 보존됐다고 하지 않는다.
애니메이션은 생성된 PPTX의 실제 대상 도형 ID와 대조하고 Office에서 재생해 확인한다.

## 명시적으로 재조판이 허용된 경우

동봉 `scripts/build_pptx.js`는 Deep Navy 기반 네이티브 생성기의 White Cobalt
호환 재조판 경로다. 색상 변경만으로 White Cobalt HTML의 원래 배치를 재현하지는 않는다.
엄밀한 포팅의 기본값이 아니며 사용자가 재조판을 허용한 경우에만 쓴다.

```sh
node "$SKILL_DIR/scripts/build_pptx.js" deck.data.cjs \
  --theme white-cobalt --out output/reflow.pptx --font "IBM Plex Sans KR"
```

신뢰할 수 있는 로컬 데이터 스펙에 `title`, `slides`를 넣는다.
`cards`는 `cards:[{title,desc}]`, `table`은 `head`/`rows`, `flow`는
`steps:[{title,desc}]`, `image`는 원본 로컬 `image` 경로, 노트는 `note` 문자열이다.
지원 종류와 필드가 불명확하면 동봉 `scripts/contract.js`를 확인한다.
없는 종류를 조용히 생략하거나 다른 배치로 바꾸지 않는다.

## 검증과 한계

동봉 `check_pptx.py`는 파일 내부 XML·관계·도형/타이밍 등의 **구조 검사**다.
전체 ISO XSD 검증이나 실제 PowerPoint의 열기/재생 검사를 대신하지 않는다.
앱에서 열고 PDF/이미지로 렌더해 전 장의 한글·겹침·잘림·색·원본 자산을 확인한다.

```sh
soffice --headless --convert-to pdf --outdir output output/deck.pptx
pdftoppm -png -r 96 output/deck.pdf output/slide
```

LibreOffice 렌더만으로 PowerPoint 애니메이션 재생까지 통과했다고 하지 않는다.
복합 SVG를 이미지로 보존한 부분, 대체 폰트, 재조판한 부분과 실행하지 못한 검사를 보고한다.
기존 PPTX가 있으면 신규 레이아웃을 만들기보다 원본과 그 자산의 보존이 우선이다.
