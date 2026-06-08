"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  deleteLecture,
  getCourse,
  updateCourseTitle,
  updateLectureStatus,
  updateLectureTitle,
} from "@/lib/storage";
import type { CourseWithLectures, LectureStatus } from "@/lib/types";

type StatusFilter = "ALL" | LectureStatus;

const statusOptions: { value: LectureStatus; label: string }[] = [
  { value: "NOT_STARTED", label: "미수강" },
  { value: "IN_PROGRESS", label: "수강중" },
  { value: "COMPLETED", label: "완강" },
];

const filterOptions: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "전체" },
  ...statusOptions,
];

const statusStyle: Record<LectureStatus, string> = {
  NOT_STARTED: "border-gray-200 bg-gray-100 text-gray-700",
  IN_PROGRESS: "border-yellow-200 bg-yellow-100 text-yellow-800",
  COMPLETED: "border-green-200 bg-green-100 text-green-700",
};

export default function CourseDetailPage() {
  const params = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<CourseWithLectures | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [courseTitleDraft, setCourseTitleDraft] = useState("");
  const [lectureTitleDrafts, setLectureTitleDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const nextCourse = getCourse(params.courseId);
    setCourse(nextCourse);
    setCourseTitleDraft(nextCourse?.title ?? "");
    setLectureTitleDrafts(
      Object.fromEntries((nextCourse?.lectures ?? []).map((lecture) => [lecture.id, lecture.title])),
    );
  }, [params.courseId]);

  const stats = useMemo(() => {
    const totalCount = course?.lectures.length ?? 0;
    const completedCount = course?.lectures.filter((lecture) => lecture.status === "COMPLETED").length ?? 0;
    const progressRate = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

    return { totalCount, completedCount, progressRate };
  }, [course]);

  const filteredLectures = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return (course?.lectures ?? []).filter((lecture) => {
      const matchesSearch = keyword.length === 0 || lecture.title.toLowerCase().includes(keyword);
      const matchesStatus = statusFilter === "ALL" || lecture.status === statusFilter;
      const matchesVisibility = !hideCompleted || lecture.status !== "COMPLETED";

      return matchesSearch && matchesStatus && matchesVisibility;
    });
  }, [course, hideCompleted, searchTerm, statusFilter]);

  function handleCourseTitleSave() {
    const updatedCourse = updateCourseTitle(params.courseId, courseTitleDraft);
    if (!updatedCourse) {
      setCourseTitleDraft(course?.title ?? "");
      return;
    }

    setCourse(updatedCourse);
    setCourseTitleDraft(updatedCourse.title);
  }

  function handleLectureTitleSave(lectureId: string) {
    const updatedLecture = updateLectureTitle(params.courseId, lectureId, lectureTitleDrafts[lectureId] ?? "");
    if (!updatedLecture) {
      setLectureTitleDrafts((current) => ({
        ...current,
        [lectureId]: course?.lectures.find((lecture) => lecture.id === lectureId)?.title ?? "",
      }));
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
    setLectureTitleDrafts((current) => ({ ...current, [lectureId]: updatedLecture.title }));
  }

  function handleLectureDelete(lectureId: string, title: string) {
    const confirmed = window.confirm(`"${title}" 강의를 삭제할까요?`);
    if (!confirmed) {
      return;
    }

    deleteLecture(params.courseId, lectureId);
    setCourse(getCourse(params.courseId));
    setLectureTitleDrafts((current) => {
      const next = { ...current };
      delete next[lectureId];
      return next;
    });
  }

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
        <label className="mt-4 block">
          <span className="text-sm font-bold text-gray-600">강의명</span>
          <div className="mt-2 flex gap-2">
            <input
              value={courseTitleDraft}
              onChange={(event) => setCourseTitleDraft(event.target.value)}
              onBlur={handleCourseTitleSave}
              className="min-h-12 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-4 text-xl font-bold text-gray-950 outline-none focus:border-gray-950 focus:ring-4 focus:ring-gray-100"
            />
            <button
              type="button"
              onClick={handleCourseTitleSave}
              className="min-h-12 rounded-lg bg-gray-950 px-4 text-sm font-bold text-white active:bg-gray-800"
            >
              저장
            </button>
          </div>
        </label>
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

      <section className="mt-5 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <label className="block">
          <span className="text-sm font-bold text-gray-900">강의명 검색</span>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="예: 법인세, OT"
            className="mt-2 min-h-12 w-full rounded-lg border border-gray-300 bg-white px-4 text-base text-gray-950 outline-none transition focus:border-gray-950 focus:ring-4 focus:ring-gray-100"
          />
        </label>

        <div className="mt-4">
          <p className="text-sm font-bold text-gray-900">상태 필터</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {filterOptions.map((option) => {
              const isActive = statusFilter === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatusFilter(option.value)}
                  className={`min-h-10 rounded-lg border px-2 text-sm font-bold ${
                    isActive
                      ? "border-gray-950 bg-gray-950 text-white"
                      : "border-gray-200 bg-white text-gray-700 active:bg-gray-50"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="mt-4 flex min-h-12 items-center justify-between gap-4 rounded-lg bg-gray-50 px-4">
          <span className="text-sm font-bold text-gray-800">완료 강의 숨기기</span>
          <input
            type="checkbox"
            checked={hideCompleted}
            onChange={(event) => setHideCompleted(event.target.checked)}
            className="h-5 w-5 accent-gray-950"
          />
        </label>
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-[1fr_96px] border-b border-gray-200 bg-gray-50 px-3 py-3 text-xs font-bold text-gray-600">
          <span>강의명</span>
          <span>상태</span>
        </div>

        <div>
          {filteredLectures.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-base font-bold text-gray-900">조건에 맞는 강의가 없습니다</p>
              <p className="mt-2 text-sm leading-6 text-gray-500">검색어를 줄이거나 상태 필터를 변경하세요.</p>
            </div>
          ) : (
            filteredLectures.map((lecture) => {
              const isCompleted = lecture.status === "COMPLETED";

              return (
                <div
                  key={lecture.id}
                  className={`border-b px-3 py-3 last:border-b-0 ${
                    isCompleted ? "border-green-100 bg-green-50/70" : "border-gray-100 bg-white"
                  }`}
                >
                  <div className="grid grid-cols-[1fr_96px] items-start gap-2">
                    <div className="min-w-0">
                      <input
                        value={lectureTitleDrafts[lecture.id] ?? lecture.title}
                        onChange={(event) =>
                          setLectureTitleDrafts((current) => ({
                            ...current,
                            [lecture.id]: event.target.value,
                          }))
                        }
                        onBlur={() => handleLectureTitleSave(lecture.id)}
                        className={`min-h-10 w-full rounded-lg border px-3 text-sm font-bold outline-none focus:border-gray-950 focus:ring-4 focus:ring-gray-100 ${
                          isCompleted
                            ? "border-green-200 bg-white text-green-800"
                            : "border-gray-200 bg-white text-gray-950"
                        }`}
                        aria-label={`${lecture.title} 제목`}
                      />
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-gray-500">{lecture.completedAt ?? "-"}</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleLectureTitleSave(lecture.id)}
                            className="min-h-8 rounded-lg border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 active:bg-gray-50"
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLectureDelete(lecture.id, lecture.title)}
                            className="min-h-8 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 active:bg-red-100"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
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
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs">v</span>
                    </div>
                  </div>
                  {isCompleted ? <p className="mt-2 text-xs font-bold text-green-600">완료됨</p> : null}
                </div>
              );
            })
          )}
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
