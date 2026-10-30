# pptx-to-html

PowerPoint 한 개를 **원본 슬라이드와 발표 노트가 담긴 HTML 파일 하나**로 만드는 에이전트 스킬입니다.

## 사용법

폴더 전체를 `~/.copilot/skills/pptx-to-html/`에 복사하고 Copilot CLI에서 `/skills reload`를 실행합니다.
대화창에 입력 파일만 지정하세요.

```text
/pptx-to-html "발표 자료.pptx"
```

기본 결과는 입력과 같은 폴더의 `발표 자료.html`입니다.
폰트·이미지·스타일·스크립트가 내장되어 HTML 하나만 열거나 공유하면 됩니다.
GitHub 업로드와 배포는 별도 요청이 있을 때만 수행합니다.

## 보존 범위

- 원본 순서·비율을 유지한 슬라이드 이미지
- 실제 제목·발표 노트·복사 및 검색용 텍스트·링크
- 숨김 슬라이드의 원래 상태 표시와 원본·이미지 해시 기록

White Cobalt는 목차·노트 접기·확대·키보드 조작·인쇄를 제공하는 바깥 UI에만 적용합니다.
원본 슬라이드는 다시 디자인하지 않으며, 원본 파일 대신 작업 복사본으로 처리합니다.

## 필요한 환경

- **Microsoft PowerPoint**: 직접 PDF를 내보냅니다. 없거나 내보내기에 실패하면 중단하며 LibreOffice로 대체하지 않습니다.
- **Poppler**: `pdfinfo`, `pdftoppm`으로 페이지를 확인하고 너비 2400px 이상의 PNG를 만듭니다.
- **Python 3**: 내용 추출과 HTML 조립에 사용합니다. `python-pptx`가 없으면 ZIP/XML로 추출합니다.
- **브라우저**: 오프라인·PC·모바일·인쇄 결과를 확인합니다.

macOS 자동화에는 작업 폴더 접근과 PowerPoint 앱 제어 권한이 필요할 수 있습니다.

## 기존 스킬과의 차이

`deep-navy-pptx-to-html`과 `white-cobalt-pptx-to-html`은 테마별 독립 스킬입니다.
이 스킬은 **PowerPoint 직접 렌더를 필수로 하는 단일 파일 공유 경로**입니다.
기존 Foundry 샘플은 이 스킬의 결과가 아니며, 전용 샘플과 실제 변환 검증 결과는 아직 없습니다.

결과는 정적 최종 화면이며 애니메이션 중간 단계·동영상·편집 가능한 슬라이드를 재현하지 않습니다.

## 구성

- [SKILL.md](SKILL.md): 변환·조립·완성 확인 절차
- [screenshots.md](screenshots.md): PowerPoint 내보내기·PNG 생성
- [template.html](template.html): 내장 폰트·라이선스와 읽기 UI
