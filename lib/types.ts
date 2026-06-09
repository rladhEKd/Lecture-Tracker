export type LectureStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export type Course = {
  id: string;
  title: string;
  createdAt: string;
  order?: number;
  currentRound?: number;
  completedRounds?: Array<{
    round: number;
    completedAt: string;
  }>;
};

export type Section = {
  id: string;
  courseId: string;
  title: string;
  order: number;
  createdAt: string;
  planStartDate?: string;
  planEndDate?: string;
  dailyTargetCount?: number;
};

export type Lecture = {
  id: string;
  courseId: string;
  sectionId: string;
  title: string;
  status: LectureStatus;
  completedAt: string | null;
  createdAt: string;
};

export type StudyPlanGroup = {
  id: string;
  courseId: string;
  title: string;
  sectionIds: string[];
  planStartDate?: string;
  planEndDate?: string;
  dailyTargetCount?: number;
  createdAt: string;
};

export type CourseWithLectures = Course & {
  sections: Section[];
  lectures: Lecture[];
  planGroups?: StudyPlanGroup[];
};
