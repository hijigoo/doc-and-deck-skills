---
name: white-cobalt-pptx-to-html
description: PPTX의 원본 내용·배치·자산을 보존하고 White Cobalt 읽기 UI를 덧붙입니다. 추출·원본 렌더 보존·검사 도구와 셸을 포함해 이 폴더 하나로 사용합니다.
---

# PPTX → 원본 보존 · White Cobalt 읽기 UI

**최종 전달물은 자원을 내장한 HTML 파일 하나다.**
[단일 HTML 마감 절차](references/single-file-html.md)를 반드시 수행한다.
추출 정보·원본 렌더·페이지와 자산 폴더는 내부 작업용이며 최종 HTML 안에 필요한 내용을 포함한다.

**이 폴더만 복사해 사용한다.** 원래 레포·형제 스킬·별도 `pptx` 스킬은 필수가 아니다.
[독립 사용 규칙](references/guide.md), [원본 보존 절차](references/source-preservation.md),
동봉 [deck.html](deck.html)을 사용한다. `SKILL_DIR`은 이 폴더의 절대 경로다.

1. 전체 장의 순서·종횡비·숨김·노트·그룹·마스터/레이아웃·SVG 대체 그림을 확인한다.
2. 제목·본문·수치·표의 모든 행/열·그림·각주·출처를 보존한다. 요약·교정·재배치를 기본으로 하지 않는다.
3. 이미지·로고·아이콘을 원본 파일로 복사하고 해시·크롭·회전·투명도·비율·레이어를 대조한다.
   유사 아이콘이나 이모지로 대체하거나 테마에 맞춰 재색상하지 않는다.
4. White Cobalt는 목차·스크롤·설명 등 바깥 읽기 UI에만 적용한다.
   원본 시트를 이 스킬의 신규 원고용 예제에 끼워 맞추지 않는다.
5. 복잡한 차트·도형을 직접 이식하기 어렵다면 원본 앱의 PDF/SVG/이미지로 보존한다.
   원본은 그대로 두고 숨김 장 처리는 작업 복사본에서만 한다.
6. 모든 장의 시각·텍스트·표·미디어·노트·링크·페이지 대응을 확인한다. 넘침 0만으로 끝내지 않는다.

동봉 `requirements.txt`와 `package.json`으로 필요한 표준 패키지를 준비한다.
PDF 내보내기는 PowerPoint 또는 LibreOffice, 이미지 변환은 Poppler가 필요하다.
다른 레포의 파일을 찾거나 다운로드하는 대신 동봉 도구만 사용한다.

```sh
.venv/bin/python "$SKILL_DIR/scripts/extract_pptx.py" input.pptx \
  --json output/source.json --img-dir output/images
.venv/bin/python "$SKILL_DIR/scripts/preserve_pptx.py" input.pptx \
  --pdf all-slides.pdf --out output/source-web --renderer "Microsoft PowerPoint"
node "$SKILL_DIR/scripts/verify.cjs" output/source-web/index.html
```

렌더러 이름은 실제 내보낸 앱과 일치시킨다. 시트 전체를 이미지로 표시한 경우 **정적 원본 렌더**임을
밝히고 편집 가능한 HTML·애니메이션·영상 복제로 주장하지 않는다. 텍스트 복사용 전사와 링크 목적지는 별도 보존한다.

원본 노트를 우선하고 추가 설명은 구분한다. 원문 수정이나 요약은 별도 요청이 있을 때만 한다.
패키저로 `pages/`, `assets/`, `manifest.json` 링크를 내장한 최종 HTML 하나만 전달한다.
