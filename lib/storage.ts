"use client";

import type { Course, CourseWithLectures, Lecture, LectureStatus, Section } from "@/lib/types";

const STORAGE_KEY = "lecture-tracker:courses";
const DEFAULT_SECTION_TITLE = "기본 섹션";

type StoredCourse = Course & {
  sections?: Section[];
  lectures?: (Omit<Lecture, "sectionId"> & { sectionId?: string })[];
};

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getKoreaDateString() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
}

function createDefaultSection(courseId: string, createdAt: string): Section {
  return {
    id: `${courseId}:default-section`,
    courseId,
    title: DEFAULT_SECTION_TITLE,
    order: 0,
    createdAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidBackup(value: unknown): value is StoredCourse[] {
  return (
    Array.isArray(value) &&
    value.every((course) => {
      if (!isRecord(course)) {
        return false;
      }

      return (
        typeof course.id === "string" &&
        typeof course.title === "string" &&
        typeof course.createdAt === "string" &&
        (course.sections === undefined || Array.isArray(course.sections)) &&
        (course.lectures === undefined || Array.isArray(course.lectures))
      );
    })
  );
}

function normalizeCourse(course: StoredCourse): CourseWithLectures {
  const defaultSection = createDefaultSection(course.id, course.createdAt);
  const sections =
    Array.isArray(course.sections) && course.sections.length > 0
      ? course.sections.map((section, index) => ({
          ...section,
          courseId: course.id,
          order: typeof section.order === "number" ? section.order : index,
          planStartDate: typeof section.planStartDate === "string" ? section.planStartDate : undefined,
          planEndDate: typeof section.planEndDate === "string" ? section.planEndDate : undefined,
          dailyTargetCount:
            typeof section.dailyTargetCount === "number" && section.dailyTargetCount > 0
              ? section.dailyTargetCount
              : undefined,
        }))
      : [defaultSection];

  const sectionIds = new Set(sections.map((section) => section.id));
  const fallbackSectionId = sections[0]?.id ?? defaultSection.id;
  const lectures = (course.lectures ?? []).map((lecture) => {
    const sectionId = lecture.sectionId && sectionIds.has(lecture.sectionId) ? lecture.sectionId : fallbackSectionId;

    return {
      ...lecture,
      courseId: course.id,
      sectionId,
    };
  });

  return {
    id: course.id,
    title: course.title,
    createdAt: course.createdAt,
    sections,
    lectures,
  };
}

function readCourses(): CourseWithLectures[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as StoredCourse[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    const normalized = parsed.map(normalizeCourse);
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      writeCourses(normalized);
    }

    return normalized;
  } catch {
    return [];
  }
}

function writeCourses(courses: CourseWithLectures[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
}

function parseCourseLines(courseId: string, lines: string[], createdAt: string) {
  const sections: Section[] = [];
  const lectures: Lecture[] = [];
  let currentSection: Section | null = null;

  function ensureSection() {
    if (currentSection) {
      return currentSection;
    }

    currentSection = {
      id: createId(),
      courseId,
      title: DEFAULT_SECTION_TITLE,
      order: sections.length,
      createdAt,
    };
    sections.push(currentSection);
    return currentSection;
  }

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      return;
    }

    if (trimmedLine.startsWith("# ")) {
      currentSection = {
        id: createId(),
        courseId,
        title: trimmedLine.replace(/^#\s+/, "").trim() || DEFAULT_SECTION_TITLE,
        order: sections.length,
        createdAt: new Date(Date.now() + index).toISOString(),
      };
      sections.push(currentSection);
      return;
    }

    const section = ensureSection();
    lectures.push({
      id: createId(),
      courseId,
      sectionId: section.id,
      title: trimmedLine,
      status: "NOT_STARTED",
      completedAt: null,
      createdAt: new Date(Date.now() + index).toISOString(),
    });
  });

  if (sections.length === 0) {
    sections.push(createDefaultSection(courseId, createdAt));
  }

  return { sections, lectures };
}

