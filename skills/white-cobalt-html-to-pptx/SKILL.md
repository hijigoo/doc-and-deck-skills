---
name: white-cobalt-html-to-pptx
description: White Cobalt HTML의 시트 디자인을 PowerPoint로 포팅합니다. 독립 폴더에 지침·템플릿·네이티브 예제·애니메이션/노트/구조 검사 도구를 포함하며 웹 UI는 제외합니다.
---

# White Cobalt HTML → PowerPoint

**이 폴더 하나로 사용한다.** 원래 레포·형제 스킬·별도 `pptx` 스킬은 필수가 아니다.
[독립 사용 규칙](references/guide.md)과 [포팅/검증 절차](references/pptx.md)를 읽는다.
디자인 참조 [deck.html](deck.html)과 실행 도구를 모두 동봉한다.
`SKILL_DIR`은 이 폴더의 절대 경로다.

1. 읽는 문서는 `.chapter .sheet .slide`와 같은 장의 `.note-body`를 대응시킨다.
   기존 발표 덱은 `.slide`와 `.slide-notes`를 대응시킨다.
2. **기본은 시트 디자인과 등장 효과를 보존하는 포팅**이다. 본문의 좌표·폰트·크기·줄바꿈·
   도형·표·이미지·원래 타이밍을 측정해 작업별 PptxGenJS 생성기를 작성한다.
3. 목차·장 제목 바·웹 설명란·모바일 버튼은 시트에 넣지 않는다. 설명과 스크립트는 노트로 옮긴다.
4. 원본 이미지·로고·아이콘은 그대로 복사한다. 구성도의 경계·연결 방향·범례, 차트 값·비례,
   코드 행과 주석을 보존한다. 기존 예제에 없는 레이아웃도 카드나 표로 축약하지 않는다.
5. 동봉 후처리·구조 검사를 실행하고 전 장의 렌더·본문·노트·자산·타이밍을 확인한다.

Node.js/Python 라이브러리는 동봉 `package.json`·`requirements.txt`로 준비한다.
아래 파일들은 이 폴더 안에 있으며 다른 프로젝트에서 가져오지 않는다.

```sh
.venv/bin/python "$SKILL_DIR/scripts/fix_notes.py" output/deck.pptx
.venv/bin/python "$SKILL_DIR/scripts/add_animations.py" output/deck.pptx output/manifest.json
.venv/bin/python "$SKILL_DIR/scripts/check_pptx.py" output/deck.pptx
```

매니페스트와 네이티브 작성법은 동봉 `scripts/reference.cjs`의 6장 예제를 참고한다.
임의 HTML 자동 변환기가 아니므로 입력 내용을 직접 측정·구현해야 한다.
노트를 이미 올바르게 쓴 생성기에는 센티널 줄바꿈 보정이 필요하지 않다.

재조판을 명시적으로 허용한 경우에만 동봉 `scripts/build_pptx.js --theme white-cobalt`를 쓴다.
이는 일반 네이티브 재조판이지 White Cobalt HTML의 픽셀 복제기가 아니다.
새 배치가 필요하더라도 원래 스킨의 시각 언어를 유지한다.
전체 시트를 몰래 이미지로 바꾸지 않으며, 복합 SVG/이미지로 보존한 부분·폰트 대체·미실행
PowerPoint 재생 검사·구조 검사 한계를 명확히 전달한다.
