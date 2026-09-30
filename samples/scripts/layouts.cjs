const fs = require("node:fs");
const crypto = require("node:crypto");
const FONTS = `
@font-face{font-family:Pretendard;src:url('../assets/fonts/Pretendard-Regular.otf');font-weight:400}
@font-face{font-family:Pretendard;src:url('../assets/fonts/Pretendard-Bold.otf');font-weight:700}
@font-face{font-family:'Pretendard Variable';src:url('../assets/fonts/Pretendard-Regular.otf');font-weight:400}
@font-face{font-family:'Pretendard Variable';src:url('../assets/fonts/Pretendard-Bold.otf');font-weight:700}
@font-face{font-family:'IBM Plex Sans KR';src:url('../assets/fonts/IBMPlexSansKR-Regular.ttf');font-weight:400}
@font-face{font-family:'IBM Plex Sans KR';src:url('../assets/fonts/IBMPlexSansKR-Bold.ttf');font-weight:700}
@font-face{font-family:Manrope;src:url('../assets/fonts/Manrope.ttf');font-weight:200 800}
@font-face{font-family:Archivo;src:url('../assets/fonts/Archivo.ttf');font-weight:100 900}
@font-face{font-family:'IBM Plex Mono';src:url('../assets/fonts/IBMPlexMono-Regular.ttf');font-weight:400}
`;
const LAYOUTS = ["cover", "contrast", "architecture", "process", "matrix", "scenario", "checklist",
  "evidence", "roadmap", "dataflow", "sequence", "network", "metrics", "walkthrough",
  "decision", "pyramid", "funnel", "riskmap", "swimlane", "closing"];
const escape = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const digest = data => crypto.createHash("sha256").update(data).digest("hex");

// Only the existing diagram's labels change; its nodes, edges and geometry remain.
const diagramText = {
  dataflow: {
    "입력 검증과 활용 분기": "문서 준비와 활용 분기", "문자열→숫자 정규화·저장→조회·집계 분기.": "가상 설계: 문서 정제 후 검색 자료를 답변 근거와 평가 기록으로 연결한다.",
    "검증 · 정규화": "문서 정제", "숫자 12 · 단위 확인": "ID · 접근 범위",
    "레코드 저장": "검색 자료", "키 + 정규화 값": "조각 + 문서 ID", "원천 입력": "허용 문서",
    '문자열 금액 "12"': "본문 · 문서 ID", "조회 응답": "답변 근거", "키 · 금액만 선택": "관련 조각 선택",
    "묶음 요약표": "평가 기록", "분류별 금액 합계": "질문 · 근거 참조", "원본 행": "원문",
    "정규화 행": "문서 조각", "필드 선택": "검색", "묶음 집계": "검토",
    "수집 기록": "허용 문서", "혼합 형식": "본문 · 문서 ID", "중복 가능성": "접근 범위",
    "형식 정규화": "문서 정제", "필드 통일 · 중복 제거": "본문 분할 · 형식 정리", "원본 식별자 보존": "문서 ID 보존",
    "정제 기록": "검색 자료", "보고서": "답변", "조회 화면": "검토 기록",
    "원시 행": "원문", "정제 행": "문서 조각", "집계표": "근거", "조회 행": "참조",
    "가상 흐름: 원천→정제→저장→보고서·조회 화면. 실선은 데이터 전달.": "가상 Q&A 설계: 허용 문서→정제→검색 자료→답변·검토 기록。실선은 제안한 데이터 전달.",
  },
  sequence: {
    "클라이언트": "응용", "API": "에이전트", "저장소": "검색 도구",
    "1 · 키로 조회 요청": "1 · 질문 요청", "2 · 레코드 읽기 요청": "2 · 근거 검색",
    "3 · 레코드 반환": "3 · 근거 반환", "4 · 조회 결과 반환": "4 · 답변 반환",
    "1 · 조회 요청 / 조회 키": "1 · 질문 요청 / 업무 질문", "2 · 키 조회 / 조건": "2 · 근거 검색 / 허용 범위",
    "3 · 조회 응답 / 결과 행": "3 · 검색 응답 / 관련 근거", "4 · 결과 응답 / 표시 데이터": "4 · 답변 반환 / 근거 참조",
    "클라이언트·API·저장소의 조회 순서": "응용·에이전트·검색 도구의 가상 순서",
    "요청 1 클라이언트→API, 2 API→저장소. 응답 3 저장소→API, 4 API→클라이언트.": "요청 1 응용→에이전트, 2 에이전트→검색 도구. 응답 3 검색 도구→에이전트, 4 에이전트→응용. 모델 호출 등은 생략한 가상 예시.",
    "1 클라이언트→API 요청, 2 API→저장소 조회, 3 저장소→API 응답, 4 API→클라이언트 응답. 실선 요청, 점선 응답.": "가상 예시: 응용→에이전트→검색 도구 요청 후 근거·답변 반환. 실선 요청, 점선 응답. 추가 단계 생략.",
  },
  network: {
    "클라이언트": "직원", "외부 사용자": "직원", "앱": "Q&A 응용", "업무 응용": "Q&A 응용",
    "데이터": "문서", "업무 데이터": "허용 문서",
  },
  metrics: {
    "완료 건수 (건)": "검토 건수 (건)", "완료 건수": "검토 건수", "완료 건수 · 가상 예시": "검토 건수 · 가상 예시",
    "표본 가": "세트 A", "표본 나": "세트 B", "표본 다": "세트 C",
    "묶음 A": "세트 A", "묶음 B": "세트 B", "묶음 C": "세트 C", "묶음": "질문 세트",
    "축 0~100건. 가 40건, 나 65건, 다 85건. 아래 표와 같다.": "가상 검토 건수: 세트 A 40건, B 65건, C 85건. 축 0~100건이며 실측이 아니다.",
    "0~100건. 묶음 A 40건, 묶음 B 65건, 묶음 C 85건. 표와 같은 값이며 실측이 아닙니다.": "가상 검토 건수: 세트 A 40건, B 65건, C 85건. 축 0~100건이며 실측이 아니다.",
    "정의 / 완료 건수": "정의 / 검토 건수",
  },
};