export function getCourses(): CourseWithLectures[] {
  return readCourses().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function exportCourses(): CourseWithLectures[] {
  return readCourses();
}

export function importCourses(value: unknown): CourseWithLectures[] {
  if (!isValidBackup(value)) {
    throw new Error("Lecture Tracker 백업 JSON 파일이 아닙니다.");
  }

  const normalized = value.map(normalizeCourse);
  writeCourses(normalized);
  return getCourses();
}

export function getCourse(courseId: string): CourseWithLectures | null {
  return readCourses().find((course) => course.id === courseId) ?? null;
}

export function deleteCourse(courseId: string) {
  const courses = readCourses();
  writeCourses(courses.filter((course) => course.id !== courseId));
}

export function updateCourseTitle(courseId: string, title: string): CourseWithLectures | null {
  const nextTitle = title.trim();
  if (!nextTitle) {
    return null;
  }

  const courses = readCourses();
  let updatedCourse: CourseWithLectures | null = null;

  const nextCourses = courses.map((course) => {
    if (course.id !== courseId) {
      return course;
    }

    updatedCourse = {
      ...course,
      title: nextTitle,
    };

    return updatedCourse;
  });

  writeCourses(nextCourses);
  return updatedCourse;
}

export function updateSectionPlan(
  courseId: string,
  sectionId: string,
  plan: {
    planStartDate?: string;
    planEndDate?: string;
    dailyTargetCount?: number;
  },
): Section | null {
  const courses = readCourses();
  let updatedSection: Section | null = null;
  const nextPlan = {
    planStartDate: plan.planStartDate?.trim() || undefined,
    planEndDate: plan.planEndDate?.trim() || undefined,
    dailyTargetCount:
      typeof plan.dailyTargetCount === "number" && Number.isFinite(plan.dailyTargetCount) && plan.dailyTargetCount > 0
        ? Math.floor(plan.dailyTargetCount)
        : undefined,
  };

  const nextCourses = courses.map((course) => {
    if (course.id !== courseId) {
      return course;
    }

    return {
      ...course,
      sections: course.sections.map((section) => {
        if (section.id !== sectionId) {
          return section;
        }

        updatedSection = {
          ...section,
          ...nextPlan,
        };

        return updatedSection;
      }),
    };
  });

  writeCourses(nextCourses);
  return updatedSection;
}

export function createCourse(title: string, lines: string[]): Course {
  const now = new Date().toISOString();
  const courseId = createId();
  const { sections, lectures } = parseCourseLines(courseId, lines, now);
  const course: CourseWithLectures = {
    id: courseId,
    title,
    createdAt: now,
    sections,
    lectures,
  };

  const courses = readCourses();
  writeCourses([course, ...courses]);

  return course;
}

export function updateLectureStatus(
  courseId: string,
  lectureId: string,
  status: LectureStatus,
): Lecture | null {
  const courses = readCourses();
  let updatedLecture: Lecture | null = null;

  const nextCourses = courses.map((course) => {
    if (course.id !== courseId) {
      return course;
    }

    return {
      ...course,
      lectures: course.lectures.map((lecture) => {
        if (lecture.id !== lectureId) {
          return lecture;
        }

        updatedLecture = {
          ...lecture,
          status,
          completedAt: status === "COMPLETED" ? getKoreaDateString() : null,
        };

        return updatedLecture;
      }),
    };
  });

  writeCourses(nextCourses);
  return updatedLecture;
}

export function updateLectureTitle(
  courseId: string,
  lectureId: string,
  title: string,
): Lecture | null {
  const nextTitle = title.trim();
  if (!nextTitle) {
    return null;
  }

  const courses = readCourses();
  let updatedLecture: Lecture | null = null;

  const nextCourses = courses.map((course) => {
    if (course.id !== courseId) {
      return course;
    }

    return {
      ...course,
      lectures: course.lectures.map((lecture) => {
        if (lecture.id !== lectureId) {
          return lecture;
        }

        updatedLecture = {
          ...lecture,
          title: nextTitle,
        };

        return updatedLecture;
      }),
    };
  });

  writeCourses(nextCourses);
  return updatedLecture;
}

export function deleteLecture(courseId: string, lectureId: string) {
  const courses = readCourses();

  const nextCourses = courses.map((course) => {
    if (course.id !== courseId) {
      return course;
    }

    return {
      ...course,
      lectures: course.lectures.filter((lecture) => lecture.id !== lectureId),
    };
  });

  writeCourses(nextCourses);
}
