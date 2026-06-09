"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertCircle, CheckCircle2, Clock, Settings2 } from "lucide-react";
import Link from "next/link";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { deleteCourse, exportCourses, getCourses, importCourses, updateCourseOrder } from "@/lib/storage";
import type { CourseWithLectures } from "@/lib/types";

function getProgress(course: CourseWithLectures) {
  if (course.lectures.length === 0) {
    return 0;
  }

  const completedCount = course.lectures.filter((lecture) => lecture.status === "COMPLETED").length;
  return Math.round((completedCount / course.lectures.length) * 100);
}

function getKoreaTodayDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getDateDiffDays(fromDate: string, toDate: string) {
  const from = Date.UTC(
    Number(fromDate.slice(0, 4)),
    Number(fromDate.slice(5, 7)) - 1,
    Number(fromDate.slice(8, 10)),
  );
  const to = Date.UTC(
    Number(toDate.slice(0, 4)),
    Number(toDate.slice(5, 7)) - 1,
    Number(toDate.slice(8, 10)),
  );

  return Math.floor((to - from) / 86400000);
}

function getSectionPlanSummaries(course: CourseWithLectures) {
  const today = getKoreaTodayDateString();
  const summaries = course.sections
    .map((section) => {
      if (!section.planStartDate || !section.dailyTargetCount) {
        return null;
      }

      const sectionLectures = course.lectures.filter((lecture) => lecture.sectionId === section.id);
      const totalCount = sectionLectures.length;
      const completedCount = sectionLectures.filter((lecture) => lecture.status === "COMPLETED").length;
      const hasEnded = Boolean(section.planEndDate && today > section.planEndDate);
      const elapsedDays =
        today < section.planStartDate
          ? 0
          : hasEnded
            ? totalCount
            : getDateDiffDays(section.planStartDate, today) + 1;
      const requiredCount =
        hasEnded
          ? totalCount
          : Math.min(totalCount, Math.max(0, elapsedDays) * section.dailyTargetCount);
      const overdueCount = Math.max(0, requiredCount - completedCount);
      const status = overdueCount > 0 ? "overdue" : "onTrack";

      return {
        sectionTitle: section.title,
        overdueCount,
        neededCount: 0,
        status,
      };
    })
    .filter(
      (summary): summary is {
        sectionTitle: string;
        overdueCount: number;
        neededCount: number;
        status: "overdue" | "needed" | "onTrack";
      } => summary !== null,
    );

  return summaries;
}

