# 단일 HTML 최종 산출물

이 스킬의 기본 전달물은 **완성된 HTML 파일 하나**다. 외부 폰트·이미지·스타일·스크립트·
페이지 폴더 없이 다른 위치로 복사해 열 수 있어야 한다.
출처를 확인하기 위한 외부 링크는 남기되, 화면을 그리는 데 그 링크의 네트워크 응답을 요구하지 않는다.

## 내부 작업과 전달물 구분

원고, `chapters.fragment.html`, PDF 렌더, 이미지, 추출 JSON과 매니페스트는 내부 작업 폴더에 둔다.
`chapters.html`은 시트 본문 조각이지 완성 페이지가 아니다. 이를 결과물 링크로 전달하지 않는다.
topic-to-html도 조사 원고를 먼저 쓰지만 기본 전달물은 HTML 하나다.
사용자가 원고나 생성 코드를 별도로 요청한 경우에만 추가 파일을 제공한다.

1. 동봉 `deck.html`에 장을 조립해 완성 문서 구조를 만든다.
2. 이용 가능한 폰트를 로컬 `@font-face`로 준비하고 라이선스 고지를 HTML 내부에 남긴다.
   템플릿의 Google Fonts/CDN 링크는 준비한 로컬 폰트 선언으로 대체한다. 폰트 대체는 명시한다.
3. 로컬 자원 경로가 유효한 조립본에 패키저를 실행한다.
4. 결과 HTML만 빈 임시 폴더로 복사하고 네트워크를 끈 브라우저에서 모든 장과 조작을 확인한다.
5. 최종 HTML 하나와 보존 범위·확인하지 못한 사항을 안내한다.

```sh
python3 "$SKILL_DIR/scripts/standalone_html.py" work/assembled.html --out output/document.html
node "$SKILL_DIR/scripts/verify.cjs" output/document.html
```

PPTX 보존 경로에서는 `preserve_pptx.py`가 만든 `work/source-web/index.html`을 입력으로 사용하며
`--manifest work/source-web/manifest.json`을 추가한다. 원본 `source.pptx`와 `source.pdf`도
그 작업 폴더에 준비한다. 원본/PDF/미디어와 보존 JSON이 HTML 내부 다운로드로 포함된다.
`pages/`, `assets/`, 원본 다운로드와 `manifest.json`에 대한 로컬 링크는 data URI로 내장한다.
별도 전사와 노트, 목차·해시 링크를 유지한다. 정적 시트 렌더를 편집 가능한 HTML이라고 설명하지 않는다.
내장 SVG를 새 탭에서 여는 링크는 클릭 시 Blob URL로 바뀐다.
브라우저가 최상위 data URL 탐색을 차단해도 원본 크게 보기가 동작하도록 한 처리다.

## 패키저 범위와 실패 처리

CSS 파일과 `@import`·`url()`, 일반 스크립트 파일, 이미지·폰트·SVG·object의 로컬 자원을 내장한다.
이미 data URI인 자원과 문서 내 `#` 링크는 유지한다.
포함한 자원의 파일명·SHA-256은 HTML 내부 `standalone-provenance` JSON에 기록한다.
누락된 파일, 순환 참조, 지원하지 않는 자원 형식은 오류로 종료한다.

기본은 오프라인 패키징이다. 외부 자원 다운로드가 명시적으로 허용된 작업에서만
`--allow-remote`를 사용한다. 이 옵션이 있어도 자원 이용 권한과 라이선스를 별도로 확인한다.
인증이 필요한 URL이나 비밀 값을 넣지 않는다.

`srcset`은 하나의 `src`로 확정한다. 외부 모듈·`async`·`defer` 스크립트는
실행 순서가 달라질 수 있어 거절하며 먼저 번들링하거나 동등한 인라인 실행 순서를 준비한다.
`iframe`, `<base>`, 스크립트·foreignObject가 포함된 외부 SVG는 별도 준비가 필요하다.
동적 JavaScript의 `fetch`, CSS/JS에서 런타임에 만드는 URL까지 자동 분석하는 도구는 아니다.
그런 기능은 제거·내장하거나 미지원 사항으로 보고하며, 단일 파일 성공으로 조용히 처리하지 않는다.

## 최종 확인

- 파일 하나만 옮겨도 글꼴·이미지·모든 시트와 노트가 나온다.
- 외부 HTTP 요청과 누락된 로컬 자원, 브라우저 오류가 없다.
- 목차·해시 이동·노트 접기·모바일·인쇄 기능을 유지한다.
- 원본 본문·표·출처·노트와 결과가 대응한다.
- 정적 이미지 영역, 대체 폰트, 생략한 기능과 미실행 검사를 명확히 안내한다.
