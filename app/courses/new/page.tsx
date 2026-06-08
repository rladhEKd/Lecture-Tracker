"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createCourse } from "@/lib/storage";

type InputMode = "manual" | "url";

export default function NewCoursePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [lectureText, setLectureText] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("manual");
  const [importUrl, setImportUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
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

  async function handleImport() {
    setError("");
    setIsImporting(true);

    try {
      const response = await fetch("/api/import/njobler", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ url: importUrl }),
      });
      const result = (await response.json()) as {
        error?: string;
        title?: string;
        text?: string;
        sectionCount?: number;
        lectureCount?: number;
      };

      if (!response.ok || !result.text) {
        setError(result.error ?? "강의 목록을 가져오지 못했습니다.");
        return;
      }

      setLectureText(result.text);
      if (!title.trim() && result.title) {
        setTitle(result.title);
      }
      setError(`가져오기 완료: 대제목 ${result.sectionCount ?? 0}개, 강의 ${result.lectureCount ?? 0}개`);
    } catch {
      setError("가져오기 중 문제가 발생했습니다. 네트워크 상태와 URL을 확인하세요.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-screen-sm bg-white px-5 pb-10 pt-[max(24px,env(safe-area-inset-top))]">
      <header className="mb-6">
        <Link href="/" className="text-sm font-bold text-gray-600 active:text-gray-950">
          돌아가기
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-gray-950">새 강의 등록</h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          직접 입력하거나 njobler 강의 URL에서 커리큘럼을 가져온 뒤 수정해서 등록하세요.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setInputMode("manual")}
            className={`min-h-11 rounded-md text-sm font-bold ${
              inputMode === "manual" ? "bg-white text-gray-950 shadow-sm" : "text-gray-500"
            }`}
          >
            직접 입력
          </button>
          <button
            type="button"
            onClick={() => setInputMode("url")}
            className={`min-h-11 rounded-md text-sm font-bold ${
              inputMode === "url" ? "bg-white text-gray-950 shadow-sm" : "text-gray-500"
            }`}
          >
            URL로 가져오기
          </button>
        </div>

        {inputMode === "url" ? (
          <section className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4">
            <label className="block">
              <span className="text-sm font-bold text-gray-900">njobler 강의 URL</span>
              <input
                value={importUrl}
                onChange={(event) => setImportUrl(event.target.value)}
                placeholder="https://www.njobler.net/product/lecture/show/prod/11293"
                className="mt-2 min-h-12 w-full rounded-lg border border-blue-200 bg-white px-4 text-base text-gray-950 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </label>
            <button
              type="button"
              onClick={handleImport}
              disabled={isImporting}
              className="mt-3 flex min-h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-bold text-white active:bg-blue-700 disabled:bg-blue-300"
            >
              {isImporting ? "가져오는 중..." : "커리큘럼 가져오기"}
            </button>
          </section>
        ) : null}

        <label className="mt-5 block">
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
          <p
            className={`mt-4 rounded-lg px-4 py-3 text-sm font-bold ${
              error.includes("완료") ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"
            }`}
          >
            {error}
          </p>
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
