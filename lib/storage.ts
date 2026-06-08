"use client";

import type { Course, CourseWithLectures, Lecture, LectureStatus } from "@/lib/types";

const STORAGE_KEY = "lecture-tracker:courses";

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

    const parsed = JSON.parse(raw) as CourseWithLectures[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCourses(courses: CourseWithLectures[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
}

export function getCourses(): CourseWithLectures[] {
  return readCourses().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

export function createCourse(title: string, lectureTitles: string[]): Course {
  const now = new Date().toISOString();
  const course: CourseWithLectures = {
    id: createId(),
    title,
    createdAt: now,
    lectures: lectureTitles.map((lectureTitle, index) => ({
      id: createId(),
      courseId: "",
      title: lectureTitle,
      status: "NOT_STARTED",
      completedAt: null,
      createdAt: new Date(Date.now() + index).toISOString(),
    })),
  };

  course.lectures = course.lectures.map((lecture) => ({
    ...lecture,
    courseId: course.id,
  }));

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
          completedAt: status === "COMPLETED" ? new Date().toISOString().slice(0, 10) : null,
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