function chapters(slides, theme, sources, templateFile) {
  if (JSON.stringify(slides.map(s => s.kind)) !== JSON.stringify(LAYOUTS)) {
    throw new Error(`The manuscript must cover all ${LAYOUTS.length} layouts exactly once, in template order.`);
  }
  const template = fs.readFileSync(templateFile, "utf8");
  const originals = [...template.matchAll(/<article\b[^>]*class="chapter"[^>]*>[\s\S]*?<\/article>/g)];
  const byLayout = new Map(originals.map(m => [m[0].match(/data-layout="([^"]+)"/)[1], m[0]]));
  if (byLayout.size !== LAYOUTS.length) throw new Error(`Expected ${LAYOUTS.length} actual templates: ${templateFile}`);
  const records = [];
  const html = slides.map((data, i) => {
    const original = byLayout.get(data.kind);
    if (!original) throw new Error(`Missing template ${data.kind}`);
    const slots = {
      ...data, eyebrow: `FOUNDRY / ${data.kind.toUpperCase()}`,
      footer: "MICROSOFT LEARN · 2026-09-30",
    };
    (data.items || []).forEach((item, j) => {
      slots[`item${j + 1}-title`] = item.title;
      slots[`item${j + 1}-body`] = item.desc;
    });
    (data.head || []).forEach((cell, j) => { slots[`head${j + 1}`] = cell; });
    (data.rows || []).forEach((row, r) => row.forEach((cell, c) => { slots[`cell${r + 1}-${c + 1}`] = cell; }));
    (data.values || []).forEach((value, j) => { slots[`value${j + 1}`] = `${value}${theme === "white-cobalt" ? "건" : ""}`; });
    let chapter = original;
    if (data.kind === "walkthrough") {
      const prefix = theme === "deep-navy" ? "dn" : "wc";
      const code = data.code.map((line, n) => `<span id="${prefix}-code-line-${n + 1}" data-code-line="${n + 1}"><i aria-hidden="true">${String(n + 1).padStart(2, "0")}</i> ${escape(line)}</span>`).join("");
      chapter = chapter.replace(/<pre><code>[\s\S]*?<\/code><\/pre>/, `<pre><code>${code}</code></pre>`);
      if (theme === "deep-navy") {
        chapter = chapter.replace(/(href="#|data-callout-for=")dn-code-line-([123])"/g,
          (_, prefix, line) => `${prefix}dn-code-line-${Number(line) * 2}"`);
        chapter = chapter.replace("1 · 입력 확인", "02행 · 권한 확인").replace("2 · 값 변환", "04행 · 근거 부족").replace("3 · 응답 선택", "06행 · 참조 기록");
      } else {
        chapter = chapter.replace("02행 · 입력 확인", "02행 · 권한 확인").replace("04행 · 조건 검사", "04행 · 근거 부족").replace("06행 · 결과 구성", "06행 · 참조 기록")
          .replace("비어 있는 입력을 구분합니다.", escape(data.context))
          .replace("불완전한 행을 제외합니다.", escape(data.insight))
          .replace("통과한 행으로 요약합니다.", escape(data.caution));
      }
    }
    chapter = chapter.replace(/<!-- slot:([^:]+):start -->[\s\S]*?<!-- slot:\1:end -->/g, (_, key) => {
      if (typeof slots[key] !== "string") throw new Error(`${theme}/${data.kind}: missing slot ${key}`);
      return escape(slots[key]);
    });
    const replacements = diagramText[data.kind] || {};
    chapter = chapter.replace(/>([^<>]+)</g, (whole, text) => Object.hasOwn(replacements, text) ? `>${escape(replacements[text])}<` : whole);
    if (data.kind === "sequence") {
      chapter = chapter.replace(/data-(participant|from|to)="(client|api|store)"/g,
        (_, attr, value) => `data-${attr}="${{ client: "application", api: "agent", store: "search" }[value]}"`);
    }
    chapter = chapter.replace(/(<h2 class="ch-t">)[\s\S]*?(<\/h2>)/, `$1${escape(data.title)}$2`)
      .replace(/data-part="[^"]*"/, 'data-part="Microsoft Foundry"')
      .replace(/(<span class="ch-part">)[\s\S]*?(<\/span>)/, "$1FOUNDRY$2");
    const note = data.notes.split("\n\n").map(p => `<p>${escape(p).replace(/\n/g, "<br>")}</p>`).join("");
    const links = data.sources.map(id => `<li><a href="${sources[id].url}">${escape(sources[id].title)}</a> · 확인 2026-09-30</li>`).join("");
    chapter = chapter.replace(/(<div class="note-body">)[\s\S]*?(<\/div>\s*<\/aside>)/,
      `$1${note}<h3>출처</h3><ul>${links}</ul>$2`);
    records.push({ slide: i + 1, layout: data.kind, template_sha256: digest(original), chapter_sha256: digest(chapter) });
    return chapter;
  }).join("\n");
  return { html, records, template_sha256: digest(template) };
}

function offlineFonts(html, fontBase = "../assets/fonts/") {
  const navy = html.includes("--f-display:");
  const fonts = FONTS.split("\n").filter(line => !line || line.includes("IBM Plex Mono") ||
    (navy ? /Pretendard|Manrope/.test(line) : /Sans KR|Archivo/.test(line))).join("\n")
    .replaceAll("../assets/fonts/", fontBase);
  return html.replace(/<link\b[^>]*href="https:[^"]*"[^>]*>/g, "")
    .replace("</head>", `<style>${fonts}
      .layout-walkthrough pre code [data-code-line]{display:block;white-space:pre}
      .layout-walkthrough pre code i{font-style:normal}
    </style></head>`);
}
module.exports = { LAYOUTS, chapters, offlineFonts, escape };