function getBackupFileName() {
  return `lecture-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [courses, setCourses] = useState<CourseWithLectures[]>([]);
  const [message, setMessage] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isManageMode, setIsManageMode] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    setCourses((current) => {
      const oldIndex = current.findIndex((course) => course.id === active.id);
      const newIndex = current.findIndex((course) => course.id === over.id);
      if (oldIndex < 0 || newIndex < 0) {
        return current;
      }

      const nextCourses = arrayMove(current, oldIndex, newIndex);
      updateCourseOrder(nextCourses.map((course) => course.id));
      return nextCourses.map((course, index) => ({ ...course, order: index }));
    });
  }

  function handleBackup() {
    const data = exportCourses();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = getBackupFileName();
    link.click();
    URL.revokeObjectURL(url);
    setMessage("백업 파일을 다운로드했습니다.");
    setIsSettingsOpen(false);
  }

  async function handleRestore(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const confirmed = window.confirm("현재 저장된 데이터가 덮어쓰기 됩니다. 계속할까요?");
    if (!confirmed) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const restoredCourses = importCourses(parsed);
      setCourses(restoredCourses);
      setMessage("데이터를 불러왔습니다.");
      setIsSettingsOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "백업 파일을 불러오지 못했습니다.";
      setMessage(errorMessage);
      setIsSettingsOpen(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col bg-white px-5 pb-10 pt-[max(24px,env(safe-area-inset-top))]">
      <header className="flex items-start justify-between gap-4 pb-6">
        <div>
          <p className="text-sm font-bold text-blue-600">진도 관리</p>
          <h1 className="mt-1 text-3xl font-bold tracking-normal text-gray-950">Lecture Tracker</h1>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsSettingsOpen((current) => !current)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-700 active:bg-gray-100"
            aria-label="설정"
          >
            <GearIcon />
          </button>

          {isSettingsOpen ? (
            <div className="absolute right-0 top-12 z-10 w-48 rounded-2xl border border-gray-200 bg-white p-2 shadow-lg">
              <button
                type="button"
                onClick={handleBackup}
                className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-bold text-gray-800 active:bg-gray-50"
              >
                데이터 백업
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-bold text-gray-800 active:bg-gray-50"
              >
                데이터 불러오기
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleRestore}
        className="hidden"
      />
      {message ? <p className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">{message}</p> : null}

      <section className="mt-4 flex-1">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-gray-950">내 강의</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500">{courses.length}개 과정</span>
            <Link
              href="/courses/new"
              className="flex min-h-9 items-center rounded-full bg-blue-600 px-3 text-sm font-bold text-white active:bg-blue-700"
            >
              + 강의 추가
            </Link>
            <button
              type="button"
              onClick={() => setIsManageMode((current) => !current)}
              className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                isManageMode
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-200 bg-white text-gray-700 active:bg-gray-50"
              }`}
              aria-label="강의 관리"
            >
              <Settings2 size={17} />
            </button>
          </div>
        </div>

        {courses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-8 text-center">
            <p className="text-base font-bold text-gray-900">아직 등록된 강의가 없습니다</p>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              첫 강의를 추가하면 진도와 완료 현황을 관리할 수 있습니다.
            </p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={courses.map((course) => course.id)} strategy={verticalListSortingStrategy}>
              {isManageMode ? (
                <p className="mb-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
                  강의를 길게 눌러 순서를 바꿀 수 있어요
                </p>
              ) : null}
              <div className="space-y-3">
                {courses.map((course) => (
                  <SortableCourseCard
                    key={course.id}
                    course={course}
                    isManageMode={isManageMode}
                    onDelete={handleDeleteCourse}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </section>
    </main>
  );
}

function SortableCourseCard({
  course,
  isManageMode,
  onDelete,
}: {
  course: CourseWithLectures;
  isManageMode: boolean;
  onDelete: (courseId: string, title: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: course.id,
    disabled: !isManageMode,
  });
  const progress = getProgress(course);
  const completedCount = course.lectures.filter((lecture) => lecture.status === "COMPLETED").length;
  const planSummaries = getSectionPlanSummaries(course);
  const visiblePlanSummaries = planSummaries.slice(0, 5);
  const hiddenPlanSummaryCount = Math.max(0, planSummaries.length - visiblePlanSummaries.length);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-base font-bold leading-6 text-gray-950">{course.title}</h3>
          <p className="mt-0.5 text-xs font-bold text-blue-700">현재 {course.currentRound ?? 1}회독</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs font-bold text-gray-500">
            {completedCount}/{course.lectures.length}
          </span>
          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">
            {progress}%
          </span>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-200">
        <div className="h-full rounded-full bg-blue-500" style={{ width: `${progress}%` }} />
      </div>
      {planSummaries.length > 0 ? (
        <div className="mt-3 space-y-1.5 border-t border-gray-200 pt-2">
          {visiblePlanSummaries.map((summary) => (
            <div key={summary.sectionTitle} className="flex items-start gap-1.5 text-xs font-bold text-gray-600">
              <PlanSummaryIcon status={summary.status} />
              <p className="min-w-0 flex-1 break-words leading-4">
                {summary.status === "overdue"
                  ? `${summary.sectionTitle} ${summary.overdueCount}강 밀림`
                  : summary.status === "needed"
                    ? `${summary.sectionTitle} ${summary.neededCount}강 필요`
                    : `${summary.sectionTitle} 계획대로 진행 중`}
              </p>
            </div>
          ))}
          {hiddenPlanSummaryCount > 0 ? (
            <p className="text-xs font-bold text-gray-400">추가 {hiddenPlanSummaryCount}개 Section</p>
          ) : null}
        </div>
      ) : null}
    </>
  );

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`rounded-2xl border border-gray-200 bg-gray-50 p-4 ${
        isDragging ? "relative z-20 shadow-lg" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {isManageMode ? (
          <div className="min-w-0 flex-1">{content}</div>
        ) : (
          <Link href={`/courses/${course.id}`} className="min-w-0 flex-1 active:opacity-80">
            {content}
          </Link>
        )}
        <div className="flex shrink-0 flex-col gap-2">
          {isManageMode ? (
            <button
              type="button"
              className="flex h-11 w-11 touch-none items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 active:bg-gray-100"
              aria-label={`${course.title} 순서 이동`}
              {...attributes}
              {...listeners}
            >
              <DragHandleIcon />
            </button>
          ) : null}
          {isManageMode ? (
            <button
              type="button"
              onClick={() => onDelete(course.id, course.title)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 active:bg-red-50 active:text-red-600"
              aria-label={`${course.title} 삭제`}
            >
              <TrashIcon />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function GearIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.3 4.4 11 2h2l.7 2.4 1.9.8 2.2-1.2 1.4 1.4-1.2 2.2.8 1.9 2.2.7v2l-2.2.7-.8 1.9 1.2 2.2-1.4 1.4-2.2-1.2-1.9.8L13 22h-2l-.7-2.4-1.9-.8-2.2 1.2-1.4-1.4 1.2-2.2-.8-1.9L3 13.8v-2l2.2-.7.8-1.9-1.2-2.2 1.4-1.4 2.2 1.2 1.9-.8Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    </svg>
  );
}

function DragHandleIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" />
    </svg>
  );
}

function PlanSummaryIcon({ status }: { status: "overdue" | "needed" | "onTrack" }) {
  if (status === "overdue") {
    return <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden="true" />;
  }

  if (status === "needed") {
    return <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-500" aria-hidden="true" />;
  }

  return <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" aria-hidden="true" />;
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
