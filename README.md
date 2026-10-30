# doc-and-deck-skills

Markdown 원고나 주제에서 **읽기 좋은 HTML 문서와 PowerPoint 프레젠테이션**을 만드는 스킬 모음입니다.
**Deep Navy**와 **White Cobalt** 두 가지 디자인을 제공하며, 각 테마에는 20종의 템플릿이 있습니다.
테마별 스킬 10개와 **원본 PowerPoint를 보존하는 `pptx-to-html` 스킬**로 구성됩니다.

## 설치

```sh
git clone https://github.com/hijigoo/doc-and-deck-skills.git
mkdir -p ~/.copilot/skills
cp -R doc-and-deck-skills/skills/* ~/.copilot/skills/
```

설치한 뒤 Copilot CLI에서 `/skills reload`를 실행하면 사용할 수 있습니다.
원하는 스킬 폴더만 설치해도 됩니다. 이때 `SKILL.md`만 복사하지 말고 **폴더 전체**를 복사하세요.

## 사용법

에이전트 대화창에서 스킬 이름 뒤에 **입력 파일 또는 만들고 싶은 주제**를 입력하세요.
필요하면 대상 독자, 목적, 다룰 내용을 함께 적으면 됩니다.
디자인과 템플릿 선택, 출력 형식, HTML 구성과 검사는 스킬이 처리하므로 따로 지정하지 않아도 됩니다.

### Deep Navy

```text
/deep-navy-md-to-html notes.md
/deep-navy-topic-to-html 개발팀을 위한 Microsoft Foundry 소개. 모델 선택, 에이전트 개발, 평가와 운영을 다뤄줘.
/deep-navy-md-to-pptx notes.md
/deep-navy-html-to-pptx deck.html
/deep-navy-pptx-to-html slides.pptx
```

### White Cobalt

```text
/white-cobalt-md-to-html notes.md
/white-cobalt-topic-to-html 개발팀을 위한 Microsoft Foundry 소개. 모델 선택, 에이전트 개발, 평가와 운영을 다뤄줘.
/white-cobalt-md-to-pptx notes.md
/white-cobalt-html-to-pptx deck.html
/white-cobalt-pptx-to-html slides.pptx
```

### pptx-to-html · 원본 PowerPoint 보존

```text
/pptx-to-html "발표 자료.pptx"
```

원본 슬라이드와 발표 노트를 같은 폴더의 `발표 자료.html` 하나로 변환합니다.
**Microsoft PowerPoint가 필수**이며 LibreOffice로 대체하지 않습니다.
White Cobalt는 바깥 읽기 UI에만 적용하고 원본 슬라이드는 다시 디자인하지 않습니다.
슬라이드 순서와 비율, 제목, 노트, 원문 텍스트와 링크를 보존하고 목차·노트 접기·확대·인쇄 기능을 제공합니다.
결과는 정적 화면이며 애니메이션, 동영상, 편집 가능한 슬라이드는 재현하지 않습니다.
자세한 내용은 [pptx-to-html 스킬 지침](skills/pptx-to-html/SKILL.md)을 참고하세요.

## 스킬

테마별 스킬 10개의 이름은 `<테마>-<경로>` 형식입니다. 테마는 `deep-navy` 또는 `white-cobalt`입니다.
표의 경로에 테마를 붙이면 실제 스킬 이름이 됩니다.

