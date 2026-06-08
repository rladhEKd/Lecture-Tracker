"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getCourse, updateLectureStatus } from "@/lib/storage";
import type { CourseWithLectures, LectureStatus } from "@/lib/types";

const statusOptions: { value: LectureStatus; label: string }[] = [
  { value: "NOT_STARTED", label: "미수강" },
  { value: "IN_PROGRESS", label: "수강중" },
  { value: "COMPLETED", label: "완강" },
];

const statusStyle: Record<LectureStatus, string> = {
  NOT_STARTED: "border-gray-200 bg-gray-100 text-gray-700",
  IN_PROGRESS: "border-yellow-200 bg-yellow-100 text-yellow-800",
  COMPLETED: "border-green-200 bg-green-100 text-green-700",
};

export default function CourseDetailPage() {
  const params = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<CourseWithLectures | null>(null);

  useEffect(() => {
    setCourse(getCourse(params.courseId));
  }, [params.courseId]);

  const stats = useMemo(() => {
    const totalCount = course?.lectures.length ?? 0;
    const completedCount = course?.lectures.filter((lecture) => lecture.status === "COMPLETED").length ?? 0;
    const progressRate = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

    return { totalCount, completedCount, progressRate };
  }, [course]);

  function handleStatusChange(lectureId: string, status: LectureStatus) {
    const updatedLecture = updateLectureStatus(params.courseId, lectureId, status);
    if (!updatedLecture) {
      return;
    }

    setCourse((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        lectures: current.lectures.map((lecture) =>
          lecture.id === lectureId ? updatedLecture : lecture,
        ),
      };
    });
  }

  if (!course) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-screen-sm bg-white px-5 pb-10 pt-[max(24px,env(safe-area-inset-top))]">
        <Link href="/" className="text-sm font-bold text-gray-600 active:text-gray-950">
          돌아가기
        </Link>
        <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-5 py-8 text-center">
          <p className="text-base font-bold text-gray-900">강의를 찾을 수 없습니다</p>
          <p className="mt-2 text-sm leading-6 text-gray-500">홈으로 돌아가 등록된 강의 목록을 확인하세요.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-screen-sm bg-white px-5 pb-10 pt-[max(24px,env(safe-area-inset-top))]">
      <header className="mb-6">
        <Link href="/" className="text-sm font-bold text-gray-600 active:text-gray-950">
          돌아가기
        </Link>
        <h1 className="mt-4 break-words text-3xl font-bold leading-tight text-gray-950">{course.title}</h1>
      </header>

      <section className="grid grid-cols-3 gap-3">
        <StatCard label="전체 강의 수" value={String(stats.totalCount)} />
        <StatCard label="완료 강의 수" value={String(stats.completedCount)} />
        <StatCard label="진도율" value={`${stats.progressRate}%`} />
      </section>

      <section className="mt-5 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-bold text-gray-700">전체 진도</p>
          <p className="text-sm font-bold text-green-700">{stats.progressRate}%</p>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-green-500" style={{ width: `${stats.progressRate}%` }} />
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-[1fr_104px_82px] border-b border-gray-200 bg-gray-50 px-3 py-3 text-xs font-bold text-gray-600">
          <span>강의명</span>
          <span>상태</span>
          <span className="text-right">완료일</span>
        </div>

        <div>
          {course.lectures.map((lecture) => {
            const isCompleted = lecture.status === "COMPLETED";

            return (
              <div
                key={lecture.id}
                className={`grid grid-cols-[1fr_104px_82px] items-center gap-2 border-b px-3 py-3 last:border-b-0 ${
                  isCompleted ? "border-green-100 bg-green-50/70" : "border-gray-100 bg-white"
                }`}
              >
                <div className="min-w-0">
                  <p
                    className={`break-words text-sm font-bold leading-5 ${
                      isCompleted ? "text-green-800" : "text-gray-950"
                    }`}
                  >
                    {lecture.title}
                  </p>
                  {isCompleted ? <p className="mt-1 text-xs font-bold text-green-600">완료됨</p> : null}
                </div>
                <div className={`relative rounded-lg border px-2 py-1 ${statusStyle[lecture.status]}`}>
                  <select
                    value={lecture.status}
                    onChange={(event) => handleStatusChange(lecture.id, event.target.value as LectureStatus)}
                    className="w-full appearance-none bg-transparent pr-4 text-sm font-bold outline-none"
                    aria-label={`${lecture.title} 상태`}
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs">⌄</span>
                </div>
                <span className="text-right text-xs font-bold text-gray-600">{lecture.completedAt ?? "-"}</span>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <p className="min-h-8 text-xs font-bold leading-4 text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-950">{value}</p>
    </div>
  );
}
