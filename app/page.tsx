"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-screen-sm flex-col bg-white px-5 py-6">
      <header className="pb-8">
        <h1 className="text-2xl font-bold tracking-normal text-gray-950">Lecture Tracker</h1>
      </header>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-gray-500">새 강의 등록</p>
        <h2 className="mt-2 text-xl font-bold text-gray-950">강의 목록을 직접 입력해 진도를 관리하세요</h2>
        <Link
          href="/courses/new"
          className="mt-5 flex min-h-14 w-full items-center justify-center rounded-lg bg-gray-950 px-5 text-base font-bold text-white active:bg-gray-800"
        >
          + 강의 추가
        </Link>
      </section>

      <section className="mt-8 flex-1">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-bold text-gray-950">내 강의</h2>
          <span className="text-sm text-gray-500">{courses.length}개</span>
        </div>

        {courses.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            아직 등록된 강의가 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {courses.map((course) => (
              <Link
                key={course.id}
                href={`/courses/${course.id}`}
                className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm active:bg-gray-50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-gray-950">{course.title}</h3>
                    <p className="mt-1 text-sm text-gray-500">전체 {course.lectures.length}강</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-green-50 px-3 py-1 text-sm font-bold text-green-700">
                    {getProgress(course)}%
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
