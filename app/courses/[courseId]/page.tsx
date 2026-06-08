"use client";

import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock3,
  Pencil,
  PlayCircle,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  deleteLecture,
  getCourse,
  updateCourseTitle,
  updateLectureStatus,
  updateLectureTitle,
} from "@/lib/storage";
import type { CourseWithLectures, Lecture, LectureStatus, Section } from "@/lib/types";

type StatusFilter = "ALL" | LectureStatus;
type SectionGroup = {
  section: Section;
  lectures: Lecture[];
  visibleLectures: Lecture[];
  completedCount: number;
  progressRate: number;
};

const statusOptions: { value: LectureStatus; label: string }[] = [
  { value: "NOT_STARTED", label: "미수강" },
  { value: "IN_PROGRESS", label: "수강중" },
  { value: "COMPLETED", label: "완강" },
];

const filterOptions: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "전체" },
  ...statusOptions,
];

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
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
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

  const sectionGroups = useMemo(() => {
    if (!course) {
      return [];
    }

    const keyword = searchTerm.trim().toLowerCase();

    return [...course.sections]
      .sort((a, b) => a.order - b.order)
      .map((section) => {
        const lectures = course.lectures.filter((lecture) => lecture.sectionId === section.id);
        const visibleLectures = lectures.filter((lecture) => {
          const matchesSearch = keyword.length === 0 || lecture.title.toLowerCase().includes(keyword);
          const matchesStatus = statusFilter === "ALL" || lecture.status === statusFilter;
          const matchesVisibility = !hideCompleted || lecture.status !== "COMPLETED";

          return matchesSearch && matchesStatus && matchesVisibility;
        });
        const completedCount = lectures.filter((lecture) => lecture.status === "COMPLETED").length;
        const progressRate = lectures.length === 0 ? 0 : Math.round((completedCount / lectures.length) * 100);

        return { section, lectures, visibleLectures, completedCount, progressRate };
      })
      .filter((group) => group.visibleLectures.length > 0 || group.lectures.length === 0);
  }, [course, hideCompleted, searchTerm, statusFilter]);

  const visibleLectureCount = sectionGroups.reduce((sum, group) => sum + group.visibleLectures.length, 0);

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

  function toggleSection(sectionId: string) {
    setCollapsedSections((current) => ({ ...current, [sectionId]: !current[sectionId] }));
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
    <main className="mx-auto min-h-dvh w-full max-w-screen-sm bg-white px-4 pb-8 pt-[max(20px,env(safe-area-inset-top))]">
      {feedback ? (
        <div className="fixed left-1/2 top-[max(14px,env(safe-area-inset-top))] z-10 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg">
          {feedback}
        </div>
      ) : null}

      <header className="mb-5">
        <Link href="/" className="text-sm font-bold text-gray-600 active:text-gray-950">
          돌아가기
        </Link>
        <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-start gap-2">
            {isEditingCourseTitle ? (
              <input
                value={courseTitleDraft}
                onChange={(event) => setCourseTitleDraft(event.target.value)}
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-blue-200 bg-white px-3 text-xl font-bold text-gray-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                aria-label="강의명"
              />
            ) : (
              <h1 className="min-w-0 flex-1 break-words text-2xl font-bold leading-tight text-gray-950">
                {course.title}
              </h1>
            )}
            <div className="flex shrink-0 gap-1.5">
              {isEditingCourseTitle ? (
                <>
                  <IconButton label="강의명 저장" tone="primary" onClick={handleCourseTitleSave}>
                    <Check size={18} />
                  </IconButton>
                  <IconButton label="강의명 수정 취소" tone="neutral" onClick={handleCourseTitleCancel}>
                    <X size={18} />
                  </IconButton>
                </>
              ) : (
                <IconButton label="강의명 수정" tone="neutral" onClick={() => setIsEditingCourseTitle(true)}>
                  <Pencil size={17} />
                </IconButton>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-2">
        <StatCard label="전체" value={String(stats.totalCount)} />
        <StatCard label="완료" value={String(stats.completedCount)} />
        <StatCard label="진도율" value={`${stats.progressRate}%`} />
      </section>

      <section className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-3">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-bold text-gray-700">전체 진도</p>
          <p className="text-sm font-bold text-blue-700">{stats.progressRate}%</p>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-200">
          <div className="h-full rounded-full bg-blue-500" style={{ width: `${stats.progressRate}%` }} />
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-3">
        <label className="block">
          <span className="text-sm font-bold text-gray-900">강의명 검색</span>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="예: 법인세, OT"
            className="mt-2 min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </label>

        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {filterOptions.map((option) => {
            const isActive = statusFilter === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatusFilter(option.value)}
                className={`min-h-9 rounded-full border px-2 text-xs font-bold ${
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

        <label className="mt-3 flex min-h-10 items-center justify-between gap-3 rounded-xl bg-white px-3">
          <span className="text-sm font-bold text-gray-800">완료 강의 숨기기</span>
          <input
            type="checkbox"
            checked={hideCompleted}
            onChange={(event) => setHideCompleted(event.target.checked)}
            className="h-5 w-5 accent-blue-600"
          />
        </label>
      </section>

      <LectureSections
        collapsedSections={collapsedSections}
        editingLectureId={editingLectureId}
        groups={sectionGroups}
        lectureTitleDrafts={lectureTitleDrafts}
        onCancelEdit={handleLectureTitleCancel}
        onChangeDraft={setLectureTitleDrafts}
        onDelete={handleLectureDelete}
        onEdit={setEditingLectureId}
        onSaveTitle={handleLectureTitleSave}
        onStatusChange={handleStatusChange}
        onToggleSection={toggleSection}
        visibleLectureCount={visibleLectureCount}
      />
    </main>
  );
}

function LectureSections({
  collapsedSections,
  editingLectureId,
  groups,
  lectureTitleDrafts,
  onCancelEdit,
  onChangeDraft,
  onDelete,
  onEdit,
  onSaveTitle,
  onStatusChange,
  onToggleSection,
  visibleLectureCount,
}: {
  collapsedSections: Record<string, boolean>;
  editingLectureId: string | null;
  groups: SectionGroup[];
  lectureTitleDrafts: Record<string, string>;
  onCancelEdit: (lectureId: string) => void;
  onChangeDraft: Dispatch<SetStateAction<Record<string, string>>>;
  onDelete: (lectureId: string, title: string) => void;
  onEdit: (lectureId: string) => void;
  onSaveTitle: (lectureId: string) => void;
  onStatusChange: (lectureId: string, status: LectureStatus) => void;
  onToggleSection: (sectionId: string) => void;
  visibleLectureCount: number;
}) {
  return (
    <section className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-950">강의 목록</h2>
        <span className="text-sm font-bold text-gray-500">{visibleLectureCount}개</span>
      </div>

      {visibleLectureCount === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-8 text-center">
          <p className="text-base font-bold text-gray-900">조건에 맞는 강의가 없습니다</p>
          <p className="mt-2 text-sm leading-6 text-gray-500">검색어를 줄이거나 상태 필터를 변경하세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const isCollapsed = collapsedSections[group.section.id] ?? false;

            return (
              <article key={group.section.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                <button
                  type="button"
                  onClick={() => onToggleSection(group.section.id)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left active:bg-gray-100"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold text-gray-950">{group.section.title}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${group.progressRate}%` }} />
                      </div>
                      <span className="text-xs font-bold text-blue-700">{group.progressRate}%</span>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-gray-500">
                    {group.completedCount}/{group.lectures.length}
                  </span>
                </button>

                {isCollapsed ? null : (
                  <div className="border-t border-gray-200">
                    {group.visibleLectures.map((lecture) => (
                      <LectureRow
                        key={lecture.id}
                        draftTitle={lectureTitleDrafts[lecture.id] ?? lecture.title}
                        isEditing={editingLectureId === lecture.id}
                        lecture={lecture}
                        onCancelEdit={onCancelEdit}
                        onChangeDraft={onChangeDraft}
                        onDelete={onDelete}
                        onEdit={onEdit}
                        onSaveTitle={onSaveTitle}
                        onStatusChange={onStatusChange}
                      />
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function LectureRow({
  draftTitle,
  isEditing,
  lecture,
  onCancelEdit,
  onChangeDraft,
  onDelete,
  onEdit,
  onSaveTitle,
  onStatusChange,
}: {
  draftTitle: string;
  isEditing: boolean;
  lecture: Lecture;
  onCancelEdit: (lectureId: string) => void;
  onChangeDraft: Dispatch<SetStateAction<Record<string, string>>>;
  onDelete: (lectureId: string, title: string) => void;
  onEdit: (lectureId: string) => void;
  onSaveTitle: (lectureId: string) => void;
  onStatusChange: (lectureId: string, status: LectureStatus) => void;
}) {
  const isCompleted = lecture.status === "COMPLETED";
  const isInProgress = lecture.status === "IN_PROGRESS";

  return (
    <article
      className={`flex min-h-[58px] items-center gap-2 border-b px-3 py-2.5 last:border-b-0 ${
        isCompleted ? "border-green-100 bg-green-50" : "border-gray-200 bg-gray-50"
      }`}
    >
      <StatusIcon status={lecture.status} />

      <div className="min-w-0 flex-1">
        {isEditing ? (
          <input
            value={draftTitle}
            onChange={(event) =>
              onChangeDraft((current) => ({
                ...current,
                [lecture.id]: event.target.value,
              }))
            }
            className="min-h-10 w-full rounded-xl border border-blue-200 bg-white px-3 text-sm font-bold text-gray-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            aria-label={`${lecture.title} 제목`}
          />
        ) : (
          <>
            <h3 className={`truncate text-sm font-bold ${isCompleted ? "text-green-800" : "text-gray-950"}`}>
              {lecture.title}
            </h3>
            {isCompleted ? (
              <p className="mt-0.5 text-xs font-bold text-green-700">{lecture.completedAt}</p>
            ) : null}
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {isEditing ? (
          <>
            <IconButton label="강의 제목 저장" tone="primary" onClick={() => onSaveTitle(lecture.id)}>
              <Check size={17} />
            </IconButton>
            <IconButton label="강의 제목 수정 취소" tone="neutral" onClick={() => onCancelEdit(lecture.id)}>
              <X size={17} />
            </IconButton>
          </>
        ) : (
          <>
            <IconButton
              active={isInProgress}
              label="수강중으로 변경"
              tone="warning"
              onClick={() => onStatusChange(lecture.id, "IN_PROGRESS")}
            >
              <PlayCircle size={17} />
            </IconButton>
            <IconButton
              active={isCompleted}
              label="완강으로 변경"
              tone="success"
              onClick={() => onStatusChange(lecture.id, "COMPLETED")}
            >
              <CheckCircle2 size={17} />
            </IconButton>
            <IconButton label="강의 제목 수정" tone="neutral" onClick={() => onEdit(lecture.id)}>
              <Pencil size={16} />
            </IconButton>
            <IconButton label="강의 삭제" tone="danger" onClick={() => onDelete(lecture.id, lecture.title)}>
              <Trash2 size={16} />
            </IconButton>
          </>
        )}
      </div>
    </article>
  );
}

function StatusIcon({ status }: { status: LectureStatus }) {
  if (status === "COMPLETED") {
    return <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" aria-label="완강" />;
  }

  if (status === "IN_PROGRESS") {
    return <Clock3 className="h-5 w-5 shrink-0 text-yellow-600" aria-label="수강중" />;
  }

  return <Circle className="h-5 w-5 shrink-0 text-gray-300" aria-label="미수강" />;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs font-bold leading-4 text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-950">{value}</p>
    </div>
  );
}

function IconButton({
  active = false,
  children,
  label,
  onClick,
  tone,
}: {
  active?: boolean;
  children: ReactNode;
  label: string;
  onClick: () => void;
  tone: "danger" | "neutral" | "primary" | "success" | "warning";
}) {
  const toneClass = {
    danger: "border-red-100 bg-white text-red-600 active:bg-red-50",
    neutral: "border-gray-200 bg-white text-gray-600 active:bg-gray-100",
    primary: "border-blue-600 bg-blue-600 text-white active:bg-blue-700",
    success: active
      ? "border-green-500 bg-green-500 text-white"
      : "border-green-100 bg-white text-green-600 active:bg-green-50",
    warning: active
      ? "border-yellow-500 bg-yellow-500 text-white"
      : "border-yellow-100 bg-white text-yellow-700 active:bg-yellow-50",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-full border ${toneClass}`}
      aria-label={label}
    >
      {children}
    </button>
  );
}
