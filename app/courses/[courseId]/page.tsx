"use client";

import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  MoreHorizontal,
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
  updateSectionPlan,
} from "@/lib/storage";
import type { CourseWithLectures, Lecture, LectureStatus, Section } from "@/lib/types";

type StatusFilter = "ALL" | LectureStatus;
type SectionAction = "COMPLETE" | "IN_PROGRESS";
type SectionGroup = {
  section: Section;
  lectures: Lecture[];
  visibleLectures: Lecture[];
  completedCount: number;
  progressRate: number;
  allCompleted: boolean;
  allInProgress: boolean;
  sectionMatchesSearch: boolean;
};
type SectionConfirm = {
  action: SectionAction;
  group: SectionGroup;
  nextStatus: LectureStatus;
  message: string;
} | null;
type SectionPlanDraft = {
  sectionId: string;
  sectionTitle: string;
  planStartDate: string;
  planEndDate: string;
  dailyTargetCount: string;
} | null;

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
  const [openLectureMenuId, setOpenLectureMenuId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [sectionConfirm, setSectionConfirm] = useState<SectionConfirm>(null);
  const [sectionPlanDraft, setSectionPlanDraft] = useState<SectionPlanDraft>(null);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const nextCourse = getCourse(params.courseId);
    setCourse(nextCourse);
    setCourseTitleDraft(nextCourse?.title ?? "");
    setLectureTitleDrafts(
      Object.fromEntries((nextCourse?.lectures ?? []).map((lecture) => [lecture.id, lecture.title])),
    );
    setCollapsedSections(
      Object.fromEntries((nextCourse?.sections ?? []).map((section) => [section.id, true])),
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
        const sectionMatchesSearch = keyword.length > 0 && section.title.toLowerCase().includes(keyword);
        const lectures = course.lectures.filter((lecture) => lecture.sectionId === section.id);
        const visibleLectures = lectures.filter((lecture) => {
          const matchesSearch =
            keyword.length === 0 || sectionMatchesSearch || lecture.title.toLowerCase().includes(keyword);
          const matchesStatus = statusFilter === "ALL" || lecture.status === statusFilter;
          const matchesVisibility = !hideCompleted || lecture.status !== "COMPLETED";

          return matchesSearch && matchesStatus && matchesVisibility;
        });
        const completedCount = lectures.filter((lecture) => lecture.status === "COMPLETED").length;
        const progressRate = lectures.length === 0 ? 0 : Math.round((completedCount / lectures.length) * 100);
        const allCompleted = lectures.length > 0 && lectures.every((lecture) => lecture.status === "COMPLETED");
        const allInProgress = lectures.length > 0 && lectures.every((lecture) => lecture.status === "IN_PROGRESS");

        return {
          section,
          lectures,
          visibleLectures,
          completedCount,
          progressRate,
          allCompleted,
          allInProgress,
          sectionMatchesSearch,
        };
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

  function refreshCourse() {
    setCourse(getCourse(params.courseId));
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
    refreshCourse();
    setOpenLectureMenuId(null);
    setLectureTitleDrafts((current) => {
      const next = { ...current };
      delete next[lectureId];
      return next;
    });
    showFeedback("삭제되었습니다");
  }

  function handleLectureToggle(lecture: Lecture) {
    const nextStatus: LectureStatus =
      lecture.status === "NOT_STARTED"
        ? "IN_PROGRESS"
        : lecture.status === "IN_PROGRESS"
          ? "COMPLETED"
          : "NOT_STARTED";
    const updatedLecture = updateLectureStatus(params.courseId, lecture.id, nextStatus);
    if (!updatedLecture) {
      return;
    }

    setCourse((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        lectures: current.lectures.map((item) => (item.id === lecture.id ? updatedLecture : item)),
      };
    });
    showFeedback("상태가 변경되었습니다");
  }

  function handleLectureEditStart(lectureId: string) {
    setEditingLectureId(lectureId);
    setOpenLectureMenuId(null);
  }

  function handleLectureMenuToggle(lectureId: string) {
    setOpenLectureMenuId((current) => (current === lectureId ? null : lectureId));
  }

  function openSectionConfirm(group: SectionGroup, action: SectionAction) {
    const isCompleteAction = action === "COMPLETE";
    const nextStatus: LectureStatus = isCompleteAction
      ? group.allCompleted
        ? "NOT_STARTED"
        : "COMPLETED"
      : group.allInProgress
        ? "NOT_STARTED"
        : "IN_PROGRESS";
    const count = group.lectures.length;
    const message = isCompleteAction
      ? group.allCompleted
        ? "이 섹션의 완강 상태를 모두 해제할까요?"
        : `이 섹션의 ${count}개 강의를 모두 완강 처리할까요?`
      : group.allInProgress
        ? "이 섹션의 수강중 상태를 모두 해제할까요?"
        : `이 섹션의 ${count}개 강의를 모두 수강중으로 변경할까요?`;

    setSectionConfirm({ action, group, nextStatus, message });
  }

  function applySectionConfirm() {
    if (!sectionConfirm) {
      return;
    }

    sectionConfirm.group.lectures.forEach((lecture) => {
      updateLectureStatus(params.courseId, lecture.id, sectionConfirm.nextStatus);
    });

    refreshCourse();
    setSectionConfirm(null);
    showFeedback("섹션 상태가 변경되었습니다");
  }

  function openSectionPlan(section: Section) {
    setSectionPlanDraft({
      sectionId: section.id,
      sectionTitle: section.title,
      planStartDate: section.planStartDate ?? "",
      planEndDate: section.planEndDate ?? "",
      dailyTargetCount: section.dailyTargetCount ? String(section.dailyTargetCount) : "",
    });
  }

  function saveSectionPlan() {
    if (!sectionPlanDraft) {
      return;
    }

    const updatedSection = updateSectionPlan(params.courseId, sectionPlanDraft.sectionId, {
      planStartDate: sectionPlanDraft.planStartDate,
      planEndDate: sectionPlanDraft.planEndDate,
      dailyTargetCount: Number(sectionPlanDraft.dailyTargetCount),
    });

    if (!updatedSection) {
      setSectionPlanDraft(null);
      return;
    }

    setCourse((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        sections: current.sections.map((section) =>
          section.id === updatedSection.id ? updatedSection : section,
        ),
      };
    });
    setSectionPlanDraft(null);
    showFeedback("계획이 저장되었습니다");
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
          <span className="text-sm font-bold text-gray-900">강의명 또는 섹션명 검색</span>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="예: 법인세, OT, 1과목"
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
        openLectureMenuId={openLectureMenuId}
        onCancelEdit={handleLectureTitleCancel}
        onChangeDraft={setLectureTitleDrafts}
        onDelete={handleLectureDelete}
        onEdit={handleLectureEditStart}
        onLectureMenuToggle={handleLectureMenuToggle}
        onPlanEdit={openSectionPlan}
        onSaveTitle={handleLectureTitleSave}
        onSectionAction={openSectionConfirm}
        onStatusToggle={handleLectureToggle}
        onToggleSection={toggleSection}
        visibleLectureCount={visibleLectureCount}
      />

      <ConfirmModal
        confirm={sectionConfirm}
        onCancel={() => setSectionConfirm(null)}
        onConfirm={applySectionConfirm}
      />
      <SectionPlanModal
        draft={sectionPlanDraft}
        onCancel={() => setSectionPlanDraft(null)}
        onChange={setSectionPlanDraft}
        onSave={saveSectionPlan}
      />
    </main>
  );
}

