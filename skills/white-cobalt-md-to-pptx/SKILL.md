---
name: white-cobalt-md-to-pptx
description: Markdown을 White Cobalt HTML로 구성한 뒤 편집 가능한 PowerPoint로 옮깁니다. 폴더 안의 20종 템플릿·작성 지침·네이티브 예제·노트/애니메이션 도구만 사용합니다.
---

# Markdown → White Cobalt PowerPoint

**이 스킬 폴더만 복사한다.** 원래 레포·HTML 스킬·별도 `pptx` 스킬을 설치할 필요가 없다.
[독립 사용 규칙](references/guide.md), [PPTX 포팅 절차](references/pptx.md),
동봉 [deck.html](deck.html)을 사용한다. `SKILL_DIR`은 이 폴더의 절대 경로다.

1. 원고를 동봉 템플릿의 White Cobalt 시트로 구성하고 읽기 HTML을 만든다.
2. **콘텐츠에 맞는 템플릿이 없으면 같은 스킨의 새 레이아웃을 만들어 사용한다.**
   기존 칸에 억지로 맞추지 않고 새 배치를 설계·검증한다.
3. 시트의 좌표·글꼴·도형·표·이미지를 측정해 작업별 PptxGenJS 생성기로 옮긴다.
   웹 UI는 제외하고 설명·스크립트는 발표자 노트에 보존한다.
4. 원본 자산·차트 값·시퀀스 방향·코드 주석과 등장 타이밍을 그대로 옮긴다.
5. 동봉 노트·애니메이션 도구와 구조 검사를 실행하고 실제 앱에서 열어 렌더·재생을 확인한다.

표준 패키지는 동봉 `package.json`·`requirements.txt`로 준비한다.
HTML 조립·검사와 PowerPoint 포팅에 필요한 도구는 모두 폴더 안에 있다.
작업별 생성기를 작성하는 에이전트 과정이 필요하며 임의 HTML 자동 변환기로 설명하지 않는다.

```sh
npm install --prefix "$SKILL_DIR" --no-audit --no-fund
DECK_QA_DIR="$PWD/output/reference" node "$SKILL_DIR/scripts/reference.cjs"
```

`reference.cjs`는 **6장짜리 네이티브 작성 예제**이지 사용자 원고를 변환하는 실행기가 아니다.
자세한 출력·노트·애니메이션 처리와 독립 생성기 작성법은 동봉 PPTX 지침을 따른다.

순백·니어블랙·코발트, IBM Plex Sans KR/Archivo, 각진 블록·가는 선을 유지한다.
동봉 `build_pptx.js --theme white-cobalt`는 **명시적으로 재조판이 허용된 경우만** 쓰는
호환 생성기다. 색만 바꾸는 방식으로 원래 White Cobalt HTML을 보존했다고 하지 않는다.
구조 검사는 실제 PowerPoint나 전체 ISO 스키마 검증을 대신하지 않으며, 미실행 검사는 밝힌다.
기존 PPTX 입력은 신규 디자인보다 원본 내용·배치·자산을 우선한다.
