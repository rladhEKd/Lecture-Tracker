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

    const lectureTitles = lectureText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!title.trim()) {
      setError("강의명을 입력하세요.");
      return;
    }

    if (lectureTitles.length === 0) {
      setError("강의 목록을 한 줄 이상 입력하세요.");
      return;
    }

    const course = createCourse(title.trim(), lectureTitles);
    router.push(`/courses/${course.id}`);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-screen-sm bg-white px-5 py-6">
      <header className="mb-6">
        <Link href="/" className="text-sm font-bold text-gray-600 active:text-gray-950">
          돌아가기
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-gray-950">새 강의 등록</h1>
      </header>

      <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <label className="block">
          <span className="text-sm font-bold text-gray-900">강의명</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="2026 세법학 기본이론"
            className="mt-2 min-h-12 w-full rounded-lg border border-gray-300 px-4 text-base text-gray-950 outline-none focus:border-gray-950"
          />
        </label>

        <label className="mt-5 block">
          <span className="text-sm font-bold text-gray-900">강의 목록</span>
          <textarea
            value={lectureText}
            onChange={(event) => setLectureText(event.target.value)}
            placeholder={"1강 OT\n2강 법인세 총론\n3강 익금\n4강 손금"}
            rows={10}
            className="mt-2 w-full resize-y rounded-lg border border-gray-300 px-4 py-3 text-base leading-6 text-gray-950 outline-none focus:border-gray-950"
          />
        </label>

        {error ? <p className="mt-4 text-sm font-bold text-red-600">{error}</p> : null}

        <button
          type="submit"
          className="mt-6 flex min-h-14 w-full items-center justify-center rounded-lg bg-gray-950 px-5 text-base font-bold text-white active:bg-gray-800"
        >
          등록
        </button>
      </form>
    </main>
  );
}
