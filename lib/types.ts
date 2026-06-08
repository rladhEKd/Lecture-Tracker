export type LectureStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export type Course = {
  id: string;
  title: string;
  createdAt: string;
};

export type Lecture = {
  id: string;
  courseId: string;
  title: string;
  status: LectureStatus;
  completedAt: string | null;
  createdAt: string;
};

export type CourseWithLectures = Course & {
  lectures: Lecture[];
};
