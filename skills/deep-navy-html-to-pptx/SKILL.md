---
name: deep-navy-html-to-pptx
description: Deep Navy HTML의 시트 디자인과 등장 효과를 PowerPoint로 포팅합니다. "Deep Navy HTML을 PPTX로", "네이비 덱 PowerPoint 변환" 요청에 사용하며 독립 폴더에 템플릿·네이티브 예제·애니메이션·노트·구조 검사 도구를 포함합니다.
---

# Deep Navy HTML → PowerPoint

**이 폴더 하나로 사용한다.** 원래 레포·형제 스킬·별도 `pptx` 스킬은 필수가 아니다.
[독립 사용 규칙](references/guide.md)과 [포팅/검증 절차](references/pptx.md)를 읽는다.
[deck.html](deck.html)은 Deep Navy의 20종 디자인 기준이며, 실제 입력 HTML이 우선이다.
`SKILL_DIR`은 이 폴더의 절대 경로다.

## 기본 작업

1. 입력 HTML과 연결된 이미지·폰트·SVG·스타일을 확인한다. 읽는 문서는
   `.chapter .sheet .slide`와 같은 장의 `.note-body`, 발표 덱은 `.slide`와
   `.slide-notes`를 대응시킨다. 노트가 없으면 임의로 만들지 않는다.
2. **기본은 시트 디자인과 등장 효과를 보존하는 포팅**이다. 실제 시트의 좌표·폰트·
   크기·줄바꿈·색·레이어·도형·표·이미지·타이밍을 측정해 작업별 PptxGenJS 생성기를 작성한다.
3. 목차·장 제목 바·웹 설명란·모바일 버튼은 시트에 넣지 않는다.
   설명과 스크립트·출처는 장별 발표자 노트로 옮기고 문단과 줄바꿈을 유지한다.
4. 원본 이미지·로고·아이콘, 구성도의 경계·연결 방향·범례, 차트 값·비례, 코드 행·주석을
   유지한다. 기존 예제에 없는 배치도 단순 카드나 표로 축약하지 않는다.
5. HTML 효과와 PPTX 도형의 대응을 매니페스트에 기록한다. 정적인 원본에는 효과를
   추가하지 않는다. 동봉 후처리·구조 검사를 실행하고 전 장의 렌더·본문·노트·자산을 대조한다.

Node.js/Python 패키지는 동봉 `package.json`·`requirements.txt`로 준비한다.
출력과 작업별 생성 코드는 사용자 작업 폴더에 저장하며 설치된 스킬 폴더에 쓰지 않는다.

```sh
export SKILL_DIR="/absolute/path/to/deep-navy-html-to-pptx"
npm install --prefix "$SKILL_DIR" --no-audit --no-fund
python3 -m venv .venv
.venv/bin/python -m pip install -r "$SKILL_DIR/requirements.txt"

# 작업별 생성기로 output/deck.pptx와 output/manifest.json을 만든 뒤 실행한다.
.venv/bin/python "$SKILL_DIR/scripts/fix_notes.py" output/deck.pptx
.venv/bin/python "$SKILL_DIR/scripts/add_animations.py" output/deck.pptx output/manifest.json
.venv/bin/python "$SKILL_DIR/scripts/check_pptx.py" output/deck.pptx
```

노트를 이미 올바르게 쓴 생성기에는 센티널 보정이 필요하지 않다. 원본이 정적이면
매니페스트는 전부 `0`으로 두며, 후처리도 효과를 추가하지 않는다.
동봉 `scripts/reference.cjs`는 매니페스트·노트·편집 가능한 객체의 **2장짜리 API 예제**다.
임의 HTML 자동 변환기나 `deck.html` 20장의 완성 포팅본이 아니다.

## 보존 기준과 중단 조건

- Deep Navy의 종이색 `F4F2ED`, 네이비 `0E2340`, 코발트 `2C6BED`,
  Manrope/Pretendard/IBM Plex Mono와 입력의 실제 토큰을 유지한다.
  White Cobalt의 색·폰트·애니메이션 기본값을 가져오지 않는다.
- 편집 가능한 텍스트·표·도형을 우선한다. 전체 시트를 몰래 이미지로 바꾸지 않는다.
  복합 SVG·이미지로 보존한 부분과 편집성 한계를 구분한다.
- 원본 자산·필수 도구가 없으면 누락을 보고한다. 대체 폰트는 밝히고 재렌더한다.
  지원하지 않는 클릭·반복·인터랙션을 자동 등장 효과로 조용히 바꾸지 않는다.
- 구조 검사만으로 PowerPoint의 열기·재생이나 시각적 동일성을 통과했다고 하지 않는다.
  실제 앱 확인을 못 하면 그 상태와 남은 확인 사항을 명시한다.

**재조판을 명시적으로 허용한 경우에만** 동봉
`scripts/build_pptx.js --theme deep-navy`를 사용한다. 이 경로의 네이티브 테마는
입력 HTML의 배치·팔레트를 자동 복제하지 않는다.
기존 PPTX 원본도 있다면 불필요한 재생성보다 원본 보존을 우선한다.

전달할 때 결과 PPTX·작업별 생성기·매니페스트·필요 자산을 함께 안내하고,
보존 범위·폰트 대체·이미지 처리 영역·실행하지 못한 검사를 명확히 보고한다.
