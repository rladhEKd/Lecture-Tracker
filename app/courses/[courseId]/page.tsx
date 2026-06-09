"use client";

import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  MoreHorizontal,
  Pencil,
  PlayCircle,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  completeCourseRound,
  deleteSection,
  deleteLecture,
  getCourse,
  updateCourseTitle,
  updateCourseRound,
  updateLectureStatus,
  updateLectureTitle,
  updateSectionPlan,
  updateSectionTitle,
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
type SectionTitleDraft = {
  sectionId: string;
  currentTitle: string;
  title: string;
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
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [courseTitleDraft, setCourseTitleDraft] = useState("");
  const [lectureTitleDrafts, setLectureTitleDrafts] = useState<Record<string, string>>({});
  const [isEditingCourseTitle, setIsEditingCourseTitle] = useState(false);
  const [isCourseMenuOpen, setIsCourseMenuOpen] = useState(false);
  const [editingLectureId, setEditingLectureId] = useState<string | null>(null);
  const [openLectureMenuId, setOpenLectureMenuId] = useState<string | null>(null);
  const [openSectionMenuId, setOpenSectionMenuId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [sectionConfirm, setSectionConfirm] = useState<SectionConfirm>(null);
  const [sectionPlanDraft, setSectionPlanDraft] = useState<SectionPlanDraft>(null);
  const [sectionTitleDraft, setSectionTitleDraft] = useState<SectionTitleDraft>(null);
  const [roundDraft, setRoundDraft] = useState<string | null>(null);
  const [isRoundConfirmOpen, setIsRoundConfirmOpen] = useState(false);
  const [isRoundHistoryOpen, setIsRoundHistoryOpen] = useState(false);
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
  const isCurrentRoundCompleted = stats.totalCount > 0 && stats.completedCount === stats.totalCount;

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

  function openRoundEdit() {
    setIsCourseMenuOpen(false);
    setRoundDraft(String(course?.currentRound ?? 1));
  }

  function saveRoundEdit() {
    if (roundDraft === null) {
      return;
    }

    const updatedCourse = updateCourseRound(params.courseId, Number(roundDraft));
    if (!updatedCourse) {
      setRoundDraft(null);
      return;
    }

    setCourse(updatedCourse);
    setRoundDraft(null);
    showFeedback("회독이 저장되었습니다");
  }

  function completeRound() {
    const updatedCourse = completeCourseRound(params.courseId);
    if (!updatedCourse) {
      setIsRoundConfirmOpen(false);
      return;
    }

    setCourse(updatedCourse);
    setLectureTitleDrafts(
      Object.fromEntries(updatedCourse.lectures.map((lecture) => [lecture.id, lecture.title])),
    );
    setIsRoundConfirmOpen(false);
    setStatusFilter("ALL");
    setHideCompleted(false);
    showFeedback("새 회독을 시작했습니다");
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
    setOpenSectionMenuId(null);
    setOpenLectureMenuId((current) => (current === lectureId ? null : lectureId));
  }

  function handleSectionMenuToggle(sectionId: string) {
    setOpenLectureMenuId(null);
    setOpenSectionMenuId((current) => (current === sectionId ? null : sectionId));
  }

  function openSectionConfirm(group: SectionGroup) {
    const nextStatus: LectureStatus = group.allCompleted
      ? "NOT_STARTED"
      : group.allInProgress
        ? "COMPLETED"
        : "IN_PROGRESS";
    const count = group.lectures.length;
    const message =
      nextStatus === "NOT_STARTED"
        ? "이 섹션의 완강 상태를 모두 해제할까요?"
        : nextStatus === "COMPLETED"
          ? `이 섹션의 ${count}개 강의를 모두 완강 처리할까요?`
          : `이 섹션의 ${count}개 강의를 모두 수강중으로 변경할까요?`;

    setOpenSectionMenuId(null);
    setSectionConfirm({ action: "IN_PROGRESS", group, nextStatus, message });
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
    setOpenSectionMenuId(null);
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

  function openSectionTitleEdit(section: Section) {
    setOpenSectionMenuId(null);
    setSectionTitleDraft({
      sectionId: section.id,
      currentTitle: section.title,
      title: section.title,
    });
  }

  function saveSectionTitle() {
    if (!sectionTitleDraft) {
      return;
    }

    const updatedSection = updateSectionTitle(params.courseId, sectionTitleDraft.sectionId, sectionTitleDraft.title);
    if (!updatedSection) {
      setSectionTitleDraft(null);
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
    setSectionTitleDraft(null);
    showFeedback("섹션명이 저장되었습니다");
  }

  function handleSectionDelete(section: Section) {
    setOpenSectionMenuId(null);
    const confirmed = window.confirm(`"${section.title}" 섹션을 삭제할까요?\n연결된 강의도 함께 삭제됩니다.`);
    if (!confirmed) {
      return;
    }

    deleteSection(params.courseId, section.id);
    refreshCourse();
    showFeedback("섹션이 삭제되었습니다");
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

      <header className="mb-4 space-y-3">
        <div className="flex min-h-10 items-center gap-2">
          <Link
            href="/"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-700 active:bg-gray-100"
            aria-label="돌아가기"
          >
            <ArrowLeft size={19} />
          </Link>
          {isEditingCourseTitle ? (
            <input
              value={courseTitleDraft}
              onChange={(event) => setCourseTitleDraft(event.target.value)}
              className="min-h-10 min-w-0 flex-1 rounded-xl border border-blue-200 bg-white px-3 text-lg font-bold text-gray-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              aria-label="강의명"
            />
          ) : (
            <h1 className="min-w-0 flex-1 truncate text-xl font-bold leading-tight text-gray-950">
              {course.title}
            </h1>
          )}
          <div className="relative flex shrink-0 gap-1">
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
            {!isEditingCourseTitle ? (
              <>
                <IconButton label="강의 메뉴 열기" tone="neutral" onClick={() => setIsCourseMenuOpen((current) => !current)}>
                  <MoreHorizontal size={17} />
                </IconButton>
                {isCourseMenuOpen ? (
                  <div className="absolute right-0 top-10 z-50 w-36 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
                    <button
                      type="button"
                      onClick={openRoundEdit}
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-bold text-gray-700 active:bg-gray-100"
                    >
                      회독 수정
                    </button>
                    {isCurrentRoundCompleted ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsCourseMenuOpen(false);
                          setIsRoundConfirmOpen(true);
                        }}
                        className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-bold text-green-700 active:bg-green-50"
                      >
                        다음 회독 시작
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setIsCourseMenuOpen(false);
                        setIsRoundHistoryOpen(true);
                      }}
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-bold text-gray-700 active:bg-gray-100"
                    >
                      회독 이력
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="text-sm font-bold text-gray-700">전체 진도</p>
            <span className="text-xs font-bold text-gray-400">·</span>
            <p className="text-xs font-bold text-gray-500">
              {stats.completedCount}/{stats.totalCount}
            </p>
          </div>
          <p className="text-sm font-bold text-blue-700">{stats.progressRate}%</p>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-200">
          <div className="h-full rounded-full bg-blue-500" style={{ width: `${stats.progressRate}%` }} />
        </div>

        <div className="flex items-center gap-2">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="강의명 또는 섹션명 검색"
            className="min-h-10 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
          <button
            type="button"
            onClick={() => setIsFilterOpen((current) => !current)}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
              isFilterOpen || statusFilter !== "ALL" || hideCompleted
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-gray-200 bg-white text-gray-600 active:bg-gray-100"
            }`}
            aria-label="필터"
          >
            <SlidersHorizontal size={17} />
          </button>
        </div>

        {statusFilter !== "ALL" || hideCompleted ? (
          <p className="mt-2 truncate px-1 text-xs font-bold text-blue-700">
            {[hideCompleted ? "완강 숨김" : null, statusFilter !== "ALL" ? statusOptions.find((option) => option.value === statusFilter)?.label : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}

        {isFilterOpen ? (
          <div className="mt-2 rounded-xl bg-white p-2">
            <div className="grid grid-cols-4 gap-1.5">
              {filterOptions.map((option) => {
                const isActive = statusFilter === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStatusFilter(option.value)}
                    className={`min-h-8 rounded-full border px-2 text-xs font-bold ${
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

            <label className="mt-2 flex min-h-9 items-center justify-between gap-3 rounded-xl bg-gray-50 px-3">
              <span className="text-sm font-bold text-gray-800">완료 강의 숨기기</span>
              <input
                type="checkbox"
                checked={hideCompleted}
                onChange={(event) => setHideCompleted(event.target.checked)}
                className="h-5 w-5 accent-blue-600"
              />
            </label>
          </div>
        ) : null}
      </header>

      <LectureSections
        collapsedSections={collapsedSections}
        currentRound={course.currentRound ?? 1}
        editingLectureId={editingLectureId}
        groups={sectionGroups}
        lectureTitleDrafts={lectureTitleDrafts}
        openLectureMenuId={openLectureMenuId}
        openSectionMenuId={openSectionMenuId}
        onCancelEdit={handleLectureTitleCancel}
        onChangeDraft={setLectureTitleDrafts}
        onDelete={handleLectureDelete}
        onEdit={handleLectureEditStart}
        onSectionDelete={handleSectionDelete}
        onSectionMenuToggle={handleSectionMenuToggle}
        onSectionTitleEdit={openSectionTitleEdit}
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
      <SectionTitleModal
        draft={sectionTitleDraft}
        onCancel={() => setSectionTitleDraft(null)}
        onChange={setSectionTitleDraft}
        onSave={saveSectionTitle}
      />
      <RoundEditModal
        value={roundDraft}
        onCancel={() => setRoundDraft(null)}
        onChange={setRoundDraft}
        onSave={saveRoundEdit}
      />
      <RoundConfirmModal
        course={course}
        isOpen={isRoundConfirmOpen}
        onCancel={() => setIsRoundConfirmOpen(false)}
        onConfirm={completeRound}
      />
      <RoundHistoryModal
        course={course}
        isOpen={isRoundHistoryOpen}
        onClose={() => setIsRoundHistoryOpen(false)}
      />
    </main>
  );
}

function LectureSections({
  collapsedSections,
  currentRound,
  editingLectureId,
  groups,
  lectureTitleDrafts,
  openLectureMenuId,
  openSectionMenuId,
  onCancelEdit,
  onChangeDraft,
  onDelete,
  onEdit,
  onLectureMenuToggle,
  onPlanEdit,
  onSaveTitle,
  onSectionAction,
  onSectionDelete,
  onSectionMenuToggle,
  onSectionTitleEdit,
  onStatusToggle,
  onToggleSection,
  visibleLectureCount,
}: {
  collapsedSections: Record<string, boolean>;
  currentRound: number;
  editingLectureId: string | null;
  groups: SectionGroup[];
  lectureTitleDrafts: Record<string, string>;
  openLectureMenuId: string | null;
  openSectionMenuId: string | null;
  onCancelEdit: (lectureId: string) => void;
  onChangeDraft: Dispatch<SetStateAction<Record<string, string>>>;
  onDelete: (lectureId: string, title: string) => void;
  onEdit: (lectureId: string) => void;
  onLectureMenuToggle: (lectureId: string) => void;
  onPlanEdit: (section: Section) => void;
  onSaveTitle: (lectureId: string) => void;
  onSectionAction: (group: SectionGroup) => void;
  onSectionDelete: (section: Section) => void;
  onSectionMenuToggle: (sectionId: string) => void;
  onSectionTitleEdit: (section: Section) => void;
  onStatusToggle: (lecture: Lecture) => void;
  onToggleSection: (sectionId: string) => void;
  visibleLectureCount: number;
}) {
  return (
    <section className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-lg font-bold text-gray-950">강의 목록</h2>
          <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
            {currentRound}회독
          </span>
        </div>
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
            const isSectionMenuOpen = openSectionMenuId === group.section.id;

            return (
              <article
                key={group.section.id}
                className={`relative overflow-visible rounded-2xl border border-gray-200 bg-gray-50 ${
                  isSectionMenuOpen ? "z-40" : "z-0"
                }`}
              >
                <div className="flex min-h-[54px] items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onToggleSection(group.section.id)}
                    className="flex min-h-10 min-w-0 flex-1 items-center gap-2 text-left active:opacity-70"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col justify-center">
                      <h3 className="truncate text-sm font-bold text-gray-950">{group.section.title}</h3>
                      <div className="mt-0.5 flex items-center gap-2">
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
                  <div className="flex min-h-10 shrink-0 items-center gap-1">
                    <IconButton
                      active={group.allInProgress || group.allCompleted}
                      label="섹션 상태 변경"
                      tone={group.allCompleted ? "success" : group.allInProgress ? "warning" : "neutral"}
                      onClick={() => onSectionAction(group)}
                    >
                      {group.allCompleted ? (
                        <CheckCircle2 size={17} />
                      ) : group.allInProgress ? (
                        <PlayCircle size={17} />
                      ) : (
                        <Circle size={17} />
                      )}
                    </IconButton>
                    <IconButton label="섹션 메뉴 열기" tone="neutral" onClick={() => onSectionMenuToggle(group.section.id)}>
                      <MoreHorizontal size={17} />
                    </IconButton>
                  </div>
                  {isSectionMenuOpen ? (
                    <div className="absolute right-3 top-12 z-50 w-36 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
                      <button
                        type="button"
                        onClick={() => onPlanEdit(group.section)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-gray-700 active:bg-gray-100"
                      >
                        <Pencil size={15} />
                        계획 설정
                      </button>
                      <button
                        type="button"
                        onClick={() => onSectionTitleEdit(group.section)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-gray-700 active:bg-gray-100"
                      >
                        <Pencil size={15} />
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => onSectionDelete(group.section)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-red-600 active:bg-red-50"
                      >
                        <Trash2 size={15} />
                        삭제
                      </button>
                    </div>
                  ) : null}
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

function SectionTitleModal({
  draft,
  onCancel,
  onChange,
  onSave,
}: {
  draft: SectionTitleDraft;
  onCancel: () => void;
  onChange: Dispatch<SetStateAction<SectionTitleDraft>>;
  onSave: () => void;
}) {
  if (!draft) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/30 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))]">
      <div className="w-full max-w-screen-sm rounded-2xl bg-white p-4 shadow-xl">
        <h2 className="text-lg font-bold text-gray-950">섹션명 수정</h2>
        <p className="mt-1 truncate text-sm font-bold text-gray-500">{draft.currentTitle}</p>
        <label className="mt-4 block">
          <span className="text-sm font-bold text-gray-800">섹션명</span>
          <input
            value={draft.title}
            onChange={(event) =>
              onChange((current) => (current ? { ...current, title: event.target.value } : current))
            }
            className="mt-1 box-border min-h-11 w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </label>
        <div className="mt-5 grid grid-cols-2 gap-2">
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

function RoundEditModal({
  value,
  onCancel,
  onChange,
  onSave,
}: {
  value: string | null;
  onCancel: () => void;
  onChange: Dispatch<SetStateAction<string | null>>;
  onSave: () => void;
}) {
  if (value === null) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/30 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))]">
      <div className="w-full max-w-screen-sm rounded-2xl bg-white p-4 shadow-xl">
        <h2 className="text-lg font-bold text-gray-950">현재 회독 수정</h2>
        <label className="mt-4 block">
          <span className="text-sm font-bold text-gray-800">회독</span>
          <input
            type="number"
            min="1"
            inputMode="numeric"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="mt-1 box-border min-h-11 w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </label>
        <div className="mt-5 grid grid-cols-2 gap-2">
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

function RoundConfirmModal({
  course,
  isOpen,
  onCancel,
  onConfirm,
}: {
  course: CourseWithLectures;
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  const currentRound = course.currentRound ?? 1;

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/30 px-4 pb-6 pt-20">
      <div className="w-full max-w-screen-sm rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-gray-950">이번 회독 완료</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          {currentRound}회독을 완료 처리하고 {currentRound + 1}회독을 시작할까요?
        </p>
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

function RoundHistoryModal({
  course,
  isOpen,
  onClose,
}: {
  course: CourseWithLectures;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  const completedRounds = course.completedRounds ?? [];

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/30 px-4 pb-6 pt-20">
      <div className="w-full max-w-screen-sm rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-gray-950">회독 이력</h2>
        {completedRounds.length > 0 ? (
          <div className="mt-3 space-y-2">
            {completedRounds.map((round) => (
              <p key={`${round.round}-${round.completedAt}`} className="text-sm font-bold text-gray-700">
                {round.round}회독 완료 · {round.completedAt}
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm font-bold text-gray-500">아직 완료한 회독이 없습니다.</p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-5 min-h-12 w-full rounded-xl bg-blue-600 text-sm font-bold text-white active:bg-blue-700"
        >
          확인
        </button>
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
