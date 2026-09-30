# PPTX 원본을 독립적으로 웹에 보존하기

이 스킬의 `scripts/`와 `deck.html`만 사용한다. 별도 레포나 다른 스킬이 필요하지 않다.
`SKILL_DIR`과 실행 환경은 동봉 `guide.md`를 따른다.

## 1. 원본 확인

Python 환경에 스킬의 `requirements.txt`를 설치하고 추출한다.

```sh
.venv/bin/python "$SKILL_DIR/scripts/extract_pptx.py" input.pptx \
  --json output/source.json --img-dir output/images
```

원본 장 수·순서·표·노트·미디어·숨김 상태와 마스터/레이아웃·그룹을 직접 확인한다.
텍스트 추출만으로 시각 자료를 모두 파악했다고 하지 않는다. SVG-only 그림에는
일반 `a:blip/@r:embed` 대신 `asvg:svgBlip/@r:embed`만 있을 수 있다.
원본 자산은 유사 아이콘으로 대체하지 않는다.

## 2. 원래 프로그램에서 PDF 내보내기

가능하면 PowerPoint에서 모든 장을 PDF로 내보낸다. 원본은 수정하지 않는다.
숨김 장도 포함하려면 작업용 복사본에서만 표시하고 원래 순서와 PDF 페이지를 대조한다.
LibreOffice를 사용했다면 해당 렌더러를 표시하고 원본 PowerPoint와 같다고 단정하지 않는다.

```sh
soffice --headless --convert-to pdf --outdir output working-copy.pptx
```

이 명령이 숨김 장까지 포함하는지는 실제 파일로 확인한다. 페이지 누락을 무시하지 않는다.
복잡한 도형·특수 폰트가 다른 경우 원래 앱에서 내보낸 PDF를 사용한다.
앱이 없고 PDF도 제공되지 않았다면 정확한 원본 렌더 보존에 필요한 입력이 없다고 알린다.

## 3. 원본 렌더·자산·노트로 읽는 웹 만들기

Poppler의 `pdfinfo`, `pdftoppm`, `pdftocairo`가 필요하다. OS의 패키지 관리자로 설치한다.
동봉 도구는 원본의 종횡비를 유지하고 이 스킬의 읽기 셸만 적용한다.

```sh
.venv/bin/python "$SKILL_DIR/scripts/preserve_pptx.py" input.pptx \
  --pdf all-slides.pdf --out output/source-web --renderer "Microsoft PowerPoint"
node "$SKILL_DIR/scripts/verify.cjs" output/source-web/index.html
```

`--renderer`에는 **실제 PDF를 만든 앱**을 적는다. 원본 앱을 사용하지 않았는데 그 이름을
적지 않는다. PPTX/PDF 장 수가 다르면 중단하고 먼저 페이지 대응을 고친다.
여기서 만든 `index.html`, `pages/`, `assets/`, `manifest.json`은 내부 작업 산출물이다.
[단일 HTML 마감 절차](single-file-html.md)에 따라 원본/PDF와 보존 기록·자원을 내장한
최종 `index.html` 하나만 전달한다.

`manifest.json`에는 원본/PDF 해시·페이지 대응·미디어 해시·숨김 상태·노트·링크와
한계가 기록된다. 원본 `ppt/media/`의 파일을 바이트 그대로 복사하고 이미지·SVG를
본문 시트로 표시한다. 텍스트 복사용 전사와 노트는 시트 아래에 별도로 제공한다.

## 4. 원본과 대조

모든 페이지를 원본 PDF와 나란히 확인한다. 제목·표 전체·그림·주석·노트·링크·숨김
표시·자산 해시를 대조하고 한 장짜리 및 다른 종횡비도 임의로 16:9에 맞추지 않는다.
현재 방식은 **정적 원본 렌더**다. 편집 가능한 HTML 텍스트·영상·애니메이션·원본 링크의
정확한 클릭 영역은 자동으로 복제하지 않는다. 링크 목적지는 별도로 보존한다.

사용자가 편집 가능한 HTML을 반드시 요구하면 도형과 텍스트를 직접 이식하고 원본과
비교한다. 못 옮기는 부분을 이미지로 보존할 때는 밝히며, 요약한 카드로 바꾸지 않는다.