| 경로 | 입력 → 출력 | Deep Navy 샘플 | White Cobalt 샘플 |
|---|---|---|---|
| `md-to-html` | Markdown → HTML | [HTML 보기](https://hijigoo.github.io/doc-and-deck-skills/samples/deep-navy-md-to-html/foundry.html) | [HTML 보기](https://hijigoo.github.io/doc-and-deck-skills/samples/white-cobalt-md-to-html/foundry.html) |
| `topic-to-html` | 주제 → 조사 → HTML | [HTML 보기](https://hijigoo.github.io/doc-and-deck-skills/samples/deep-navy-topic-to-html/topic.html) | [HTML 보기](https://hijigoo.github.io/doc-and-deck-skills/samples/white-cobalt-topic-to-html/topic.html) |
| `md-to-pptx` | Markdown → PPTX | [PPTX](samples/deep-navy-md-to-pptx/foundry.pptx) | [PPTX](samples/white-cobalt-md-to-pptx/foundry.pptx) |
| `html-to-pptx` | HTML → PPTX | [PPTX](samples/deep-navy-html-to-pptx/foundry.pptx) | [PPTX](samples/white-cobalt-html-to-pptx/foundry.pptx) |
| `pptx-to-html` | PPTX → HTML | [HTML 보기](https://hijigoo.github.io/doc-and-deck-skills/samples/deep-navy-pptx-to-html/index.html) | [HTML 보기](https://hijigoo.github.io/doc-and-deck-skills/samples/white-cobalt-pptx-to-html/index.html) |

| 별도 스킬 | 입력 → 출력 | 특징 |
|---|---|---|
| [`pptx-to-html`](skills/pptx-to-html/SKILL.md) | PPTX → 단일 HTML | `/pptx-to-html`로 실행합니다. PowerPoint 직접 렌더가 필수이며 원본 화면과 노트를 보존하고 White Cobalt 읽기 UI를 적용합니다. |

- **HTML 보기**를 클릭하면 GitHub Pages에서 바로 열립니다. HTML 결과는 폰트·이미지·스크립트를 내장한 단일 파일로, 내려받아 오프라인에서도 볼 수 있습니다.
- HTML 결과에는 목차, 장별 설명과 발표 스크립트, 키보드 조작, 모바일·인쇄 레이아웃이 포함됩니다.
- 테마별 `pptx-to-html`은 테마에 맞는 읽기 화면을 만들고, 별도 `/pptx-to-html`은 원본 슬라이드 화면을 그대로 보존합니다.

테마별 스킬 10개의 샘플은 Microsoft Foundry를 주제로 만든 20장 자료입니다.
별도 `/pptx-to-html` 스킬의 전용 샘플은 아직 없습니다. 자세한 내용은 [samples/README.md](samples/README.md)를 참고하세요.

## 템플릿 20종

`cover` · `contrast` · `architecture` · `process` · `matrix` · `scenario` · `checklist` ·
`evidence` · `roadmap` · `dataflow` · `sequence` · `network` · `metrics` · `walkthrough` ·
`decision` · `pyramid` · `funnel` · `riskmap` · `swimlane` · `closing`

전체 디자인은 [Deep Navy 갤러리](https://hijigoo.github.io/doc-and-deck-skills/skills/deep-navy-md-to-html/deck.html)와
[White Cobalt 갤러리](https://hijigoo.github.io/doc-and-deck-skills/skills/white-cobalt-md-to-html/deck.html)에서 확인할 수 있습니다.
기존 템플릿이 내용에 맞지 않으면 같은 디자인 원칙에 따라 새 레이아웃을 만듭니다.

![Deep Navy 샘플: 표지부터 마무리까지 20종 템플릿](samples/previews/deep-navy-md-to-html/overview.png)

![White Cobalt 샘플: 표지부터 마무리까지 20종 템플릿](samples/previews/white-cobalt-md-to-html/overview.png)

## 요구 사항

- HTML 보기: 브라우저
- HTML 조립: Python 3.9+
- PPTX 생성·검사: Node.js 22+, 각 스킬의 `package.json`·`requirements.txt`
- PPTX 미리보기: LibreOffice 또는 PowerPoint, Poppler
- `pptx-to-html`: **Microsoft PowerPoint**, Python 3, Poppler 필수. macOS 자동화에는 앱 제어 권한이 필요할 수 있습니다.

## 샘플 다시 만들기

저장소 루트에서 아래 명령을 실행합니다.

```sh
npm --prefix samples ci
python3 -m venv samples/.venv && samples/.venv/bin/pip install -r samples/requirements.txt
PYTHON="$PWD/samples/.venv/bin/python" npm --prefix samples run build
npm --prefix samples test && npm --prefix samples run verify
```

## 참고

- PPTX에는 폰트를 포함하지 않았습니다. [동봉 폰트](samples/assets/fonts/)를 설치하거나 PDF로 확인하세요.
- PowerPoint 앱에서의 열기와 애니메이션 재생은 직접 확인하지 않았습니다.
- 샘플의 절차·수치·코드는 설명용 예시이며 실제 배포나 성능 측정 결과가 아닙니다.
