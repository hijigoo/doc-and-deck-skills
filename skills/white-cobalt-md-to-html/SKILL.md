---
name: white-cobalt-md-to-html
description: Markdown을 White Cobalt 읽는 HTML로 만듭니다. 폴더 하나에 지침·20종 템플릿·조립/검사 도구를 포함합니다. 순백·코발트 디자인과 공통 읽기 UI를 유지하며 새 레이아웃도 만듭니다.
---

# Markdown → White Cobalt 읽는 문서

**최종 전달물은 자원을 내장한 HTML 파일 하나다.**
[단일 HTML 마감 절차](references/single-file-html.md)를 반드시 수행한다.
원고·장 조각·폰트·이미지 폴더는 내부 작업용이며 별도 결과물로 요구하지 않는다.

**이 스킬 폴더 하나만 복사해 사용한다.** 원래 레포나 형제 스킬은 필요하지 않다.
[독립 사용 규칙](references/guide.md)과 동봉 [deck.html](deck.html)을 읽는다.
`SKILL_DIR`은 이 `SKILL.md`가 있는 폴더의 절대 경로다.

1. 원고의 순서·핵심·상세·표·출처를 읽고 적합한 장 구성을 선택한다.
2. 동봉 20종을 참고한다. **내용에 맞는 템플릿이 없으면 같은 스킨의 새 레이아웃을 만들어 사용한다.**
   별도 승인 없이 설계·검증하며 기존 칸에 억지로 맞추지 않는다.
3. `.chapter > .sheet > .slide`에 시트를, `.note-body`에 상세·제공된 스크립트를 넣는다.
   장 제목·그룹을 갱신하고 원본 이미지·아이콘은 그대로 복사한다.
4. 좌측 목차·세로 스크롤·장별 접기·J/K·N·M·모바일·인쇄는 동봉 런타임을 유지한다.
5. 전체 시트의 내용·한글·밀도·겹침·출처와 읽기 조작을 확인한다.

**디자인:** `#FFFFFF`·`#0E0E0E`·`#0F62FE`, IBM Plex Sans KR/Archivo,
각진 블록·가는 선·큰 타이포. 네이비 도형에 색만 바꾸지 않는다.
20종에는 비대칭 비교·아키텍처·프로세스·표·근거·로드맵과 데이터 흐름·시퀀스·네트워크·
지표·코드/화면 설명이 있다. 카드 수보다 정보 관계로 선택하고 추가 CSS는 `.layout-*`로 한정한다.
짧은 카드만 중앙에 두지 않으며 근거 없는 문장·숫자로 여백을 채우지 않는다.

`deck.html`을 복사·편집하면 빌더 없이 열린다. 에이전트가 원고를 시트 HTML로 작성한 후,
조각을 조립할 때만 아래 Python 표준 라이브러리 도구를 쓴다. Markdown 자동 파서가 아니다.

```sh
python3 "$SKILL_DIR/scripts/build_html.py" chapters.html \
  --title "문서 제목" -o output/document.html
```

자동 검사는 동봉 `package.json`으로 Playwright와 Chromium을 준비한 뒤 실행한다.
설치·경로·오프라인 폰트 조건은 독립 사용 규칙을 따른다.

```sh
node "$SKILL_DIR/scripts/verify.cjs" output/document.html
```

전체 화면 전환·편집 캐시·고정 노트 패널은 넣지 않는다. 기존 PPTX 입력의 내용·배치·자산은
새 디자인보다 우선한다. 기술 도해의 개념/배포 구분·경계·방향·범례·단위·공식 출처를 확인한다.
자원을 내장한 최종 HTML 하나와 렌더/폰트/지원 기능의 한계를 전달한다.
