"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { deleteCourse, getCourses } from "@/lib/storage";
import type { CourseWithLectures } from "@/lib/types";

function getProgress(course: CourseWithLectures) {
  if (course.lectures.length === 0) {
    return 0;
  }

  const completedCount = course.lectures.filter((lecture) => lecture.status === "COMPLETED").length;
  return Math.round((completedCount / course.lectures.length) * 100);
}

export default function Home() {
  const [courses, setCourses] = useState<CourseWithLectures[]>([]);

  useEffect(() => {
    setCourses(getCourses());
  }, []);

  function handleDeleteCourse(courseId: string, title: string) {
    const confirmed = window.confirm(`"${title}" 강의를 삭제할까요?\n연결된 강의 목록도 함께 삭제됩니다.`);
    if (!confirmed) {
      return;
    }

    deleteCourse(courseId);
    setCourses(getCourses());
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col bg-white px-5 pb-10 pt-[max(24px,env(safe-area-inset-top))]">
      <header className="pb-6">
        <p className="text-sm font-bold text-blue-600">진도 관리</p>
        <h1 className="mt-1 text-3xl font-bold tracking-normal text-gray-950">Lecture Tracker</h1>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-gray-500">새 강의 등록</p>
            <h2 className="mt-2 text-xl font-bold leading-7 text-gray-950">
              강의 목록을 입력하고 수강 현황을 관리하세요
            </h2>
          </div>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-700">MVP</span>
        </div>
        <Link
          href="/courses/new"
          className="mt-5 flex min-h-14 w-full items-center justify-center rounded-2xl bg-blue-600 px-5 text-base font-bold text-white shadow-sm active:bg-blue-700"
        >
          + 강의 추가
        </Link>
      </section>

      <section className="mt-6 flex-1">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-bold text-gray-950">내 강의</h2>
          <span className="text-sm font-medium text-gray-500">{courses.length}개 과정</span>
        </div>

        {courses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-8 text-center">
            <p className="text-base font-bold text-gray-900">아직 등록된 강의가 없습니다</p>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              첫 강의를 추가하면 진도와 완료 현황을 관리할 수 있습니다.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {courses.map((course) => {
              const progress = getProgress(course);

              return (
                <article key={course.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-start gap-3">
                    <Link href={`/courses/${course.id}`} className="min-w-0 flex-1 active:opacity-80">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="break-words text-base font-bold leading-6 text-gray-950">{course.title}</h3>
                          <p className="mt-1 text-sm text-gray-500">전체 {course.lectures.length}강</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-700">
                          {progress}%
                        </span>
                      </div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-200">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${progress}%` }} />
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDeleteCourse(course.id, course.title)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-red-100 bg-white text-red-600 active:bg-red-50"
                      aria-label={`${course.title} 삭제`}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6M14 11v6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 7l1 14h10l1-14" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7V4h6v3" />
    </svg>
  );
}
