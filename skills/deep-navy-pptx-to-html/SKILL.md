---
name: deep-navy-pptx-to-html
description: PPTX를 원본 우선으로 읽는 HTML에 옮깁니다. 독립 폴더에 추출·보존·검사 도구와 Deep Navy 읽기 셸을 포함합니다. 원본 문구·표·배치·이미지·노트·순서를 유지합니다.
---

# PPTX → 원본 보존 · Deep Navy 읽기 UI

**최종 전달물은 자원을 내장한 HTML 파일 하나다.**
[단일 HTML 마감 절차](references/single-file-html.md)를 반드시 수행한다.
추출 정보·원본 렌더·페이지와 자산 폴더는 내부 작업용이며 최종 HTML 안에 필요한 내용을 포함한다.

**이 폴더만 복사해 사용한다.** 원래 레포·형제 스킬·별도 `pptx` 스킬은 필수가 아니다.
[독립 사용 규칙](references/guide.md)과 [원본 보존 절차](references/source-preservation.md)를 읽는다.
읽기 셸은 동봉 [deck.html](deck.html)이다. `SKILL_DIR`은 이 폴더의 절대 경로다.

1. 원본 장 수·순서·종횡비·숨김 상태·노트·마스터/레이아웃·그룹·SVG 대체 표현을 확인한다.
2. 문구·제목·수치·표의 모든 행/열·이미지·아이콘·각주·출처를 보존한다.
   본문을 줄이고 접힌 상세에만 원문을 남기는 것은 누락이다.
3. 원본 자산은 파일 그대로 복사하고 해시·크롭·회전·투명도·비율·레이어를 유지한다.
   비슷한 아이콘·이모지로 대체하거나 네이비 색으로 다시 그리지 않는다.
4. Deep Navy는 좌측 목차·스크롤·설명 등 바깥 UI에만 적용한다.
   원본 시트 디자인이 스킨과 충돌하면 원본이 우선이다.
5. 복잡한 도형은 원래 앱의 PDF/SVG/이미지로 보존할 수 있다. 원본을 수정하지 않고
   작업용 복사본에서 모든 페이지가 나오게 한다.
6. 전 장 원본 렌더, 텍스트·표·자산 해시·노트·링크·숨김 상태를 대조한다.

Python 의존성은 동봉 `requirements.txt`, 브라우저 검사는 동봉 `package.json`을 사용한다.
원본 렌더에는 PowerPoint 또는 LibreOffice와 Poppler가 필요하며 자동 설치돼 있다고 가정하지 않는다.

```sh
.venv/bin/python "$SKILL_DIR/scripts/extract_pptx.py" input.pptx \
  --json output/source.json --img-dir output/images
.venv/bin/python "$SKILL_DIR/scripts/preserve_pptx.py" input.pptx \
  --pdf all-slides.pdf --out output/source-web --renderer "Microsoft PowerPoint"
node "$SKILL_DIR/scripts/verify.cjs" output/source-web/index.html
```

렌더러 이름은 실제 사용한 앱을 적는다. 정적 원본 렌더를 편집 가능한 HTML이나 애니메이션·영상
복제로 설명하지 않는다. 링크 목적지는 보존하지만 정확한 클릭 영역까지 자동 복제하지 않는다.
패키저로 자산·페이지·매니페스트 링크를 내장한 `index.html` 하나만 전달한다.

원문이 오래되거나 오타처럼 보여도 몰래 고치지 않는다. 추가 해설은 원본 밖에 구분한다.
**요약·재구성은 별도 요청이 있을 때만** 수행하며, 신규 템플릿이 원본 보존보다 우선하지 않는다.
