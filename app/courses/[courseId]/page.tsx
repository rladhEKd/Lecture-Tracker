"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
  NOT_STARTED: "border-gray-200 bg-white text-gray-600",
  IN_PROGRESS: "border-yellow-200 bg-yellow-50 text-yellow-800",
  COMPLETED: "border-green-200 bg-green-50 text-green-700",
};

export default function CourseDetailPage() {
  const params = useParams<{ courseId: string }>();
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [course, setCourse] = useState<CourseWithLectures | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [courseTitleDraft, setCourseTitleDraft] = useState("");
  const [lectureTitleDrafts, setLectureTitleDrafts] = useState<Record<string, string>>({});
  const [isEditingCourseTitle, setIsEditingCourseTitle] = useState(false);
  const [editingLectureId, setEditingLectureId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const nextCourse = getCourse(params.courseId);
    setCourse(nextCourse);
    setCourseTitleDraft(nextCourse?.title ?? "");
    setLectureTitleDrafts(
      Object.fromEntries((nextCourse?.lectures ?? []).map((lecture) => [lecture.id, lecture.title])),
    );
  }, [params.courseId]);

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) {
        clearTimeout(feedbackTimer.current);
      }
    };
  }, []);

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

  function showFeedback(message: string) {
    setFeedback(message);
    if (feedbackTimer.current) {
      clearTimeout(feedbackTimer.current);
    }
    feedbackTimer.current = setTimeout(() => setFeedback(""), 1400);
  }

  function handleCourseTitleSave() {
    const updatedCourse = updateCourseTitle(params.courseId, courseTitleDraft);
    if (!updatedCourse) {
      setCourseTitleDraft(course?.title ?? "");
      setIsEditingCourseTitle(false);
      return;
    }

    setCourse(updatedCourse);
    setCourseTitleDraft(updatedCourse.title);
    setIsEditingCourseTitle(false);
    showFeedback("저장되었습니다");
  }

  function handleCourseTitleCancel() {
    setCourseTitleDraft(course?.title ?? "");
    setIsEditingCourseTitle(false);
  }

  function handleLectureTitleSave(lectureId: string) {
    const updatedLecture = updateLectureTitle(params.courseId, lectureId, lectureTitleDrafts[lectureId] ?? "");
    if (!updatedLecture) {
      setLectureTitleDrafts((current) => ({
        ...current,
        [lectureId]: course?.lectures.find((lecture) => lecture.id === lectureId)?.title ?? "",
      }));
      setEditingLectureId(null);
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
    setEditingLectureId(null);
    showFeedback("저장되었습니다");
  }

  function handleLectureTitleCancel(lectureId: string) {
    setLectureTitleDrafts((current) => ({
      ...current,
      [lectureId]: course?.lectures.find((lecture) => lecture.id === lectureId)?.title ?? "",
    }));
    setEditingLectureId(null);
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
    showFeedback("삭제되었습니다");
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
    showFeedback("상태가 변경되었습니다");
  }

  if (!course) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-screen-sm bg-white px-5 pb-10 pt-[max(24px,env(safe-area-inset-top))]">
        <Link href="/" className="text-sm font-bold text-gray-600 active:text-gray-950">
          돌아가기
        </Link>
        <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-8 text-center">
          <p className="text-base font-bold text-gray-900">강의를 찾을 수 없습니다</p>
          <p className="mt-2 text-sm leading-6 text-gray-500">홈으로 돌아가 등록된 강의 목록을 확인하세요.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-screen-sm bg-white px-5 pb-10 pt-[max(24px,env(safe-area-inset-top))]">
      {feedback ? (
        <div className="fixed left-1/2 top-[max(14px,env(safe-area-inset-top))] z-10 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg">
          {feedback}
        </div>
      ) : null}

      <header className="mb-6">
        <Link href="/" className="text-sm font-bold text-gray-600 active:text-gray-950">
          돌아가기
        </Link>
        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-start gap-3">
            {isEditingCourseTitle ? (
              <input
                value={courseTitleDraft}
                onChange={(event) => setCourseTitleDraft(event.target.value)}
                className="min-h-12 min-w-0 flex-1 rounded-xl border border-blue-200 bg-white px-4 text-xl font-bold text-gray-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                aria-label="강의명"
              />
            ) : (
              <h1 className="min-w-0 flex-1 break-words text-2xl font-bold leading-tight text-gray-950">
                {course.title}
              </h1>
            )}
            <div className="flex shrink-0 gap-2">
              {isEditingCourseTitle ? (
                <>
                  <IconButton label="강의명 저장" tone="primary" onClick={handleCourseTitleSave}>
                    <CheckIcon />
                  </IconButton>
                  <IconButton label="강의명 수정 취소" tone="neutral" onClick={handleCourseTitleCancel}>
                    <XIcon />
                  </IconButton>
                </>
              ) : (
                <IconButton label="강의명 수정" tone="neutral" onClick={() => setIsEditingCourseTitle(true)}>
                  <PencilIcon />
                </IconButton>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-3">
        <StatCard label="전체 강의 수" value={String(stats.totalCount)} />
        <StatCard label="완료 강의 수" value={String(stats.completedCount)} />
        <StatCard label="진도율" value={`${stats.progressRate}%`} />
      </section>

      <section className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-bold text-gray-700">전체 진도</p>
          <p className="text-sm font-bold text-blue-700">{stats.progressRate}%</p>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-200">
          <div className="h-full rounded-full bg-blue-500" style={{ width: `${stats.progressRate}%` }} />
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <label className="block">
          <span className="text-sm font-bold text-gray-900">강의명 검색</span>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="예: 법인세, OT"
            className="mt-2 min-h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
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
                  className={`min-h-10 rounded-full border px-2 text-sm font-bold ${
                    isActive
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-gray-200 bg-white text-gray-700 active:bg-gray-100"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="mt-4 flex min-h-12 items-center justify-between gap-4 rounded-xl bg-white px-4">
          <span className="text-sm font-bold text-gray-800">완료 강의 숨기기</span>
          <input
            type="checkbox"
            checked={hideCompleted}
            onChange={(event) => setHideCompleted(event.target.checked)}
            className="h-5 w-5 accent-blue-600"
          />
        </label>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-950">강의 목록</h2>
          <span className="text-sm font-bold text-gray-500">{filteredLectures.length}개</span>
        </div>

        {filteredLectures.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-8 text-center">
            <p className="text-base font-bold text-gray-900">조건에 맞는 강의가 없습니다</p>
            <p className="mt-2 text-sm leading-6 text-gray-500">검색어를 줄이거나 상태 필터를 변경하세요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLectures.map((lecture) => {
              const isCompleted = lecture.status === "COMPLETED";
              const isEditing = editingLectureId === lecture.id;

              return (
                <article
                  key={lecture.id}
                  className={`rounded-2xl border p-4 ${
                    isCompleted ? "border-green-100 bg-green-50" : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <input
                          value={lectureTitleDrafts[lecture.id] ?? lecture.title}
                          onChange={(event) =>
                            setLectureTitleDrafts((current) => ({
                              ...current,
                              [lecture.id]: event.target.value,
                            }))
                          }
                          className="min-h-11 w-full rounded-xl border border-blue-200 bg-white px-3 text-base font-bold text-gray-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                          aria-label={`${lecture.title} 제목`}
                        />
                      ) : (
                        <h3
                          className={`break-words text-base font-bold leading-6 ${
                            isCompleted ? "text-green-800" : "text-gray-950"
                          }`}
                        >
                          {lecture.title}
                        </h3>
                      )}
                      <p className="mt-1 text-xs font-bold text-gray-500">완료일 {lecture.completedAt ?? "-"}</p>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      {isEditing ? (
                        <>
                          <IconButton label="강의 제목 저장" tone="primary" onClick={() => handleLectureTitleSave(lecture.id)}>
                            <CheckIcon />
                          </IconButton>
                          <IconButton label="강의 제목 수정 취소" tone="neutral" onClick={() => handleLectureTitleCancel(lecture.id)}>
                            <XIcon />
                          </IconButton>
                        </>
                      ) : (
                        <>
                          <IconButton label="강의 제목 수정" tone="neutral" onClick={() => setEditingLectureId(lecture.id)}>
                            <PencilIcon />
                          </IconButton>
                          <IconButton label="강의 삭제" tone="danger" onClick={() => handleLectureDelete(lecture.id, lecture.title)}>
                            <TrashIcon />
                          </IconButton>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {statusOptions.map((option) => {
                      const isActive = lecture.status === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleStatusChange(lecture.id, option.value)}
                          className={`min-h-10 rounded-full border px-2 text-sm font-bold ${
                            isActive
                              ? statusStyle[option.value]
                              : "border-gray-200 bg-white text-gray-500 active:bg-gray-100"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>

                  {isCompleted ? <p className="mt-3 text-xs font-bold text-green-700">완료됨</p> : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
      <p className="min-h-8 text-xs font-bold leading-4 text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-950">{value}</p>
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
  tone,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  tone: "danger" | "neutral" | "primary";
}) {
  const toneClass = {
    danger: "border-red-100 bg-white text-red-600 active:bg-red-50",
    neutral: "border-gray-200 bg-white text-gray-700 active:bg-gray-100",
    primary: "border-blue-600 bg-blue-600 text-white active:bg-blue-700",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 w-11 items-center justify-center rounded-full border ${toneClass}`}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function PencilIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.9 4.7l2.4 2.4M4 20h4.8L19.6 9.2a1.7 1.7 0 0 0 0-2.4l-2.4-2.4a1.7 1.7 0 0 0-2.4 0L4 15.2V20z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
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
