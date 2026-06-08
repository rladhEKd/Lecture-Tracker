"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createCourse } from "@/lib/storage";

type InputMode = "manual" | "url" | "ocr";

function normalizeOcrText(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export default function NewCoursePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [lectureText, setLectureText] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("manual");
  const [importUrl, setImportUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isOcrRunning, setIsOcrRunning] = useState(false);
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

  async function handleOcrUpload(file: File | null) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("이미지 파일을 선택하세요.");
      return;
    }

    setError("");
    setIsOcrRunning(true);

    try {
      const { recognize } = await import("tesseract.js");
      const result = await recognize(file, "kor+eng");
      const normalizedText = normalizeOcrText(result.data.text);

      if (!normalizedText) {
        setError("이미지에서 텍스트를 찾지 못했습니다. 더 선명한 캡처로 다시 시도하세요.");
        return;
      }

      setLectureText(normalizedText);
      setError("OCR 완료: 결과를 확인하고 필요한 경우 # 대제목 형식으로 수정하세요.");
    } catch {
      setError("OCR 처리 중 문제가 발생했습니다. 이미지가 선명한지 확인한 뒤 다시 시도하세요.");
    } finally {
      setIsOcrRunning(false);
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
          직접 입력, njobler URL, 캡처 이미지 OCR 중 편한 방식으로 강의 목록을 채운 뒤 수정해서 등록하세요.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-100 p-1">
          <ModeButton active={inputMode === "manual"} onClick={() => setInputMode("manual")}>
            직접 입력
          </ModeButton>
          <ModeButton active={inputMode === "url"} onClick={() => setInputMode("url")}>
            URL
          </ModeButton>
          <ModeButton active={inputMode === "ocr"} onClick={() => setInputMode("ocr")}>
            이미지 OCR
          </ModeButton>
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

        {inputMode === "ocr" ? (
          <section className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4">
            <label className="block">
              <span className="text-sm font-bold text-gray-900">강의 목록 캡처 이미지</span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => handleOcrUpload(event.target.files?.[0] ?? null)}
                disabled={isOcrRunning}
                className="mt-2 block w-full rounded-lg border border-blue-200 bg-white px-3 py-3 text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-bold file:text-white"
              />
            </label>
            <p className="mt-3 text-xs font-bold leading-5 text-blue-700">
              {isOcrRunning
                ? "이미지에서 텍스트를 추출하는 중입니다..."
                : "추출 결과는 아래 강의 목록에 들어가며, 등록 전에 직접 수정할 수 있습니다."}
            </p>
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
              "# 1과목. 소프트웨어 구축\n1. 소프트웨어 공학\n2. 요구사항 분석\n# 2과목. 데이터베이스 구축\n1. 데이터베이스 개념\n2. SQL"
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

function ModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-md px-2 text-sm font-bold ${
        active ? "bg-white text-gray-950 shadow-sm" : "text-gray-500"
      }`}
    >
      {children}
    </button>
  );
}
