"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createCourse } from "@/lib/storage";

export default function NewCoursePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [lectureText, setLectureText] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const lines = lectureText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const lectureCount = lines.filter((line) => !line.startsWith("# ")).length;

    if (!title.trim()) {
      setError("강의명을 입력하세요.");
      return;
    }

    if (lectureCount === 0) {
      setError("강의 목록을 한 줄 이상 입력하세요.");
      return;
    }

    const course = createCourse(title.trim(), lines);
    router.push(`/courses/${course.id}`);
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-screen-sm bg-white px-5 pb-10 pt-[max(24px,env(safe-area-inset-top))]">
      <header className="mb-6">
        <Link href="/" className="text-sm font-bold text-gray-600 active:text-gray-950">
          돌아가기
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-gray-950">새 강의 등록</h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          대제목은 <span className="font-bold text-gray-800"># </span>로 시작하세요. 그 외 줄은 직전 대제목의 강의로 저장됩니다.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <label className="block">
          <span className="text-sm font-bold text-gray-900">강의명</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="2026 정보처리기사 필기"
            className="mt-2 min-h-14 w-full rounded-lg border border-gray-300 bg-white px-4 text-base text-gray-950 outline-none transition focus:border-gray-950 focus:ring-4 focus:ring-gray-100"
          />
        </label>

        <label className="mt-5 block">
          <span className="text-sm font-bold text-gray-900">강의 목록</span>
          <textarea
            value={lectureText}
            onChange={(event) => setLectureText(event.target.value)}
            placeholder={
              "# 1과목. 소프트웨어 구축\n1강 소프트웨어 공학\n2강 요구사항 분석\n# 2과목. 데이터베이스 구축\n3강 데이터베이스 개념\n4강 SQL"
            }
            rows={12}
            className="mt-2 w-full resize-y rounded-lg border border-gray-300 bg-white px-4 py-3 text-base leading-7 text-gray-950 outline-none transition focus:border-gray-950 focus:ring-4 focus:ring-gray-100"
          />
        </label>

        {error ? (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>
        ) : null}

        <button
          type="submit"
          className="mt-6 flex min-h-14 w-full items-center justify-center rounded-lg bg-gray-950 px-5 text-base font-bold text-white shadow-sm active:bg-gray-800"
        >
          등록
        </button>
      </form>
    </main>
  );
}
