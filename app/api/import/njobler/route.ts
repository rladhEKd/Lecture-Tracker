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

function isSupportedUricpaUrl(url: URL) {
  return (
    (url.hostname === "uricpa.com" || url.hostname === "www.uricpa.com") &&
    url.pathname.toLowerCase() === "/gcontents/cta/onlecture/eachclass/index.asp" &&
    url.searchParams.get("BoardMode")?.toLowerCase() === "detail" &&
    Boolean(url.searchParams.get("Goods_Idx"))
  );
}

function isSupportedNamucpaUrl(url: URL) {
  return (
    (url.hostname === "namucpa.com" || url.hostname === "www.namucpa.com") &&
    url.pathname.toLowerCase() === "/lecture/lectureondetail.asp" &&
    Boolean(url.searchParams.get("lecIDX"))
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
    .replace(/<\/?(p|div|li|ul|ol|h[1-6]|tr|td|th|table|section|article|button|span)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeHtml(text)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function getNjoblerCourseTitle(lines: string[]) {
  return lines.find((line) => line.includes("정보처리") || line.includes("클래스"))?.replace(/^#+\s*/, "");
}

function getUricpaCourseTitle(lines: string[]) {
  const titleLine = lines.find((line) => line.includes("강의명 :"));
  return titleLine?.replace(/^강의명\s*:\s*/, "").trim();
}

function getNamucpaCourseTitle(lines: string[]) {
  const titleLine = lines.find((line) => line.includes("강의명") && line.length < 120);
  return titleLine?.replace(/^강의명\s*:?\s*/, "").trim();
}

function isDurationLine(line: string) {
  return /^\d+\s*분$/.test(line);
}

function isNjoblerNumberedLessonLine(line: string) {
  return /^\d+\.\s+.+/.test(line);
}

function parseNjoblerOriginalLessonNumber(line: string) {
  return line.match(/^(\d+)\.\s+(.+)/);
}

function cleanNjoblerNumberedLessonTitle(line: string) {
  return line
    .replace(/^\d+\.\s+/, "")
    .replace(/\s+\d+\s*분.*$/, "")
    .trim();
}

function isNjoblerNoiseLine(line: string) {
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

function isNjoblerSectionCandidate(line: string) {
  return (
    Boolean(line) &&
    !isNjoblerNoiseLine(line) &&
    !isDurationLine(line) &&
    !isNjoblerNumberedLessonLine(line)
  );
}

function extractNjoblerCurriculumLines(lines: string[]) {
  const startIndex = lines.findLastIndex((line) => line.includes("· 커리큘럼") || line === "커리큘럼");
  if (startIndex < 0) {
    throw new Error("커리큘럼 영역을 찾지 못했습니다.");
  }

  const afterStart = lines.slice(startIndex + 1);
  const endIndex = afterStart.findIndex((line, index) => index > 5 && line.includes("· 크리에이터"));

  return (endIndex >= 0 ? afterStart.slice(0, endIndex) : afterStart).filter((line) => !isNjoblerNoiseLine(line));
}

function findNearestNjoblerSectionTitle(lines: string[], lectureTitleIndex: number) {
  for (let index = lectureTitleIndex - 1; index >= Math.max(0, lectureTitleIndex - 5); index -= 1) {
    const candidate = lines[index];
    if (isDurationLine(candidate)) {
      break;
    }

    if (isNjoblerSectionCandidate(candidate) && candidate !== lines[lectureTitleIndex]) {
      return candidate;
    }
  }

  return undefined;
}

function parseNjoblerCurriculum(html: string): ParsedCurriculum {
  const lines = htmlToLines(html);
  const curriculumLines = extractNjoblerCurriculumLines(lines);
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
    const numberedMatch = parseNjoblerOriginalLessonNumber(line);
    if (numberedMatch) {
      const sectionTitle = findNearestNjoblerSectionTitle(curriculumLines, index);
      if (sectionTitle && sectionTitle !== currentSectionId) {
        startSection(sectionTitle);
      }
      pushLecture(cleanNjoblerNumberedLessonTitle(line), numberedMatch[1]);
      return;
    }

    if (!isDurationLine(line)) {
      return;
    }

    const lectureTitle = curriculumLines[index - 1];
    if (!lectureTitle || !isNjoblerSectionCandidate(lectureTitle)) {
      return;
    }

    const sectionTitle = findNearestNjoblerSectionTitle(curriculumLines, index - 1);
    if (sectionTitle && sectionTitle !== currentSectionId) {
      startSection(sectionTitle);
    }

    pushLecture(lectureTitle);
  });

  if (lectureCount === 0) {
    throw new Error("가져올 수 있는 강의 목록을 찾지 못했습니다.");
  }

  return {
    title: getNjoblerCourseTitle(lines),
    text: output.join("\n"),
    sectionCount,
    lectureCount,
  };
}

function cleanUricpaLessonTitle(title: string) {
  return title
    .replace(/※자료 다운로드 시 환불이 불가한 점 참고바랍니다\./g, "")
    .replace(/\s+\d+\s*분.*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseUricpaLessonLine(line: string) {
  const match = line.match(/^(\d+)강\s+(.+?)(?:\s+\d+\s*분(?:\s+.*)?$|$)/);
  if (!match) {
    return null;
  }

  return {
    number: match[1],
    title: cleanUricpaLessonTitle(match[2]),
    hasDuration: /\d+\s*분/.test(line),
  };
}

function parseUricpaCurriculum(html: string): ParsedCurriculum {
  const lines = htmlToLines(html);
  const startIndex = lines.findLastIndex((line) => line === "강의목차");
  if (startIndex < 0) {
    throw new Error("강의목차 영역을 찾지 못했습니다.");
  }

  const afterStart = lines.slice(startIndex + 1);
  const endIndex = afterStart.findIndex((line) => line === "교재정보" || line.startsWith("교재명 :"));
  const curriculumLines = endIndex >= 0 ? afterStart.slice(0, endIndex) : afterStart;
  const output = ["# 강의목차"];
  let lectureCount = 0;
  let pendingLesson: { number: string; title: string } | null = null;
  let pendingNumber: string | null = null;

  function flushPendingLesson() {
    if (!pendingLesson) {
      return;
    }

    lectureCount += 1;
    output.push(`${pendingLesson.number}강 ${pendingLesson.title}`);
    pendingLesson = null;
  }

  curriculumLines.forEach((line) => {
    const numberOnlyMatch = line.match(/^(\d+)강$/);
    if (numberOnlyMatch) {
      flushPendingLesson();
      pendingNumber = numberOnlyMatch[1];
      return;
    }

    const lesson = parseUricpaLessonLine(line);
    if (lesson) {
      flushPendingLesson();

      if (lesson.hasDuration) {
        lectureCount += 1;
        output.push(`${lesson.number}강 ${lesson.title}`);
      } else {
        pendingLesson = { number: lesson.number, title: lesson.title };
      }
      return;
    }

    if (pendingNumber && !isDurationLine(line) && line !== "시간" && line !== "자료") {
      pendingLesson = {
        number: pendingNumber,
        title: cleanUricpaLessonTitle(line),
      };
      pendingNumber = null;
      return;
    }

    if (pendingLesson && isDurationLine(line)) {
      flushPendingLesson();
    }
  });

  flushPendingLesson();

  if (lectureCount === 0) {
    throw new Error("가져올 수 있는 강의목차를 찾지 못했습니다.");
  }

  return {
    title: getUricpaCourseTitle(lines),
    text: output.join("\n"),
    sectionCount: 1,
    lectureCount,
  };
}

function isNamucpaNoiseLine(line: string) {
  return (
    line === "회차" ||
    line === "제목" ||
    line === "페이지" ||
    line === "시간" ||
    line === "자료" ||
    line.includes("강의소개") ||
    line.includes("교재정보") ||
    line.includes("강사소개") ||
    line.includes("수강후기") ||
    line.includes("환불") ||
    line.includes("장바구니") ||
    line.includes("수강신청")
  );
}

function isNamucpaPageLine(line: string) {
  return /^(?:P|(?:연습서|유인물|교재|자료|프린트)?\s*\d+(?:-\d+)?P)$/i.test(line);
}

function cleanNamucpaLessonTitle(title: string) {
  return title
    .replace(/\s+\d+\s*분.*$/, "")
    .replace(/\s+(?:연습서|유인물|교재|자료|프린트)\s*\d+(?:-\d+)?P\s*$/i, "")
    .replace(/\s+P\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNamucpaLessonLine(line: string) {
  const match = line.match(/^(\d+)\s*회차\s*(.+)$/);
  if (!match) {
    return null;
  }

  const title = cleanNamucpaLessonTitle(match[2]);
  if (!title || isNamucpaNoiseLine(title)) {
    return null;
  }

  return {
    number: match[1],
    title,
  };
}

function parseNamucpaCurriculum(html: string): ParsedCurriculum {
  const lines = htmlToLines(html);
  const headerIndex = lines.findIndex(
    (line, index) =>
      line.includes("회차 제목 페이지 시간 자료") ||
      (line === "회차" && lines[index + 1] === "제목" && lines[index + 2] === "페이지"),
  );
  const startIndex =
    headerIndex >= 0
      ? headerIndex
      : lines.findLastIndex((line) => line === "강의목차" || line === "강의목차 받기");
  if (startIndex < 0) {
    throw new Error("강의목차 영역을 찾지 못했습니다.");
  }

  const afterStart = lines.slice(startIndex + 1);
  const endIndex = afterStart.findIndex(
    (line, index) =>
      index > 3 &&
      (line.includes("강의소개") ||
        line.includes("교재정보") ||
        line.includes("강사소개") ||
        line.includes("수강후기")),
  );
  const curriculumLines = endIndex >= 0 ? afterStart.slice(0, endIndex) : afterStart;
  const output = ["# 강의목차"];
  let lectureCount = 0;
  let pendingNumber: string | null = null;
  let pendingTitle: string | null = null;

  function pushLesson(number: string, title: string) {
    const cleanedTitle = cleanNamucpaLessonTitle(title);
    if (!cleanedTitle) {
      return;
    }

    lectureCount += 1;
    output.push(`${number}회차 ${cleanedTitle}`);
  }

  function flushPendingLesson() {
    if (!pendingNumber || !pendingTitle) {
      return;
    }

    pushLesson(pendingNumber, pendingTitle);
    pendingNumber = null;
    pendingTitle = null;
  }

  curriculumLines.forEach((line) => {
    if (isNamucpaNoiseLine(line) || isNamucpaPageLine(line)) {
      return;
    }

    const numberOnlyMatch = line.match(/^(\d+)\s*회차$/);
    if (numberOnlyMatch) {
      flushPendingLesson();
      pendingNumber = numberOnlyMatch[1];
      return;
    }

    const numericCellMatch = line.match(/^(\d+)$/);
    if (numericCellMatch) {
      flushPendingLesson();
      pendingNumber = numericCellMatch[1];
      return;
    }

    if (pendingNumber && line === "회차") {
      return;
    }

    const lesson = parseNamucpaLessonLine(line);
    if (lesson) {
      flushPendingLesson();
      pushLesson(lesson.number, lesson.title);
      return;
    }

    if (pendingNumber && !pendingTitle && !isDurationLine(line)) {
      pendingTitle = cleanNamucpaLessonTitle(line);
      return;
    }

    if (pendingTitle && isDurationLine(line)) {
      flushPendingLesson();
    }
  });

  flushPendingLesson();

  if (lectureCount === 0) {
    throw new Error("가져올 수 있는 강의목차를 찾지 못했습니다.");
  }

  return {
    title: getNamucpaCourseTitle(lines),
    text: output.join("\n"),
    sectionCount: 1,
    lectureCount,
  };
}

async function readHtml(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  const charset = contentType.match(/charset=([^;\s]+)/i)?.[1]?.toLowerCase();
  const bytes = await response.arrayBuffer();

  if (charset?.includes("euc") || charset?.includes("ks_c_5601")) {
    return new TextDecoder("euc-kr").decode(bytes);
  }

  const utf8 = new TextDecoder("utf-8").decode(bytes);
  if (
    !utf8.includes("커리큘럼") &&
    !utf8.includes("강의목차") &&
    !utf8.includes("회차") &&
    /[êëìí][\u0080-\u00ff]/.test(utf8)
  ) {
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

    const provider = isSupportedNjoblerUrl(targetUrl)
      ? "njobler"
      : isSupportedUricpaUrl(targetUrl)
        ? "uricpa"
        : isSupportedNamucpaUrl(targetUrl)
          ? "namucpa"
          : null;

    if (!provider) {
      return NextResponse.json(
        { error: "현재는 njobler.net, uricpa.com, namucpa.com 강의 상세 페이지만 지원합니다." },
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
    const parsed =
      provider === "njobler"
        ? parseNjoblerCurriculum(html)
        : provider === "uricpa"
          ? parseUricpaCurriculum(html)
          : parseNamucpaCurriculum(html);

    return NextResponse.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "커리큘럼을 가져오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
