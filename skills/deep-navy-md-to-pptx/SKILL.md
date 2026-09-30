---
name: deep-navy-md-to-pptx
description: Markdown을 Deep Navy PowerPoint로 만듭니다. 지침·15종 HTML 디자인 기준·네이티브 생성기·검증 도구를 포함해 폴더 하나로 사용하며 편집 가능한 텍스트·표·도형·노트를 유지합니다.
---

# Markdown → Deep Navy PowerPoint

**이 스킬 폴더 하나로 사용한다.** 원래 레포·다른 스킬은 필요하지 않다.
[독립 사용 규칙](references/guide.md)과 [PPTX 작성/검증](references/pptx.md)을 읽는다.
[deck.html](deck.html)은 동봉된 15종 디자인 기준이다. `SKILL_DIR`은 이 폴더의 절대 경로다.

1. 원고를 읽고 메시지·전체 항목·표·원본 자산·상세 스크립트를 장별로 구성한다.
2. **맞는 템플릿이 없으면 같은 스킨의 새 레이아웃을 만들어 사용한다.**
   기존 칸에 내용을 억지로 맞추지 않는다. 기본 생성기의 `kind`는 스킬의 디자인 한계가 아니다.
3. 지원되는 배치라면 작업 폴더에 신뢰할 수 있는 데이터 스펙을 작성하고 동봉 생성기를 실행한다.
4. 아키텍처·시퀀스·차트·코드 설명 등 새 배치는 동봉 지침을 따라 작업별 PptxGenJS 생성기로 구현한다.
   원래 HTML을 포팅해야 한다면 실제 시트 좌표·폰트·자산을 측정한다.
5. 전 장의 본문·표·이미지·노트와 원고를 대조하고 PowerPoint/LibreOffice에서 실제 렌더를 확인한다.

Node.js와 동봉 `package.json`의 표준 라이브러리를 준비한다. 아래 스크립트·도형 계약·아이콘·
저작권 고지는 모두 이 스킬의 `scripts/`에 포함된다.

```sh
npm install --prefix "$SKILL_DIR" --no-audit --no-fund
node "$SKILL_DIR/scripts/build_pptx.js" deck.data.cjs \
  --theme deep-navy --out output/deck.pptx
```

파일 경로는 현재 작업 폴더와 스펙 위치를 기준으로 한다. 스킬 설치 폴더에 출력하지 않는다.
테마 폰트가 없으면 설치하거나 대체를 밝히고 재확인한다. HTML 작성/검사도 동봉 도구로 가능하다.

목차·웹 설명란·모바일 버튼은 PPTX 시트에 그리지 않고 설명·스크립트를 발표자 노트로 옮긴다.
텍스트·표·도형은 편집 가능한 객체를 우선하고 원본 이미지는 그대로 사용한다.
복합 SVG/이미지로 보존한 부분과 애니메이션·폰트·렌더의 한계를 명시한다.
기본 네이티브 배치와 HTML은 같은 디자인 계열이지 자동 픽셀 복제본이 아니다.
기존 PPTX가 제공되면 신규 원고용 재조판보다 원본 보존이 우선이다.
