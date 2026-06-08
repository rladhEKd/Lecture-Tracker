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

const statusBadge: Record<LectureStatus, string> = {
  NOT_STARTED: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-green-100 text-green-700",
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
      <main className="mx-auto min-h-screen w-full max-w-screen-sm bg-white px-5 py-6">
        <Link href="/" className="text-sm font-bold text-gray-600 active:text-gray-950">
          돌아가기
        </Link>
        <div className="mt-6 rounded-lg border border-gray-200 p-6 text-center text-sm text-gray-500">
          강의를 찾을 수 없습니다.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-screen-sm bg-white px-5 py-6">
      <header className="mb-6">
        <Link href="/" className="text-sm font-bold text-gray-600 active:text-gray-950">
          돌아가기
        </Link>
        <h1 className="mt-4 text-2xl font-bold leading-tight text-gray-950">{course.title}</h1>
      </header>

      <section className="grid grid-cols-3 gap-3">
        <StatCard label="전체 강의 수" value={String(stats.totalCount)} />
        <StatCard label="완료 강의 수" value={String(stats.completedCount)} />
        <StatCard label="진도율" value={`${stats.progressRate}%`} />
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-[1fr_104px_88px] border-b border-gray-200 bg-gray-50 px-3 py-3 text-xs font-bold text-gray-600">
          <span>강의명</span>
          <span>상태</span>
          <span>완료일</span>
        </div>

        <div>
          {course.lectures.map((lecture) => (
            <div
              key={lecture.id}
              className="grid grid-cols-[1fr_104px_88px] items-center gap-2 border-b border-gray-100 px-3 py-3 last:border-b-0"
            >
              <p className="min-w-0 text-sm font-medium leading-5 text-gray-950">{lecture.title}</p>
              <div className={`rounded-lg px-2 py-1 ${statusBadge[lecture.status]}`}>
                <select
                  value={lecture.status}
                  onChange={(event) => handleStatusChange(lecture.id, event.target.value as LectureStatus)}
                  className="w-full bg-transparent text-sm font-bold outline-none"
                  aria-label={`${lecture.title} 상태`}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-right text-xs font-medium text-gray-600">
                {lecture.completedAt ?? "-"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <p className="text-xs font-bold leading-4 text-gray-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-gray-950">{value}</p>
    </div>
  );
}
