import { NextRequest, NextResponse } from "next/server";

type ParsedCurriculum = {
  title?: string;
  text: string;
  sectionCount: number;
  lectureCount: number;
};

function isSupportedNjoblerUrl(url: URL) {
  return (
    (url.hostname === "njobler.net" || url.hostname === "www.njobler.net") &&
    /^\/product\/lecture\/show\/prod\/\d+\/?$/.test(url.pathname)
  );
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function htmlToLines(html: string) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|li|ul|ol|h[1-6]|tr|td|section|article|button|span)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeHtml(text)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function getCourseTitle(lines: string[]) {
  return lines.find((line) => line.includes("정보처리") || line.includes("클래스"))?.replace(/^#+\s*/, "");
}

function isDurationLine(line: string) {
  return /^\d+\s*분$/.test(line);
}

function isNumberedLessonLine(line: string) {
  return /^\d+\.\s+.+/.test(line);
}

function parseOriginalLessonNumber(line: string) {
  return line.match(/^(\d+)\.\s+(.+)/);
}

function cleanNumberedLessonTitle(line: string) {
  return line
    .replace(/^\d+\.\s+/, "")
    .replace(/\s+\d+\s*분.*$/, "")
    .trim();
}

function isNoiseLine(line: string) {
  return (
    line.includes("무료보기") ||
    line.includes("전체 커리큘럼") ||
    line === "개" ||
    line.includes("클래스 소개") ||
    line.includes("커리큘럼") ||
    line.includes("크리에이터") ||
    line.includes("추천도서") ||
    line.includes("클래스 후기") ||
    line.includes("환불정책") ||
    line.includes("추천클래스") ||
    line.includes("바로결제") ||
    line.includes("장바구니")
  );
}

function isSectionCandidate(line: string) {
  return Boolean(line) && !isNoiseLine(line) && !isDurationLine(line) && !isNumberedLessonLine(line);
}

function extractCurriculumLines(lines: string[]) {
  const startIndex = lines.findLastIndex((line) => line.includes("· 커리큘럼") || line === "커리큘럼");
  if (startIndex < 0) {
    throw new Error("커리큘럼 영역을 찾지 못했습니다.");
  }

  const afterStart = lines.slice(startIndex + 1);
  const endIndex = afterStart.findIndex((line, index) => index > 5 && line.includes("· 크리에이터"));

  return (endIndex >= 0 ? afterStart.slice(0, endIndex) : afterStart).filter((line) => !isNoiseLine(line));
}

function parseCurriculum(html: string): ParsedCurriculum {
  const lines = htmlToLines(html);
  const curriculumLines = extractCurriculumLines(lines);
  const output: string[] = [];
  const seenSections = new Set<string>();
  let currentSectionId = "";
  let sectionCount = 0;
  let lectureCount = 0;
  let sectionLectureIndex = 0;

  function startSection(title: string) {
    if (seenSections.has(title)) {
      currentSectionId = title;
      return;
    }

    seenSections.add(title);
    currentSectionId = title;
    sectionLectureIndex = 0;
    sectionCount += 1;
    output.push(`# ${title}`);
  }

  function pushLecture(title: string, originalNumber?: string) {
    lectureCount += 1;
    sectionLectureIndex += 1;
    output.push(`${originalNumber ?? sectionLectureIndex}. ${title}`);
  }

  curriculumLines.forEach((line, index) => {
    const numberedMatch = parseOriginalLessonNumber(line);
    if (numberedMatch) {
      const sectionTitle = findNearestSectionTitle(curriculumLines, index);
      if (sectionTitle && sectionTitle !== currentSectionId) {
        startSection(sectionTitle);
      }
      pushLecture(cleanNumberedLessonTitle(line), numberedMatch[1]);
      return;
    }

    if (!isDurationLine(line)) {
      return;
    }

    const lectureTitle = curriculumLines[index - 1];
    if (!lectureTitle || !isSectionCandidate(lectureTitle)) {
      return;
    }

    const sectionTitle = findNearestSectionTitle(curriculumLines, index - 1);
    if (sectionTitle && sectionTitle !== currentSectionId) {
      startSection(sectionTitle);
    }

    pushLecture(lectureTitle);
  });

  if (lectureCount === 0) {
    throw new Error("가져올 수 있는 강의 목록을 찾지 못했습니다.");
  }

  return {
    title: getCourseTitle(lines),
    text: output.join("\n"),
    sectionCount,
    lectureCount,
  };
}

function findNearestSectionTitle(lines: string[], lectureTitleIndex: number) {
  for (let index = lectureTitleIndex - 1; index >= Math.max(0, lectureTitleIndex - 5); index -= 1) {
    const candidate = lines[index];
    if (isDurationLine(candidate)) {
      break;
    }

    if (isSectionCandidate(candidate) && candidate !== lines[lectureTitleIndex]) {
      return candidate;
    }
  }

  return undefined;
}

async function readHtml(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  const charset = contentType.match(/charset=([^;\s]+)/i)?.[1]?.toLowerCase();
  const bytes = await response.arrayBuffer();

  if (charset?.includes("euc") || charset?.includes("ks_c_5601")) {
    return new TextDecoder("euc-kr").decode(bytes);
  }

  const utf8 = new TextDecoder("utf-8").decode(bytes);
  if (!utf8.includes("커리큘럼") && /[ìëí][\u0080-\u00ff]/.test(utf8)) {
    return new TextDecoder("euc-kr").decode(bytes);
  }

  return utf8;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { url?: string };
    if (!body.url) {
      return NextResponse.json({ error: "URL을 입력하세요." }, { status: 400 });
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL(body.url);
    } catch {
      return NextResponse.json({ error: "올바른 URL 형식이 아닙니다." }, { status: 400 });
    }

    if (!isSupportedNjoblerUrl(targetUrl)) {
      return NextResponse.json(
        { error: "현재는 njobler.net/product/lecture/show/prod/ 형식의 강의 페이지 URL만 지원합니다." },
        { status: 400 },
      );
    }

    const response = await fetch(targetUrl.toString(), {
      headers: {
        "user-agent": "Mozilla/5.0 LectureTracker/1.0",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "강의 페이지를 불러오지 못했습니다. URL을 확인한 뒤 다시 시도하세요." },
        { status: 502 },
      );
    }

    const html = await readHtml(response);
    const parsed = parseCurriculum(html);

    return NextResponse.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "커리큘럼을 가져오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