function LectureSections({
  collapsedSections,
  editingLectureId,
  groups,
  lectureTitleDrafts,
  openLectureMenuId,
  onCancelEdit,
  onChangeDraft,
  onDelete,
  onEdit,
  onLectureMenuToggle,
  onPlanEdit,
  onSaveTitle,
  onSectionAction,
  onStatusToggle,
  onToggleSection,
  visibleLectureCount,
}: {
  collapsedSections: Record<string, boolean>;
  editingLectureId: string | null;
  groups: SectionGroup[];
  lectureTitleDrafts: Record<string, string>;
  openLectureMenuId: string | null;
  onCancelEdit: (lectureId: string) => void;
  onChangeDraft: Dispatch<SetStateAction<Record<string, string>>>;
  onDelete: (lectureId: string, title: string) => void;
  onEdit: (lectureId: string) => void;
  onLectureMenuToggle: (lectureId: string) => void;
  onPlanEdit: (section: Section) => void;
  onSaveTitle: (lectureId: string) => void;
  onSectionAction: (group: SectionGroup, action: SectionAction) => void;
  onStatusToggle: (lecture: Lecture) => void;
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
            const isCollapsed = collapsedSections[group.section.id] ?? true;

            return (
              <article key={group.section.id} className="overflow-visible rounded-2xl border border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => onToggleSection(group.section.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left active:opacity-70"
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
                  <IconButton
                    active={group.allInProgress}
                    label="섹션 수강중 변경"
                    tone="warning"
                    onClick={() => onSectionAction(group, "IN_PROGRESS")}
                  >
                    <PlayCircle size={17} />
                  </IconButton>
                  <IconButton
                    active={group.allCompleted}
                    label="섹션 완강 변경"
                    tone="success"
                    onClick={() => onSectionAction(group, "COMPLETE")}
                  >
                    <CheckCircle2 size={17} />
                  </IconButton>
                  <IconButton label="섹션 계획 수정" tone="neutral" onClick={() => onPlanEdit(group.section)}>
                    <Pencil size={16} />
                  </IconButton>
                </div>

                {isCollapsed ? null : (
                  <div className="border-t border-gray-200">
                    {group.visibleLectures.map((lecture) => (
                      <LectureRow
                        key={lecture.id}
                        draftTitle={lectureTitleDrafts[lecture.id] ?? lecture.title}
                        isEditing={editingLectureId === lecture.id}
                        isMenuOpen={openLectureMenuId === lecture.id}
                        lecture={lecture}
                        onCancelEdit={onCancelEdit}
                        onChangeDraft={onChangeDraft}
                        onDelete={onDelete}
                        onEdit={onEdit}
                        onMenuToggle={onLectureMenuToggle}
                        onSaveTitle={onSaveTitle}
                        onStatusToggle={onStatusToggle}
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
  isMenuOpen,
  lecture,
  onCancelEdit,
  onChangeDraft,
  onDelete,
  onEdit,
  onMenuToggle,
  onSaveTitle,
  onStatusToggle,
}: {
  draftTitle: string;
  isEditing: boolean;
  isMenuOpen: boolean;
  lecture: Lecture;
  onCancelEdit: (lectureId: string) => void;
  onChangeDraft: Dispatch<SetStateAction<Record<string, string>>>;
  onDelete: (lectureId: string, title: string) => void;
  onEdit: (lectureId: string) => void;
  onMenuToggle: (lectureId: string) => void;
  onSaveTitle: (lectureId: string) => void;
  onStatusToggle: (lecture: Lecture) => void;
}) {
  const isCompleted = lecture.status === "COMPLETED";

  return (
    <article
      className={`relative flex min-h-[46px] items-center gap-2 border-b px-2.5 py-1.5 last:border-b-0 ${
        isCompleted ? "border-green-100 bg-green-50" : "border-gray-200 bg-gray-50"
      } ${isMenuOpen ? "z-30" : "z-0"}`}
    >
      {isEditing ? (
        <StatusIcon status={lecture.status} />
      ) : (
        <button
          type="button"
          onClick={() => onStatusToggle(lecture)}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
            lecture.status === "COMPLETED"
              ? "border-green-500 bg-green-500 text-white active:bg-green-600"
              : lecture.status === "IN_PROGRESS"
                ? "border-yellow-200 bg-yellow-50 text-yellow-700 active:bg-yellow-100"
                : "border-gray-200 bg-white text-gray-400 active:bg-gray-100"
          }`}
          aria-label="강의 상태 변경"
        >
          <StatusIcon status={lecture.status} />
        </button>
      )}

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
            className="min-h-9 w-full rounded-xl border border-blue-200 bg-white px-3 text-sm font-bold text-gray-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
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
            <IconButton label="강의 메뉴 열기" tone="neutral" onClick={() => onMenuToggle(lecture.id)}>
              <MoreHorizontal size={17} />
            </IconButton>
            {isMenuOpen ? (
              <div className="absolute right-2 top-9 z-50 w-28 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => onEdit(lecture.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-gray-700 active:bg-gray-100"
                >
                  <Pencil size={15} />
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(lecture.id, lecture.title)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-red-600 active:bg-red-50"
                >
                  <Trash2 size={15} />
                  삭제
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}

function SectionPlanModal({
  draft,
  onCancel,
  onChange,
  onSave,
}: {
  draft: SectionPlanDraft;
  onCancel: () => void;
  onChange: Dispatch<SetStateAction<SectionPlanDraft>>;
  onSave: () => void;
}) {
  if (!draft) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/30 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))]">
      <div className="flex max-h-[calc(100dvh-24px)] w-full max-w-screen-sm flex-col rounded-2xl bg-white shadow-xl">
        <div className="shrink-0 px-4 pt-4">
          <h2 className="text-lg font-bold text-gray-950">계획 수정</h2>
          <p className="mt-1 truncate text-sm font-bold text-gray-500">{draft.sectionTitle}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-2.5">
            <label className="block">
              <span className="text-sm font-bold text-gray-800">시작 날짜</span>
              <input
                type="date"
                value={draft.planStartDate}
                onChange={(event) =>
                  onChange((current) =>
                    current ? { ...current, planStartDate: event.target.value } : current,
                  )
                }
                className="mt-1 box-border min-h-10 w-full min-w-0 appearance-none rounded-xl border border-gray-200 bg-white px-2.5 text-sm text-gray-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-gray-800">종료 날짜</span>
              <input
                type="date"
                value={draft.planEndDate}
                onChange={(event) =>
                  onChange((current) =>
                    current ? { ...current, planEndDate: event.target.value } : current,
                  )
                }
                className="mt-1 box-border min-h-10 w-full min-w-0 appearance-none rounded-xl border border-gray-200 bg-white px-2.5 text-sm text-gray-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-gray-800">하루 목표 강의 수</span>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={draft.dailyTargetCount}
                onChange={(event) =>
                  onChange((current) =>
                    current ? { ...current, dailyTargetCount: event.target.value } : current,
                  )
                }
                className="mt-1 box-border min-h-10 w-full min-w-0 appearance-none rounded-xl border border-gray-200 bg-white px-2.5 text-sm text-gray-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </label>
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-gray-100 px-4 pb-4 pt-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 active:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onSave}
            className="min-h-11 rounded-xl bg-blue-600 text-sm font-bold text-white active:bg-blue-700"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({
  confirm,
  onCancel,
  onConfirm,
}: {
  confirm: SectionConfirm;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!confirm) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/30 px-4 pb-6 pt-20">
      <div className="w-full max-w-screen-sm rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-gray-950">섹션 상태 변경</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">{confirm.message}</p>
        <p className="mt-1 text-xs font-bold text-gray-400">{confirm.group.section.title}</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 active:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-12 rounded-xl bg-blue-600 text-sm font-bold text-white active:bg-blue-700"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: LectureStatus }) {
  if (status === "COMPLETED") {
    return <CheckCircle2 className="h-5 w-5 shrink-0" aria-label="완강" />;
  }

  if (status === "IN_PROGRESS") {
    return <PlayCircle className="h-5 w-5 shrink-0" aria-label="수강중" />;
  }

  return <Circle className="h-5 w-5 shrink-0" aria-label="미수강" />;
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
