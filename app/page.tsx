"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getCourses } from "@/lib/storage";
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

  const summary = useMemo(() => {
    const totalLectureCount = courses.reduce((sum, course) => sum + course.lectures.length, 0);
    const completedLectureCount = courses.reduce(
      (sum, course) => sum + course.lectures.filter((lecture) => lecture.status === "COMPLETED").length,
      0,
    );
    const averageProgress =
      courses.length === 0
        ? 0
        : Math.round(courses.reduce((sum, course) => sum + getProgress(course), 0) / courses.length);

    return { totalLectureCount, completedLectureCount, averageProgress };
  }, [courses]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col bg-white px-5 pb-10 pt-[max(24px,env(safe-area-inset-top))]">
      <header className="pb-6">
        <p className="text-sm font-bold text-green-700">진도 관리</p>
        <h1 className="mt-1 text-3xl font-bold tracking-normal text-gray-950">Lecture Tracker</h1>
      </header>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-gray-500">새 강의 등록</p>
            <h2 className="mt-2 text-xl font-bold leading-7 text-gray-950">
              강의 목록을 입력하고 수강 현황을 관리하세요
            </h2>
          </div>
          <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-bold text-green-700">MVP</span>
        </div>
        <Link
          href="/courses/new"
          className="mt-5 flex min-h-14 w-full items-center justify-center rounded-lg bg-gray-950 px-5 text-base font-bold text-white shadow-sm active:bg-gray-800"
        >
          + 강의 추가
        </Link>
      </section>

      <section className="mt-5 grid grid-cols-3 gap-3">
        <SummaryCard label="전체 강의 수" value={String(summary.totalLectureCount)} />
        <SummaryCard label="완료 강의 수" value={String(summary.completedLectureCount)} />
        <SummaryCard label="평균 진도율" value={`${summary.averageProgress}%`} />
      </section>

      <section className="mt-8 flex-1">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-bold text-gray-950">내 강의</h2>
          <span className="text-sm font-medium text-gray-500">{courses.length}개 과정</span>
        </div>

        {courses.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-5 py-8 text-center">
            <p className="text-base font-bold text-gray-900">아직 등록된 강의가 없습니다</p>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              첫 강의를 추가하면 전체 진도와 완료 현황을 한눈에 볼 수 있습니다.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {courses.map((course) => {
              const progress = getProgress(course);

              return (
                <Link
                  key={course.id}
                  href={`/courses/${course.id}`}
                  className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm active:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="break-words text-base font-bold leading-6 text-gray-950">{course.title}</h3>
                      <p className="mt-1 text-sm text-gray-500">전체 {course.lectures.length}강</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-green-50 px-3 py-1 text-sm font-bold text-green-700">
                      {progress}%
                    </span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-green-500" style={{ width: `${progress}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <p className="min-h-8 text-xs font-bold leading-4 text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-950">{value}</p>
    </div>
  );
}
